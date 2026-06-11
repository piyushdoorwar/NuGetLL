import * as vscode from "vscode";
import { PackageSource } from "../models/sourceModel";

/**
 * Shared tree item used by every GetLL view. Command handlers read the
 * optional payload fields to know what was clicked.
 */
export class GetllTreeItem extends vscode.TreeItem {
  packageId?: string;
  version?: string;
  projectPath?: string;
  projectName?: string;
  advisoryUrl?: string;
  source?: PackageSource;
  children?: GetllTreeItem[];

  constructor(label: string, collapsibleState = vscode.TreeItemCollapsibleState.None) {
    super(label, collapsibleState);
  }
}

/** Base class providing the change-event plumbing all GetLL trees share. */
export abstract class BaseTreeProvider implements vscode.TreeDataProvider<GetllTreeItem> {
  private readonly emitter = new vscode.EventEmitter<GetllTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this.emitter.event;

  refresh(): void {
    this.emitter.fire();
  }

  getTreeItem(element: GetllTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: GetllTreeItem): vscode.ProviderResult<GetllTreeItem[]> {
    if (element) {
      return element.children ?? [];
    }
    return this.getRootItems();
  }

  protected abstract getRootItems(): vscode.ProviderResult<GetllTreeItem[]>;
}

export function packageItem(options: {
  id: string;
  version?: string;
  projectPath?: string;
  projectName?: string;
  contextValue: string;
  description?: string;
  tooltip?: string;
  icon?: vscode.ThemeIcon;
}): GetllTreeItem {
  const item = new GetllTreeItem(options.id);
  item.packageId = options.id;
  item.version = options.version;
  item.projectPath = options.projectPath;
  item.projectName = options.projectName;
  item.contextValue = options.contextValue;
  item.description = options.description ?? options.version;
  item.tooltip = options.tooltip;
  item.iconPath = options.icon ?? new vscode.ThemeIcon("package");
  return item;
}

export function infoItem(label: string, icon = "info"): GetllTreeItem {
  const item = new GetllTreeItem(label);
  item.iconPath = new vscode.ThemeIcon(icon);
  item.contextValue = "info";
  return item;
}
