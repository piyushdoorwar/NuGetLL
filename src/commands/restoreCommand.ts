import * as vscode from "vscode";
import { GetllServices } from "../services/container";
import { restoreTarget } from "../services/packageOperations";
import { GetllTreeItem } from "../views/getllTreeProvider";
import { pickProjects } from "./pickers";

export function registerRestoreCommands(services: GetllServices): vscode.Disposable[] {
  const workspace = vscode.commands.registerCommand("getll.restoreWorkspace", async () => {
    await restoreTarget(services, undefined, "workspace");
  });

  const solution = vscode.commands.registerCommand("getll.restoreSolution", async () => {
    const solutions = services.scanner.getModel()?.solutions ?? [];
    if (solutions.length === 0) {
      vscode.window.showInformationMessage("GetLL: no solution files found in this workspace.");
      return;
    }
    const target =
      solutions.length === 1
        ? solutions[0]
        : await vscode.window.showQuickPick(solutions, { title: "Restore Solution" });
    if (target) {
      await restoreTarget(services, target);
    }
  });

  const project = vscode.commands.registerCommand("getll.restoreProject", async (node?: GetllTreeItem | { projectPath?: string }) => {
    let projectPath = node && "projectPath" in node ? node.projectPath : undefined;
    if (!projectPath) {
      const picked = await pickProjects(services, { title: "Restore Project", single: true });
      if (!picked) {
        return;
      }
      projectPath = picked[0].path;
    }
    await restoreTarget(services, projectPath);
  });

  return [workspace, solution, project];
}
