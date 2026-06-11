import * as vscode from "vscode";
import { getConfig } from "../config";
import { ProjectInfo } from "../models/projectModel";
import { logger } from "../utils/logger";
import { isInsideAny } from "../utils/pathUtils";
import { GetllServices } from "./container";

export interface OperationOutcome {
  succeeded: string[];
  failed: { project: string; error: string }[];
  skipped: { project: string; reason: string }[];
}

function workspaceRoots(): string[] {
  return (vscode.workspace.workspaceFolders ?? []).map((f) => f.uri.fsPath);
}

function findProject(services: GetllServices, projectPath: string): ProjectInfo | undefined {
  return services.scanner.getModel()?.projects.find((p) => p.path === projectPath);
}

function ensureInsideWorkspace(projectPath: string): void {
  if (!isInsideAny(workspaceRoots(), projectPath)) {
    throw new Error(`Refusing to modify a file outside the workspace: ${projectPath}`);
  }
}

async function confirmModal(message: string, detail: string, action: string): Promise<boolean> {
  const choice = await vscode.window.showWarningMessage(message, { modal: true, detail }, action);
  return choice === action;
}

/** Resolves a concrete version (latest stable/prerelease) when none was chosen. */
async function resolveLatestVersion(
  services: GetllServices,
  packageId: string,
  includePrerelease: boolean
): Promise<string | undefined> {
  try {
    const versions = await services.api.getVersions(packageId);
    const filtered = includePrerelease ? versions : versions.filter((v) => !v.includes("-"));
    return filtered[filtered.length - 1] ?? versions[versions.length - 1];
  } catch (err) {
    logger.warn(`Could not resolve latest version for ${packageId} via API: ${String(err)}`);
    return undefined;
  }
}

function summarize(outcome: OperationOutcome, verb: string, packageId: string): void {
  const ok = outcome.succeeded.length;
  const failed = outcome.failed.length;
  const skipped = outcome.skipped.length;
  if (failed === 0 && ok > 0) {
    const skippedNote = skipped > 0 ? ` (${skipped} skipped)` : "";
    vscode.window.showInformationMessage(`GetLL: ${verb} ${packageId} in ${ok} project(s)${skippedNote}.`);
  } else if (failed > 0) {
    vscode.window
      .showErrorMessage(
        `GetLL: failed to ${verb.toLowerCase()} ${packageId} in ${failed} project(s). See output for details.`,
        "Open Output"
      )
      .then((choice) => {
        if (choice === "Open Output") {
          logger.show();
        }
      });
  } else if (skipped > 0 && ok === 0) {
    vscode.window.showWarningMessage(`GetLL: nothing changed — ${skipped} project(s) skipped.`);
  }
}

/**
 * Installs (or updates to) a package version in one or more projects,
 * handling Central Package Management and confirmation policies.
 */
