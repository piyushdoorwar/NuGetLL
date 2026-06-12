import * as vscode from "vscode";
import { GetllServices } from "../services/container";
import { logger } from "../utils/logger";
import { DashboardPanel } from "../webview/dashboardPanel";

async function withSourceErrorHandling(action: string, work: () => Promise<void>): Promise<boolean> {
  try {
    await work();
    return true;
  } catch (err) {
    logger.error(`${action} failed`, err);
    vscode.window
      .showErrorMessage(`NeuGetLL: ${action} failed. See output for details.`, "Open Output")
      .then((choice) => {
        if (choice === "Open Output") {
          logger.show();
        }
      });
    return false;
  }
}

export function registerSourceCommands(services: GetllServices): vscode.Disposable[] {
  const refreshDashboard = () => DashboardPanel.pushSources(services);

  const manage = vscode.commands.registerCommand("getll.manageSources", () => {
    DashboardPanel.createOrShow(services, { tab: "sources" });
  });

  const add = vscode.commands.registerCommand("getll.addSource", async () => {
    const name = await vscode.window.showInputBox({
      title: "Add Package Source (1/2)",
      prompt: "Source name",
      placeHolder: "e.g. my-company-feed",
      validateInput: (v) => (v.trim().length === 0 ? "Name is required" : undefined)
    });
    if (!name) {
      return;
    }
    const url = await vscode.window.showInputBox({
      title: "Add Package Source (2/2)",
      prompt: "Feed URL or local folder path",
      placeHolder: "https://example.com/v3/index.json",
      validateInput: (v) => (v.trim().length === 0 ? "URL or path is required" : undefined)
    });
    if (!url) {
      return;
    }
    if (/:\/\/[^/]*:[^/@]*@/.test(url)) {
      vscode.window.showErrorMessage(
        "NeuGetLL: do not embed credentials in the source URL. Use a NuGet credential provider instead."
      );
      return;
    }
    if (await withSourceErrorHandling("Add source", () => services.sources.addSource(name.trim(), url.trim()))) {
      vscode.window.showInformationMessage(`NeuGetLL: source "${name}" added. For authenticated feeds, configure a NuGet credential provider.`);
      refreshDashboard();
    }
  });

  const remove = vscode.commands.registerCommand("getll.removeSource", async () => {
    const name = await pickSourceName(services, "Remove Package Source");
    if (!name) {
      return;
    }
    const choice = await vscode.window.showWarningMessage(
      `Remove package source "${name}"?`,
      { modal: true, detail: "This edits your NuGet configuration." },
      "Remove"
    );
    if (choice !== "Remove") {
      return;
    }
    if (await withSourceErrorHandling("Remove source", () => services.sources.removeSource(name))) {
      vscode.window.showInformationMessage(`NeuGetLL: source "${name}" removed.`);
      refreshDashboard();
    }
  });

  const enable = vscode.commands.registerCommand("getll.enableSource", async () => {
    const name = await pickSourceName(services, "Enable Package Source");
    if (name && (await withSourceErrorHandling("Enable source", () => services.sources.enableSource(name)))) {
      refreshDashboard();
    }
  });

  const disable = vscode.commands.registerCommand("getll.disableSource", async () => {
    const name = await pickSourceName(services, "Disable Package Source");
    if (name && (await withSourceErrorHandling("Disable source", () => services.sources.disableSource(name)))) {
      refreshDashboard();
    }
  });

  const edit = vscode.commands.registerCommand("getll.editSource", async () => {
    const sources = await listSourcesSafe(services);
    const picked = await vscode.window.showQuickPick(
      sources.map((s) => ({ label: s.name, description: s.url })),
      { title: "Edit Package Source" }
    );
    if (!picked) {
      return;
    }
    const url = await vscode.window.showInputBox({
      title: `Edit URL for "${picked.label}"`,
      value: picked.description,
      validateInput: (v) => (v.trim().length === 0 ? "URL or path is required" : undefined)
    });
    if (!url || url === picked.description) {
      return;
    }
    if (await withSourceErrorHandling("Edit source", () => services.sources.updateSource(picked.label, url.trim()))) {
      refreshDashboard();
    }
  });

  const openConfig = vscode.commands.registerCommand("getll.openNugetConfig", async () => {
    const configs = services.scanner.getModel()?.nugetConfigPaths ?? [];
    if (configs.length === 0) {
      vscode.window.showInformationMessage("NeuGetLL: no NuGet.Config found in this workspace.");
      return;
    }
    const target =
      configs.length === 1 ? configs[0] : await vscode.window.showQuickPick(configs, { title: "Open NuGet.Config" });
    if (!target) {
      return;
    }
    const doc = await vscode.workspace.openTextDocument(target);
    await vscode.window.showTextDocument(doc);
  });

  return [manage, add, remove, enable, disable, edit, openConfig];
}

async function listSourcesSafe(services: GetllServices) {
  try {
    return await services.sources.listSources();
  } catch (err) {
    logger.error("Listing sources failed", err);
    return [];
  }
}

async function pickSourceName(services: GetllServices, title: string): Promise<string | undefined> {
  const sources = await listSourcesSafe(services);
  if (sources.length === 0) {
    vscode.window.showInformationMessage("NeuGetLL: no package sources found.");
    return undefined;
  }
  const picked = await vscode.window.showQuickPick(
    sources.map((s) => ({ label: s.name, description: `${s.url}${s.enabled ? "" : " (disabled)"}` })),
    { title }
  );
  return picked?.label;
}
