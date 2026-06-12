import * as vscode from "vscode";
import { GetllServices } from "../services/container";
import { removePackage } from "../services/packageOperations";
import { pickProjects } from "./pickers";

function projectsUsing(services: GetllServices, packageId: string) {
  return (services.scanner.getModel()?.projects ?? []).filter((p) =>
    p.packages.some((pkg) => pkg.id.toLowerCase() === packageId.toLowerCase() && !pkg.isTransitive)
  );
}

export function registerRemovePackageCommand(services: GetllServices): vscode.Disposable {
  return vscode.commands.registerCommand("getll.removePackage", async () => {
    const installed = new Set<string>();
    for (const project of services.scanner.getModel()?.projects ?? []) {
      for (const pkg of project.packages) {
        if (!pkg.isTransitive) {
          installed.add(pkg.id);
        }
      }
    }
    if (installed.size === 0) {
      vscode.window.showInformationMessage("NeuGetLL: no packages installed in this workspace.");
      return;
    }
    const packageId = await vscode.window.showQuickPick([...installed].sort(), { title: "Remove Package" });
    if (!packageId) {
      return;
    }

    const using = projectsUsing(services, packageId);
    if (using.length === 0) {
      vscode.window.showInformationMessage(`NeuGetLL: ${packageId} is not referenced by any project.`);
      return;
    }
    const projects =
      using.length === 1
        ? using
        : await pickProjects(services, {
            title: `Remove ${packageId} from...`,
            projects: using,
            preselect: using.map((p) => p.path)
          });
    if (!projects) {
      return;
    }

    await removePackage(services, packageId, projects.map((p) => p.path));
  });
}
