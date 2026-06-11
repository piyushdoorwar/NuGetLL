import * as vscode from "vscode";
import { PackageSource } from "../models/sourceModel";
import { PackageSourceService } from "../services/packageSourceService";
import { BaseTreeProvider, GetllTreeItem, infoItem } from "./getllTreeProvider";

export class SourceTreeProvider extends BaseTreeProvider {
  private cached: PackageSource[] | undefined;

  constructor(private readonly sources: PackageSourceService) {
    super();
  }

  invalidate(): void {
    this.cached = undefined;
    this.refresh();
  }

  protected async getRootItems(): Promise<GetllTreeItem[]> {
    if (!this.cached) {
      try {
        this.cached = await this.sources.listSources();
      } catch {
        this.cached = [];
      }
    }
    if (this.cached.length === 0) {
      return [infoItem("No package sources found")];
    }
    return this.cached.map((source) => {
      const item = new GetllTreeItem(source.name);
      item.description = source.url;
      item.tooltip = `${source.name}\n${source.url}\n${source.enabled ? "Enabled" : "Disabled"}${source.configPath ? `\n${source.configPath}` : ""}`;
      item.contextValue = source.enabled ? "sourceEnabled" : "sourceDisabled";
      item.iconPath = new vscode.ThemeIcon(
        source.enabled ? "globe" : "circle-slash",
        source.enabled ? undefined : new vscode.ThemeColor("disabledForeground")
      );
      item.source = source;
      return item;
    });
  }
}