export async function installPackage(
  services: GetllServices,
  packageId: string,
  projectPaths: string[],
  version?: string,
  options: { isUpdate?: boolean; skipConfirm?: boolean } = {}
): Promise<OperationOutcome> {
  const config = getConfig();
  const verb = options.isUpdate ? "Update" : "Install";
  const outcome: OperationOutcome = { succeeded: [], failed: [], skipped: [] };

  if (!services.dotnet.available) {
    vscode.window.showErrorMessage("GetLL: dotnet SDK not found. Package actions are disabled.");
    return outcome;
  }
  if (projectPaths.length === 0) {
    return outcome;
  }

  // skipConfirm: the dashboard webview shows its own confirmation dialog.
  if (projectPaths.length > 1 && config.confirmBeforeMultiProjectChanges && !options.skipConfirm) {
    const names = projectPaths
      .map((p) => findProject(services, p)?.name ?? p)
      .map((n) => `  • ${n}`)
      .join("\n");
    const ok = await confirmModal(
      `${verb} ${packageId}${version ? ` ${version}` : ""} in ${projectPaths.length} projects?`,
      `The following projects will be modified:\n${names}`,
      verb
    );
    if (!ok) {
      return outcome;
    }
  }

  // Group: CPM-managed projects get props edits; others use the dotnet CLI.
  const cpmProjects: ProjectInfo[] = [];
  const cliProjects: string[] = [];
  for (const projectPath of projectPaths) {
    ensureInsideWorkspace(projectPath);
    const project = findProject(services, projectPath);
    if (project?.usesPackagesConfig) {
      outcome.skipped.push({ project: project.name, reason: "packages.config projects are read-only" });
      continue;
    }
    if (project?.usesCentralManagement && project.centralPackagesPath && config.enableCentralPackageManagementSupport) {
      cpmProjects.push(project);
    } else {
      cliProjects.push(projectPath);
    }
  }

  let cpmVersion = version;
  if (cpmProjects.length > 0 && !cpmVersion) {
    cpmVersion = await resolveLatestVersion(services, packageId, config.includePrerelease);
    if (!cpmVersion) {
      for (const project of cpmProjects) {
        outcome.failed.push({ project: project.name, error: "could not resolve latest version" });
      }
      vscode.window.showErrorMessage(
        `GetLL: could not determine the latest version of ${packageId} for centrally managed projects.`
      );
      return outcome;
    }
  }

  if (cpmProjects.length > 0) {
    const propsFiles = [...new Set(cpmProjects.map((p) => p.centralPackagesPath as string))];
    const ok = await confirmModal(
      `${verb} ${packageId} ${cpmVersion} with Central Package Management?`,
      `This will modify:\n${propsFiles.map((f) => `  • ${f}`).join("\n")}\n${cpmProjects
        .map((p) => `  • ${p.path}`)
        .join("\n")}`,
      "Modify Files"
    );
    if (!ok) {
      for (const project of cpmProjects) {
        outcome.skipped.push({ project: project.name, reason: "central props change declined" });
      }
      cpmProjects.length = 0;
    }
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `GetLL: ${verb} ${packageId}${version ? ` ${version}` : ""}`,
      cancellable: true
    },
    async (progress, token) => {
      const abort = new AbortController();
      token.onCancellationRequested(() => abort.abort());

      for (const project of cpmProjects) {
        if (token.isCancellationRequested) {
          break;
        }
        progress.report({ message: `${project.name} (central)` });
        try {
          ensureInsideWorkspace(project.centralPackagesPath as string);
          await services.central.setVersionInProps(project.centralPackagesPath as string, packageId, cpmVersion as string);
          await services.central.addReferenceToProject(project.path, packageId);
          logger.info(`${verb} ${packageId} ${cpmVersion} in ${project.name} via Central Package Management`);
          outcome.succeeded.push(project.name);
        } catch (err) {
          logger.error(`CPM ${verb.toLowerCase()} failed for ${project.name}`, err);
          outcome.failed.push({ project: project.name, error: String(err) });
        }
      }

      for (const projectPath of cliProjects) {
        if (token.isCancellationRequested) {
          break;
        }
        const project = findProject(services, projectPath);
        const name = project?.name ?? projectPath;
        progress.report({ message: name });
        const result = await services.cli.addPackage(
          projectPath,
          packageId,
          {
            version,
            source: config.defaultPackageSource || undefined,
            prerelease: !version && config.includePrerelease,
            noRestore: !(options.isUpdate ? config.restoreAfterUpdate : config.restoreAfterInstall)
          },
          { signal: abort.signal }
        );
        if (result.cancelled) {
          break;
        }
        if (result.code === 0) {
          outcome.succeeded.push(name);
        } else {
          outcome.failed.push({ project: name, error: (result.stderr || result.stdout).trim().slice(0, 500) });
        }
      }
    }
  );

  // CPM edits never restore implicitly; honor the restore settings for them.
  const wantsRestore = options.isUpdate ? config.restoreAfterUpdate : config.restoreAfterInstall;
  if (wantsRestore && cpmProjects.length > 0) {
    for (const project of cpmProjects) {
      if (outcome.succeeded.includes(project.name)) {
        await services.cli.restore(project.path);
      }
    }
  }

  summarize(outcome, verb === "Install" ? "Installed" : "Updated", packageId);
  await services.scanner.scan();
  return outcome;
}

