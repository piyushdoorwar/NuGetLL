import * as vscode from "vscode";
import { getConfig } from "../config";
import { ProjectInfo } from "../models/projectModel";
import { GetllServices } from "../services/container";
import { logger } from "../utils/logger";

/** Multi-select (or single-select) project picker. */
export async function pickProjects(
  services: GetllServices,
  options: { title: string; projects?: ProjectInfo[]; preselect?: string[]; single?: boolean } = { title: "Select projects" }
): Promise<ProjectInfo[] | undefined> {
  const all = options.projects ?? services.scanner.getModel()?.projects ?? [];
  const writable = all.filter((p) => !p.usesPackagesConfig);
  if (writable.length === 0) {
    vscode.window.showWarningMessage("NeuGetLL: no writable .NET projects found in this workspace.");
    return undefined;
  }
  if (writable.length === 1 && options.single) {
    return writable;
  }
  type Item = vscode.QuickPickItem & { project: ProjectInfo };
  const items: Item[] = writable.map((project) => ({
    label: project.name,
    description: project.targetFrameworks.join(", "),
    detail: project.usesCentralManagement ? "$(symbol-namespace) Central Package Management" : undefined,
    picked: options.preselect?.includes(project.path),
    project
  }));
  if (options.single) {
    const picked = await vscode.window.showQuickPick(items, { title: options.title, placeHolder: "Select a project" });
    return picked ? [picked.project] : undefined;
  }
  const picked = await vscode.window.showQuickPick(items, {
    title: options.title,
    placeHolder: "Select one or more projects",
    canPickMany: true
  });
  return picked && picked.length > 0 ? picked.map((i) => i.project) : undefined;
}

/** Asks for a query, searches the configured feed, and returns the chosen package id. */
export async function pickPackage(services: GetllServices): Promise<string | undefined> {
  const query = await vscode.window.showInputBox({
    title: "Add NuGet Package",
    prompt: "Search nuget.org (or your configured source)",
    placeHolder: "e.g. Serilog.AspNetCore"
  });
  if (!query) {
    return undefined;
  }
  const config = getConfig();
  try {
    const results = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: `NeuGetLL: Searching "${query}"...` },
      () => services.api.searchPackages(query, { includePrerelease: config.includePrerelease, take: config.maxSearchResults })
    );
    if (results.length === 0) {
      vscode.window.showInformationMessage(`NeuGetLL: no packages found for "${query}".`);
      return undefined;
    }
    const picked = await vscode.window.showQuickPick(
      results.map((r) => ({
        label: r.id,
        description: r.version,
        detail: r.description?.slice(0, 120)
      })),
      { title: "Select Package", placeHolder: query, matchOnDetail: true }
    );
    return picked?.label;
  } catch (err) {
    logger.error("Package search failed", err);
    // Network/API failure: let the user type the exact id instead.
    return vscode.window.showInputBox({
      title: "Search unavailable — enter exact package id",
      value: query,
      prompt: "The NuGet API could not be reached. Enter the exact package id to install."
    });
  }
}

/**
 * Version picker: latest stable / latest prerelease / pick from list / type one.
 * Returns undefined when cancelled; returns "" to mean "let dotnet pick latest stable".
 */
export async function pickVersion(
  services: GetllServices,
  packageId: string,
  options: { currentVersion?: string } = {}
): Promise<string | undefined> {
  let versions: string[] = [];
  try {
    versions = await services.api.getVersions(packageId);
  } catch (err) {
    logger.warn(`Could not list versions for ${packageId}: ${String(err)}`);
  }
  const stable = [...versions].reverse().find((v) => !v.includes("-"));
  const prerelease = [...versions].reverse().find((v) => v.includes("-"));

  type Item = vscode.QuickPickItem & { value: string | "__pick__" | "__custom__" };
  const items: Item[] = [];
  items.push({ label: `Latest stable${stable ? ` (${stable})` : ""}`, value: stable ?? "" });
  if (prerelease) {
    items.push({ label: `Latest prerelease (${prerelease})`, value: prerelease });
  }
  if (versions.length > 0) {
    items.push({ label: "Pick a specific version...", value: "__pick__" });
  }
  items.push({ label: "Type a version...", value: "__custom__" });

  const picked = await vscode.window.showQuickPick(items, {
    title: `Version for ${packageId}`,
    placeHolder: options.currentVersion ? `Current: ${options.currentVersion}` : undefined
  });
  if (!picked) {
    return undefined;
  }
  if (picked.value === "__pick__") {
    const fromList = await vscode.window.showQuickPick(
      [...versions].reverse().map((v) => ({ label: v, description: v === options.currentVersion ? "current" : undefined })),
      { title: `Select version of ${packageId}` }
    );
    return fromList?.label;
  }
  if (picked.value === "__custom__") {
    return vscode.window.showInputBox({
      title: `Version for ${packageId}`,
      placeHolder: "e.g. 8.0.1",
      validateInput: (value) => (/^[A-Za-z0-9_.+-]+$/.test(value) ? undefined : "Invalid version text")
    });
  }
  return picked.value;
}
