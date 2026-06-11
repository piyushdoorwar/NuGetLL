import * as vscode from "vscode";
import { GetllServices } from "../services/container";
import { logger } from "../utils/logger";
import { DashboardPanel } from "../webview/dashboardPanel";

/** Dashboard + miscellaneous utility commands. */
export function registerDashboardCommands(services: GetllServices): vscode.Disposable[] {
  const open = vscode.commands.registerCommand("getll.openDashboard", () => {
    DashboardPanel.createOrShow(services);
  });

  const refresh = vscode.commands.registerCommand("getll.refreshWorkspace", async () => {
    const result = await services.scanner.scan();
    for (const issue of result.issues) {
      logger.warn(`${issue.file}: ${issue.message}`);
    }
    if (result.issues.length > 0) {
      vscode.window.showWarningMessage(
        `GetLL: ${result.issues.length} file(s) could not be parsed. See output for details.`
      );
    }
  });

  const search = vscode.commands.registerCommand("getll.searchPackages", async () => {
    const query = await vscode.window.showInputBox({
      title: "Search NuGet Packages",
      placeHolder: "e.g. Newtonsoft.Json",
      prompt: "Opens the GetLL dashboard with results"
    });
    if (query === undefined) {
      return;
    }
    DashboardPanel.createOrShow(services, { tab: "browse", query });
  });

  const details = vscode.commands.registerCommand("getll.showPackageDetails", async (packageId?: string) => {
    let id = packageId;
    if (!id) {
      const installed = new Set<string>();
      for (const project of services.scanner.getModel()?.projects ?? []) {
        for (const pkg of project.packages) {
          if (!pkg.isTransitive) {
            installed.add(pkg.id);
          }
        }
      }
      id = await vscode.window.showQuickPick([...installed].sort(), { title: "View Package Details" });
    }
    if (id) {
      DashboardPanel.createOrShow(services, { tab: "details", query: id });
    }
  });

  const openOutput = vscode.commands.registerCommand("getll.openOutputChannel", () => {
    logger.show();
  });

  const openSettings = vscode.commands.registerCommand("getll.openSettings", () => {
    vscode.commands.executeCommand("workbench.action.openSettings", "getll");
  });

  return [open, refresh, search, details, openOutput, openSettings];
}
