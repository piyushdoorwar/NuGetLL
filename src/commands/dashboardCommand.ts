import * as vscode from "vscode";
import { GetllServices } from "../services/container";
import { logger } from "../utils/logger";
import { GetllTreeItem } from "../views/getllTreeProvider";
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

  const details = vscode.commands.registerCommand("getll.showPackageDetails", (node?: GetllTreeItem) => {
    if (!node?.packageId) {
      return;
    }
    DashboardPanel.createOrShow(services, { tab: "details", query: node.packageId });
  });

  const openOutput = vscode.commands.registerCommand("getll.openOutputChannel", () => {
    logger.show();
  });

  const openSettings = vscode.commands.registerCommand("getll.openSettings", () => {
    vscode.commands.executeCommand("workbench.action.openSettings", "getll");
  });

  const openProjectFile = vscode.commands.registerCommand("getll.openProjectFile", async (node?: GetllTreeItem) => {
    if (!node?.projectPath) {
      return;
    }
    const doc = await vscode.workspace.openTextDocument(node.projectPath);
    await vscode.window.showTextDocument(doc);
  });

  const copyName = vscode.commands.registerCommand("getll.copyPackageName", async (node?: GetllTreeItem) => {
    if (node?.packageId) {
      await vscode.env.clipboard.writeText(node.packageId);
      vscode.window.showInformationMessage(`GetLL: copied "${node.packageId}".`);
    }
  });

  const openNugetOrg = vscode.commands.registerCommand("getll.openOnNugetOrg", (node?: GetllTreeItem) => {
    if (node?.packageId) {
      vscode.env.openExternal(vscode.Uri.parse(`https://www.nuget.org/packages/${encodeURIComponent(node.packageId)}`));
    }
  });

  const viewAdvisory = vscode.commands.registerCommand("getll.viewAdvisory", (node?: GetllTreeItem) => {
    if (node?.advisoryUrl && /^https?:\/\//i.test(node.advisoryUrl)) {
      vscode.env.openExternal(vscode.Uri.parse(node.advisoryUrl));
    }
  });

  return [open, refresh, search, details, openOutput, openSettings, openProjectFile, copyName, openNugetOrg, viewAdvisory];
}
