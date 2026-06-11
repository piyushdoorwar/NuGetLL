import { PackageSource } from "../models/sourceModel";
import { NugetCliService, parseSourceListOutput } from "./nugetCliService";
import { WorkspaceScanner } from "./workspaceScanner";

/**
 * Lists and manages NuGet package sources. The dotnet CLI is the source of
 * truth (it merges machine/user/workspace NuGet.Config files); when the CLI
 * is unavailable we fall back to sources parsed from workspace NuGet.Config.
 */
export class PackageSourceService {
  constructor(
    private readonly cli: NugetCliService,
    private readonly scanner: WorkspaceScanner
  ) {}

  async listSources(): Promise<PackageSource[]> {
    const result = await this.cli.listSources({ timeoutMs: 20000 });
    if (result.code === 0) {
      const cliSources = parseSourceListOutput(result.stdout);
      if (cliSources.length > 0) {
        const fromConfigs = this.scanner.getModel()?.sources ?? [];
        return cliSources.map((source) => {
          const match = fromConfigs.find((c) => c.name.toLowerCase() === source.name.toLowerCase());
          return match ? { ...source, configPath: match.configPath } : source;
        });
      }
    }
    return this.scanner.getModel()?.sources ?? [];
  }

  async addSource(name: string, url: string): Promise<void> {
    const result = await this.cli.addSource(url, name);
    if (result.code !== 0) {
      throw new Error(result.stderr || result.stdout || "dotnet nuget add source failed");
    }
  }

  async removeSource(name: string): Promise<void> {
    const result = await this.cli.removeSource(name);
    if (result.code !== 0) {
      throw new Error(result.stderr || result.stdout || "dotnet nuget remove source failed");
    }
  }

  async enableSource(name: string): Promise<void> {
    const result = await this.cli.enableSource(name);
    if (result.code !== 0) {
      throw new Error(result.stderr || result.stdout || "dotnet nuget enable source failed");
    }
  }

  async disableSource(name: string): Promise<void> {
    const result = await this.cli.disableSource(name);
    if (result.code !== 0) {
      throw new Error(result.stderr || result.stdout || "dotnet nuget disable source failed");
    }
  }

  async updateSource(name: string, url: string): Promise<void> {
    const result = await this.cli.updateSource(name, url);
    if (result.code !== 0) {
      throw new Error(result.stderr || result.stdout || "dotnet nuget update source failed");
    }
  }
}
