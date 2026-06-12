import * as vscode from "vscode";
import { GetllServices } from "../services/container";
import { restoreTarget } from "../services/packageOperations";
import { pickProjects } from "./pickers";

export function registerRestoreCommands(services: GetllServices): vscode.Disposable[] {
  const workspace = vscode.commands.registerCommand("getll.restoreWorkspace", async () => {
    await restoreTarget(services, undefined, "workspace");
  });

  const solution = vscode.commands.registerCommand("getll.restoreSolution", async () => {
    const solutions = services.scanner.getModel()?.solutions ?? [];
    if (solutions.length === 0) {
      vscode.window.showInformationMessage("NuGet LL: no solution files found in this workspace.");
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

  const project = vscode.commands.registerCommand("getll.restoreProject", async (projectPath?: string) => {
    let target = projectPath;
    if (!target) {
      const picked = await pickProjects(services, { title: "Restore Project", single: true });
      if (!picked) {
        return;
      }
      target = picked[0].path;
    }
    await restoreTarget(services, target);
  });

  return [workspace, solution, project];
}