/** Removes a package from one or more projects, with CPM cleanup prompts. */
export async function removePackage(
  services: GetllServices,
  packageId: string,
  projectPaths: string[],
  options: { skipConfirm?: boolean } = {}
): Promise<OperationOutcome> {
  const outcome: OperationOutcome = { succeeded: [], failed: [], skipped: [] };
  if (!services.dotnet.available) {
    vscode.window.showErrorMessage("GetLL: dotnet SDK not found. Package actions are disabled.");
    return outcome;
  }
  if (projectPaths.length === 0) {
    return outcome;
  }

  if (!options.skipConfirm) {
    const names = projectPaths.map((p) => findProject(services, p)?.name ?? p);
    const ok = await confirmModal(
      `Remove ${packageId} from ${names.length} project(s)?`,
      names.map((n) => `  • ${n}`).join("\n"),
      "Remove"
    );
    if (!ok) {
      return outcome;
    }
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `GetLL: Removing ${packageId}`,
      cancellable: true
    },
    async (progress, token) => {
      const abort = new AbortController();
      token.onCancellationRequested(() => abort.abort());
      for (const projectPath of projectPaths) {
        if (token.isCancellationRequested) {
          break;
        }
        ensureInsideWorkspace(projectPath);
        const project = findProject(services, projectPath);
        const name = project?.name ?? projectPath;
        if (project?.usesPackagesConfig) {
          outcome.skipped.push({ project: name, reason: "packages.config projects are read-only" });
          continue;
        }
        progress.report({ message: name });
        const result = await services.cli.removePackage(projectPath, packageId, { signal: abort.signal });
        if (result.cancelled) {
          break;
        }
        if (result.code === 0) {
          outcome.succeeded.push(name);
        } else {
          outcome.failed.push({ project: name, error: (result.stderr || result.stdout).trim().slice(0, 500) });
        }
      }
    }
  );

  const scan = await services.scanner.scan();

  // If no project references the package anymore, offer to clean up the
  // central PackageVersion entry — never delete it silently.
  const config = getConfig();
  if (config.enableCentralPackageManagementSupport) {
    const stillUsed = scan.model.projects.some((p) =>
      p.packages.some((pkg) => pkg.id.toLowerCase() === packageId.toLowerCase() && !pkg.isTransitive)
    );
    if (!stillUsed) {
      for (const propsFile of scan.model.centralPackageFiles) {
        const hasEntry = Object.keys(propsFile.packageVersions).some(
          (id) => id.toLowerCase() === packageId.toLowerCase()
        );
        if (hasEntry && isInsideAny(workspaceRoots(), propsFile.path)) {
          const cleanup = await confirmModal(
            `No project uses ${packageId} anymore. Remove its PackageVersion from Directory.Packages.props?`,
            propsFile.path,
            "Remove Entry"
          );
          if (cleanup) {
            try {
              await services.central.removeVersionFromProps(propsFile.path, packageId);
              logger.info(`Removed central PackageVersion for ${packageId} from ${propsFile.path}`);
            } catch (err) {
              logger.error(`Failed to remove central PackageVersion for ${packageId}`, err);
            }
          }
        }
      }
      await services.scanner.scan();
    }
  }

  summarize(outcome, "Removed", packageId);
  return outcome;
}

/** Runs dotnet restore for a target with progress + output channel logging. */
export async function restoreTarget(services: GetllServices, targetPath?: string, label?: string): Promise<boolean> {
  if (!services.dotnet.available) {
    vscode.window.showErrorMessage("GetLL: dotnet SDK not found. Restore is disabled.");
    return false;
  }
  if (targetPath) {
    ensureInsideWorkspace(targetPath);
  }
  let success = false;
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `GetLL: Restoring ${label ?? targetPath ?? "workspace"}`,
      cancellable: true
    },
    async (_progress, token) => {
      const abort = new AbortController();
      token.onCancellationRequested(() => abort.abort());
      const cwd = targetPath ? undefined : workspaceRoots()[0];
      const result = await services.cli.restore(targetPath, { signal: abort.signal, cwd });
      success = result.code === 0;
      if (result.cancelled) {
        return;
      }
      if (success) {
        vscode.window.showInformationMessage(`GetLL: restore completed for ${label ?? targetPath ?? "workspace"}.`);
      } else {
        vscode.window
          .showErrorMessage("GetLL: restore failed. See output for details.", "Open Output")
          .then((choice) => {
            if (choice === "Open Output") {
              logger.show();
            }
          });
      }
    }
  );
  return success;
}
