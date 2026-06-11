import * as vscode from "vscode";
import { getConfig } from "../config";
import { ProjectInfo } from "../models/projectModel";
import { WorkspaceScanner } from "../services/workspaceScanner";
import { BaseTreeProvider, GetllTreeItem, packageItem } from "./getllTreeProvider";

export class ProjectTreeProvider extends BaseTreeProvider {
  constructor(private readonly scanner: WorkspaceScanner) {
    super();
    scanner.onDidChangeModel(() => this.refresh());
  }

  protected getRootItems(): GetllTreeItem[] {
    const model = this.scanner.getModel();
    if (!model || model.projects.length === 0) {
      return [];
    }
    return model.projects.map((project) => this.projectItem(project));
  }

  private projectItem(project: ProjectInfo): GetllTreeItem {
    const item = new GetllTreeItem(
      project.name,
      project.packages.length > 0
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None
    );
    item.contextValue = "project";
    item.projectPath = project.path;
    item.projectName = project.name;
    item.iconPath = new vscode.ThemeIcon("symbol-class");
    const badges: string[] = [];
    if (project.targetFrameworks.length > 0) {
      badges.push(project.targetFrameworks.join(", "));
    }
    if (project.usesCentralManagement) {
      badges.push("CPM");
    }
    if (project.usesPackagesConfig) {
      badges.push("packages.config (read-only)");
    }
    item.description = badges.join(" · ");
    item.tooltip = project.path;
    item.children = this.packageChildren(project);
    return item;
  }

  private packageChildren(project: ProjectInfo): GetllTreeItem[] {
    const showTransitive = getConfig().showTransitivePackages;
    return project.packages
      .filter((pkg) => showTransitive || !pkg.isTransitive)
      .map((pkg) =>
        packageItem({
          id: pkg.id,
          version: pkg.version ?? pkg.resolvedVersion,
          projectPath: project.path,
          projectName: project.name,
          contextValue: "package",
          description: pkg.version ?? pkg.resolvedVersion ?? "(central)",
          tooltip: `${pkg.id} ${pkg.version ?? pkg.resolvedVersion ?? ""}\n${project.name}`
        })
      );
  }
}
