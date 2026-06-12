import * as vscode from "vscode";
import { getConfig } from "../config";
import { PackageSearchResult } from "../models/packageModel";
import { GetllServices } from "../services/container";
import { installPackage, removePackage, restoreTarget } from "../services/packageOperations";
import { parseSearchJson } from "../services/nugetCliService";
import { logger } from "../utils/logger";
import { isInsideAny } from "../utils/pathUtils";
import {
  ExtensionToWebviewMessage,
  GetllSettingsSnapshot,
  WebviewToExtensionMessage
} from "./messageProtocol";
import { getWebviewHtml } from "./webviewHtml";

let operationCounter = 0;

export class DashboardPanel {
  static current: DashboardPanel | undefined;

  static createOrShow(services: GetllServices, options: { tab?: string; query?: string } = {}): void {
    if (DashboardPanel.current) {
      DashboardPanel.current.panel.reveal();
      if (options.tab) {
        DashboardPanel.current.post({ type: "navigate", tab: options.tab, query: options.query });
      }
      return;
    }
    const panel = vscode.window.createWebviewPanel("getll.dashboard", "NeuGetLL", vscode.ViewColumn.One, {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(services.context.extensionUri, "dist", "webview")]
    });
    DashboardPanel.current = new DashboardPanel(panel, services);
    if (options.tab) {
      // The webview requests state on load; queue the navigation slightly after.
      setTimeout(() => {
        DashboardPanel.current?.post({ type: "navigate", tab: options.tab as string, query: options.query });
      }, 600);
    }
  }

  private readonly disposables: vscode.Disposable[] = [];

  private constructor(private readonly panel: vscode.WebviewPanel, private readonly services: GetllServices) {
    panel.webview.html = getWebviewHtml(panel.webview, services.context.extensionUri);
    panel.iconPath = vscode.Uri.joinPath(services.context.extensionUri, "media", "getll.svg");

    panel.webview.onDidReceiveMessage(
      (message: WebviewToExtensionMessage) => {
        this.handleMessage(message).catch((err) => logger.error("Dashboard message failed", err));
      },
      undefined,
      this.disposables
    );

    const unsubscribe = services.scanner.onDidChangeModel((model) => {
      this.post({ type: "workspaceModel", model });
    });
    this.disposables.push({ dispose: unsubscribe });

    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration("getll")) {
          this.post({ type: "settingsUpdated", settings: this.settingsSnapshot() });
        }
      })
    );

    panel.onDidDispose(() => this.dispose(), undefined, this.disposables);
  }

  post(message: ExtensionToWebviewMessage): void {
    this.panel.webview.postMessage(message);
  }

  /** Pushes a fresh source list to the dashboard, if it is open. */
  static pushSources(services: GetllServices): void {
    const panel = DashboardPanel.current;
    if (!panel) {
      return;
    }
    services.sources
      .listSources()
      .then((sources) => panel.post({ type: "sourcesUpdated", sources }))
      .catch((err) => logger.warn(`Refreshing sources for dashboard failed: ${String(err)}`));
  }

  private settingsSnapshot(): GetllSettingsSnapshot {
    const config = getConfig();
    return {
      defaultPackageSource: config.defaultPackageSource,
      includePrerelease: config.includePrerelease,
      showTransitivePackages: config.showTransitivePackages,
      confirmBeforeMultiProjectChanges: config.confirmBeforeMultiProjectChanges,
      restoreAfterInstall: config.restoreAfterInstall,
      restoreAfterUpdate: config.restoreAfterUpdate,
      preferDotnetCli: config.preferDotnetCli,
      nugetOrgApiUrl: config.nugetOrgApiUrl,
      maxSearchResults: config.maxSearchResults,
      dotnetAvailable: this.services.dotnet.available,
      dotnetSdkVersion: this.services.dotnet.version
    };
  }

  private listTargets(): string[] {
    const model = this.services.scanner.getModel();
    if (!model) {
      return [];
    }
    return model.solutions.length > 0 ? model.solutions : model.projects.map((p) => p.path);
  }

  private async runOperation(label: string, work: () => Promise<string>): Promise<void> {
    const operationId = `op-${++operationCounter}`;
    this.post({ type: "operationStarted", operationId, label });
    try {
      const message = await work();
      this.post({ type: "operationCompleted", operationId, message });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`${label} failed`, err);
      this.post({ type: "operationFailed", operationId, error: message });
    }
  }

  private async searchViaCli(
    query: string,
    options: { includePrerelease: boolean; take: number; source?: string; exactMatch?: boolean }
  ): Promise<PackageSearchResult[]> {
    const result = await this.services.cli.search(query, {
      prerelease: options.includePrerelease,
      take: options.take,
      source: options.source,
      exactMatch: options.exactMatch
    });
    if (result.code !== 0) {
      throw new Error((result.stderr || result.stdout || "dotnet package search failed").trim().slice(0, 400));
    }
    return parseSearchJson(result.stdout) ?? [];
  }

  private async handleMessage(message: WebviewToExtensionMessage): Promise<void> {
    const services = this.services;
    switch (message.type) {
      case "scanWorkspace": {
        await services.scanner.scan();
        const model = services.scanner.getModel();
        if (model) {
          this.post({ type: "workspaceModel", model });
        }
        this.post({ type: "settingsUpdated", settings: this.settingsSnapshot() });
        break;
      }
      case "getSettings":
        this.post({ type: "settingsUpdated", settings: this.settingsSnapshot() });
        break;
      case "searchPackages": {
        const config = getConfig();
        const take = message.take ?? config.maxSearchResults;
        await this.runOperation(`Search "${message.query}"`, async () => {
          let results: PackageSearchResult[];
          const cliOptions = {
            includePrerelease: message.includePrerelease,
            take,
            source: message.source || config.defaultPackageSource || undefined,
            exactMatch: message.exactMatch
          };
          if (config.preferDotnetCli && services.dotnet.available) {
            results = await this.searchViaCli(message.query, cliOptions);
          } else {
            try {
              results = await services.api.searchPackages(
                message.exactMatch ? `packageid:${message.query}` : message.query,
                {
                  includePrerelease: message.includePrerelease,
                  take,
                  skip: message.skip
                }
              );
            } catch (apiErr) {
              if (!services.dotnet.available) {
                throw apiErr;
              }
              logger.warn(`NuGet API search failed, falling back to dotnet CLI: ${String(apiErr)}`);
              results = await this.searchViaCli(message.query, cliOptions);
            }
          }
          this.post({ type: "searchResults", query: message.query, results });
          return `${results.length} result(s)`;
        });
        break;
      }
      case "getPackageDetails":
        await this.runOperation(`Load details for ${message.packageId}`, async () => {
          const details = await services.api.getPackageDetails(message.packageId);
          const model = services.scanner.getModel();
          details.usedInProjects = (model?.projects ?? [])
            .filter((p) => p.packages.some((pkg) => pkg.id.toLowerCase() === message.packageId.toLowerCase()))
            .map((p) => ({
              name: p.name,
              path: p.path,
              version: p.packages.find((pkg) => pkg.id.toLowerCase() === message.packageId.toLowerCase())?.version
            }));
          this.post({ type: "packageDetails", details });
          return "details loaded";
        });
        break;
      case "installPackage":
        await this.runOperation(`Install ${message.packageId}`, async () => {
          const outcome = await installPackage(services, message.packageId, message.projectPaths, message.version, {
            skipConfirm: true
          });
          if (outcome.failed.length > 0) {
            throw new Error(outcome.failed.map((f) => `${f.project}: ${f.error}`).join("; "));
          }
          return `installed in ${outcome.succeeded.length} project(s)`;
        });
        break;
      case "updatePackage":
        await this.runOperation(`Update ${message.packageId}`, async () => {
          const outcome = await installPackage(services, message.packageId, message.projectPaths, message.version, {
            isUpdate: true,
            skipConfirm: true
          });
          if (outcome.failed.length > 0) {
            throw new Error(outcome.failed.map((f) => `${f.project}: ${f.error}`).join("; "));
          }
          return `updated in ${outcome.succeeded.length} project(s)`;
        });
        break;
      case "removePackage":
        await this.runOperation(`Remove ${message.packageId}`, async () => {
          const outcome = await removePackage(services, message.packageId, message.projectPaths, {
            skipConfirm: true
          });
          if (outcome.failed.length > 0) {
            throw new Error(outcome.failed.map((f) => `${f.project}: ${f.error}`).join("; "));
          }
          return `removed from ${outcome.succeeded.length} project(s)`;
        });
        break;
      case "checkOutdated":
        await this.runOperation("Check outdated packages", async () => {
          const config = getConfig();
          const { results, errors } = await services.vulnerabilities.checkOutdated(this.listTargets(), {
            includePrerelease: config.includePrerelease,
            includeTransitive: config.showTransitivePackages
          });
          services.results.setOutdated(results);
          this.post({ type: "outdatedResults", results, errors });
          return `${results.length} outdated package(s)`;
        });
        break;
      case "checkVulnerable":
        await this.runOperation("Check vulnerable packages", async () => {
          const { results, errors } = await services.vulnerabilities.checkVulnerable(this.listTargets(), {
            includeTransitive: true
          });
          services.results.setVulnerable(results);
          this.post({ type: "vulnerableResults", results, errors });
          return `${results.length} vulnerable package(s)`;
        });
        break;
      case "checkDeprecated":
        await this.runOperation("Check deprecated packages", async () => {
          const { results, errors } = await services.vulnerabilities.checkDeprecated(this.listTargets(), {});
          services.results.setDeprecated(results);
          this.post({ type: "deprecatedResults", results, errors });
          return `${results.length} deprecated package(s)`;
        });
        break;
      case "listSources":
        await this.runOperation("List package sources", async () => {
          const sources = await services.sources.listSources();
          this.post({ type: "sourcesUpdated", sources });
          return `${sources.length} source(s)`;
        });
        break;
      case "addSource":
        await this.runOperation(`Add source ${message.name}`, async () => {
          await services.sources.addSource(message.name, message.url);
          this.post({ type: "sourcesUpdated", sources: await services.sources.listSources() });
          return "source added";
        });
        break;
      case "removeSource": {
        const ok = await vscode.window.showWarningMessage(
          `Remove package source "${message.name}"?`,
          { modal: true },
          "Remove"
        );
        if (ok !== "Remove") {
          break;
        }
        await this.runOperation(`Remove source ${message.name}`, async () => {
          await services.sources.removeSource(message.name);
          this.post({ type: "sourcesUpdated", sources: await services.sources.listSources() });
          return "source removed";
        });
        break;
      }
      case "updateSource":
        await this.runOperation(`Edit source ${message.name}`, async () => {
          await services.sources.updateSource(message.name, message.url);
          this.post({ type: "sourcesUpdated", sources: await services.sources.listSources() });
          return "source updated";
        });
        break;
      case "enableSource":
        await this.runOperation(`Enable source ${message.name}`, async () => {
          await services.sources.enableSource(message.name);
          this.post({ type: "sourcesUpdated", sources: await services.sources.listSources() });
          return "source enabled";
        });
        break;
      case "disableSource":
        await this.runOperation(`Disable source ${message.name}`, async () => {
          await services.sources.disableSource(message.name);
          this.post({ type: "sourcesUpdated", sources: await services.sources.listSources() });
          return "source disabled";
        });
        break;
      case "restoreProject":
        // An empty path means "restore the whole workspace".
        await restoreTarget(services, message.projectPath || undefined);
        break;
      case "openExternal":
        if (/^https?:\/\//i.test(message.url)) {
          await vscode.env.openExternal(vscode.Uri.parse(message.url));
        }
        break;
      case "openFile": {
        const roots = (vscode.workspace.workspaceFolders ?? []).map((f) => f.uri.fsPath);
        if (isInsideAny(roots, message.path)) {
          const doc = await vscode.workspace.openTextDocument(message.path);
          await vscode.window.showTextDocument(doc, { preview: true });
        }
        break;
      }
      case "openVsCodeSettings":
        await vscode.commands.executeCommand("workbench.action.openSettings", "getll");
        break;
    }
  }

  dispose(): void {
    DashboardPanel.current = undefined;
    for (const d of this.disposables) {
      d.dispose();
    }
    this.panel.dispose();
  }
}
