import * as vscode from "vscode";
import { GetllServices } from "../services/container";
import { installPackage } from "../services/packageOperations";
import { GetllTreeItem } from "../views/getllTreeProvider";
import { pickPackage, pickProjects, pickVersion } from "./pickers";

export function registerAddPackageCommand(services: GetllServices): vscode.Disposable {
  return vscode.commands.registerCommand("getll.addPackage", async (node?: GetllTreeItem) => {
    const packageId = await pickPackage(services);
    if (!packageId) {
      return;
    }

    let projectPaths: string[];
    if (node?.projectPath) {
      projectPaths = [node.projectPath];
    } else {
      const projects = await pickProjects(services, { title: `Install ${packageId} into...` });
      if (!projects) {
        return;
      }
      projectPaths = projects.map((p) => p.path);
    }

    const version = await pickVersion(services, packageId);
    if (version === undefined) {
      return;
    }
    await installPackage(services, packageId, projectPaths, version || undefined);
  });
}
