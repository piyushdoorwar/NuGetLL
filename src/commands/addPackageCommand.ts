import * as vscode from "vscode";
import { GetllServices } from "../services/container";
import { installPackage } from "../services/packageOperations";
import { pickPackage, pickProjects, pickVersion } from "./pickers";

export function registerAddPackageCommand(services: GetllServices): vscode.Disposable {
  return vscode.commands.registerCommand("getll.addPackage", async () => {
    const packageId = await pickPackage(services);
    if (!packageId) {
      return;
    }

    const projects = await pickProjects(services, { title: `Install ${packageId} into...` });
    if (!projects) {
      return;
    }
    const projectPaths = projects.map((p) => p.path);

    const version = await pickVersion(services, packageId);
    if (version === undefined) {
      return;
    }
    await installPackage(services, packageId, projectPaths, version || undefined);
  });
}
