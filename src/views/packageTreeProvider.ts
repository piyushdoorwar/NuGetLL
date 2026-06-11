import * as vscode from "vscode";
import { ResultsStore } from "../services/container";
import { WorkspaceScanner } from "../services/workspaceScanner";
import { BaseTreeProvider, GetllTreeItem, infoItem, packageItem } from "./getllTreeProvider";

export type PackageTreeMode = "installed" | "outdated" | "vulnerable";

/**
 * Backs the Installed, Outdated, and Vulnerable views. Installed aggregates
 * across projects; outdated/vulnerable render the latest check results.
 */
export class PackageTreeProvider extends BaseTreeProvider {
  constructor(
    private readonly mode: PackageTreeMode,
    private readonly scanner: WorkspaceScanner,
    private readonly results: ResultsStore
  ) {
    super();
    scanner.onDidChangeModel(() => this.refresh());
    results.onDidChange(() => this.refresh());
  }

  protected getRootItems(): GetllTreeItem[] {
    switch (this.mode) {
      case "installed":
        return this.installedItems();
      case "outdated":
        return this.outdatedItems();
      case "vulnerable":
        return this.vulnerableItems();
    }
  }

  private installedItems(): GetllTreeItem[] {
    const model = this.scanner.getModel();
    if (!model) {
      return [];
    }
    const byId = new Map<string, { versions: Set<string>; projects: GetllTreeItem[] }>();
    for (const project of model.projects) {
      for (const pkg of project.packages) {
        if (pkg.isTransitive) {
          continue;
        }
        let entry = byId.get(pkg.id);
        if (!entry) {
          entry = { versions: new Set(), projects: [] };
          byId.set(pkg.id, entry);
        }
        const version = pkg.version ?? pkg.resolvedVersion;
        if (version) {
          entry.versions.add(version);
        }
        const child = new GetllTreeItem(project.name);
        child.description = version;
        child.iconPath = new vscode.ThemeIcon("symbol-class");
        child.contextValue = "packageProject";
        child.packageId = pkg.id;
        child.version = version;
        child.projectPath = project.path;
        child.projectName = project.name;
        entry.projects.push(child);
      }
    }
    if (byId.size === 0) {
      return model.projects.length > 0 ? [infoItem("No packages installed")] : [];
    }
    return [...byId.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, entry]) => {
        const item = packageItem({
          id,
          version: [...entry.versions].join(", "),
          contextValue: "installedPackage",
          description: [...entry.versions].join(", "),
          tooltip: `${id}\nUsed in ${entry.projects.length} project(s)`
        });
        item.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
        item.children = entry.projects;
        return item;
      });
  }

  private outdatedItems(): GetllTreeItem[] {
    const outdated = this.results.outdated;
    if (!outdated) {
      return [];
    }
    if (outdated.length === 0) {
      return [infoItem("All packages are up to date", "check")];
    }
    return outdated.map((pkg) =>
      packageItem({
        id: pkg.id,
        version: pkg.resolvedVersion,
        projectPath: pkg.projectPath,
        projectName: pkg.projectName,
        contextValue: "outdatedPackage",
        description: `${pkg.resolvedVersion} → ${pkg.latestVersion} · ${pkg.projectName}`,
        tooltip: `${pkg.id}\n${pkg.projectName}\nCurrent: ${pkg.resolvedVersion}\nLatest: ${pkg.latestVersion}`,
        icon: new vscode.ThemeIcon("arrow-circle-up")
      })
    );
  }

  private vulnerableItems(): GetllTreeItem[] {
    const vulnerable = this.results.vulnerable;
    if (!vulnerable) {
      return [];
    }
    if (vulnerable.length === 0) {
      return [infoItem("No known vulnerabilities", "check")];
    }
    return vulnerable.map((pkg) => {
      const item = packageItem({
        id: pkg.id,
        version: pkg.resolvedVersion,
        projectPath: pkg.projectPath,
        projectName: pkg.projectName,
        contextValue: "vulnerablePackage",
        description: `${pkg.severity} · ${pkg.resolvedVersion} · ${pkg.projectName}`,
        tooltip: `${pkg.id} ${pkg.resolvedVersion}\nSeverity: ${pkg.severity}\n${pkg.advisoryUrl}`,
        icon: new vscode.ThemeIcon("shield", new vscode.ThemeColor("errorForeground"))
      });
      item.advisoryUrl = pkg.advisoryUrl;
      return item;
    });
  }
}
