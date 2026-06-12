import { PackageSource } from "../models/sourceModel";
import { CredentialStorageService, StoredCredential } from "./credentialStorageService";
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
    private readonly scanner: WorkspaceScanner,
    private readonly credentials: CredentialStorageService
  ) {}

  async listSources(): Promise<PackageSource[]> {
    const result = await this.cli.listSources({ timeoutMs: 20000 });
    let sources: PackageSource[] = [];
    if (result.code === 0) {
      const cliSources = parseSourceListOutput(result.stdout);
      if (cliSources.length > 0) {
        const fromConfigs = this.scanner.getModel()?.sources ?? [];
        sources = cliSources.map((source) => {
          const match = fromConfigs.find((c) => c.name.toLowerCase() === source.name.toLowerCase());
          return match ? { ...source, configPath: match.configPath } : source;
        });
      }
    }
    if (sources.length === 0) {
      sources = this.scanner.getModel()?.sources ?? [];
    }
    return Promise.all(
      sources.map(async (s) => ({ ...s, hasCredentials: await this.credentials.has(s.name) }))
    );
  }

  async addSource(name: string, url: string): Promise<void> {
    const result = await this.cli.addSource(url, name);
    if (result.code !== 0) {
      throw new Error(result.stderr || result.stdout || "dotnet nuget add source failed");
    }
  }

  async setCredential(sourceName: string, cred: StoredCredential): Promise<void> {
    await this.credentials.set(sourceName, cred);
  }

  async removeCredential(sourceName: string): Promise<void> {
    await this.credentials.delete(sourceName);
  }

  getCredential(sourceName: string): Promise<StoredCredential | null> {
    return this.credentials.get(sourceName);
  }

  async removeSource(name: string): Promise<void> {
    const result = await this.cli.removeSource(name);
    if (result.code !== 0) {
      throw new Error(result.stderr || result.stdout || "dotnet nuget remove source failed");
    }
    await this.credentials.delete(name);
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
