import * as vscode from "vscode";
import { registerAddPackageCommand } from "./commands/addPackageCommand";
import { registerCheckCommands } from "./commands/checkCommands";
import { registerDashboardCommands } from "./commands/dashboardCommand";
import { registerRemovePackageCommand } from "./commands/removePackageCommand";
import { registerRestoreCommands } from "./commands/restoreCommand";
import { registerSourceCommands } from "./commands/sourceCommands";
import { registerUpdatePackageCommands } from "./commands/updatePackageCommand";
import { getConfig } from "./config";
import { CentralPackageService } from "./services/centralPackageService";
import { GetllServices, ResultsStore } from "./services/container";
import { NugetApiService } from "./services/nugetApiService";
import { NugetCliService } from "./services/nugetCliService";
import { PackageSourceService } from "./services/packageSourceService";
import { VulnerabilityService } from "./services/vulnerabilityService";
import { WorkspaceScanner } from "./services/workspaceScanner";
import { debounce } from "./utils/debounce";
import { logger } from "./utils/logger";
import { DashboardPanel } from "./webview/dashboardPanel";
import { HomeViewProvider } from "./webview/homeViewProvider";

const WATCH_PATTERNS = [
  "**/*.{csproj,fsproj,vbproj}",
  "**/Directory.Packages.props",
  "**/Directory.Build.props",
  "**/[Nn]u[Gg]et.[Cc]onfig",
  "**/packages.config"
];

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  logger.info("NeuGetLL activating...");

  const scanner = new WorkspaceScanner(
    () => (vscode.workspace.workspaceFolders ?? []).map((f) => f.uri.fsPath),
    () => getConfig().excludedFolders
  );
  const cli = new NugetCliService((line) => logger.output(line));
  const api = new NugetApiService(() => getConfig().nugetOrgApiUrl);
  const sources = new PackageSourceService(cli, scanner);
  const services: GetllServices = {
    context,
    scanner,
    cli,
    api,
    sources,
    central: new CentralPackageService(),
    vulnerabilities: new VulnerabilityService(cli),
    results: new ResultsStore(),
    dotnet: { available: false }
  };

  // All UI lives in webviews: the activity bar hosts a small launcher view
  // and the dashboard panel carries the full experience.
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(HomeViewProvider.viewId, new HomeViewProvider(services))
  );

  // Commands
  context.subscriptions.push(
    registerAddPackageCommand(services),
    registerRemovePackageCommand(services),
    ...registerUpdatePackageCommands(services),
    ...registerCheckCommands(services),
    ...registerRestoreCommands(services),
    ...registerSourceCommands(services),
    ...registerDashboardCommands(services)
  );

  // File watchers with a 500ms debounced refresh.
  const refresh = debounce(() => {
    if (getConfig().autoRefreshOnProjectFileChange) {
      scanner.scan().catch((err) => logger.error("Workspace scan failed", err));
      DashboardPanel.pushSources(services);
    }
  }, 500);
  for (const pattern of WATCH_PATTERNS) {
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);
    watcher.onDidChange(() => refresh());
    watcher.onDidCreate(() => refresh());
    watcher.onDidDelete(() => refresh());
    context.subscriptions.push(watcher);
  }
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => refresh()),
    { dispose: () => refresh.cancel() },
    { dispose: () => logger.dispose() }
  );

  // dotnet SDK detection (non-blocking).
  void cli.detectSdk().then((sdk) => {
    services.dotnet.available = sdk.available;
    services.dotnet.version = sdk.version;
    vscode.commands.executeCommand("setContext", "getll.dotnetAvailable", sdk.available);
    if (sdk.available) {
      logger.info(`dotnet SDK detected: ${sdk.version ?? "unknown version"}`);
    } else {
      logger.warn("dotnet SDK not found on PATH. Package actions are disabled.");
      vscode.window
        .showErrorMessage(
          "NeuGetLL: the dotnet SDK was not found. Install the .NET SDK to enable package management.",
          "Open .NET install instructions"
        )
        .then((choice) => {
          if (choice === "Open .NET install instructions") {
            vscode.env.openExternal(vscode.Uri.parse("https://dotnet.microsoft.com/download"));
          }
        });
    }
  });

  // Initial scan.
  if (getConfig().scanOnStartup) {
    scanner
      .scan()
      .then((result) => {
        logger.info(
          `Workspace scan complete: ${result.model.projects.length} project(s), ${result.model.solutions.length} solution(s).`
        );
        for (const issue of result.issues) {
          logger.warn(`${issue.file}: ${issue.message}`);
        }
      })
      .catch((err) => logger.error("Initial workspace scan failed", err));
  }
}

export function deactivate(): void {
  // Disposables are handled via context.subscriptions.
}
