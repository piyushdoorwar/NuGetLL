import {
  DeprecatedPackage,
  OutdatedPackage,
  PackageSearchResult,
  VulnerablePackage
} from "../models/packageModel";
import { PackageSource } from "../models/sourceModel";
import { CommandResult, runCommand, RunOptions } from "./commandRunner";

export type ListPackageMode = "outdated" | "vulnerable" | "deprecated" | "all";

// ---------------------------------------------------------------------------
// Pure argument builders (unit-tested; keep them side-effect free).
// ---------------------------------------------------------------------------

export function buildAddPackageArgs(
  projectPath: string,
  packageId: string,
  options: { version?: string; source?: string; prerelease?: boolean; noRestore?: boolean } = {}
): string[] {
  const args = ["add", projectPath, "package", packageId];
  if (options.version) {
    args.push("--version", options.version);
  } else if (options.prerelease) {
    args.push("--prerelease");
  }
  if (options.source) {
    args.push("--source", options.source);
  }
  if (options.noRestore) {
    args.push("--no-restore");
  }
  return args;
}

export function buildRemovePackageArgs(projectPath: string, packageId: string): string[] {
  return ["remove", projectPath, "package", packageId];
}

export function buildRestoreArgs(targetPath?: string): string[] {
  return targetPath ? ["restore", targetPath] : ["restore"];
}

export function buildListPackageArgs(
  targetPath: string,
  mode: ListPackageMode,
  options: { includeTransitive?: boolean; includePrerelease?: boolean } = {}
): string[] {
  const args = ["list", targetPath, "package", "--format", "json"];
  if (mode === "outdated") {
    args.push("--outdated");
  } else if (mode === "vulnerable") {
    args.push("--vulnerable");
  } else if (mode === "deprecated") {
    args.push("--deprecated");
  }
  if (options.includeTransitive) {
    args.push("--include-transitive");
  }
  if (options.includePrerelease && mode === "outdated") {
    args.push("--include-prerelease");
  }
  return args;
}

export function buildSearchArgs(
  query: string,
  options: { prerelease?: boolean; take?: number; source?: string; exactMatch?: boolean } = {}
): string[] {
  const args = ["package", "search", query, "--format", "json"];
  if (options.prerelease) {
    args.push("--prerelease");
  }
  if (options.take) {
    args.push("--take", String(options.take));
  }
  if (options.source) {
    args.push("--source", options.source);
  }
  if (options.exactMatch) {
    args.push("--exact-match");
  }
  return args;
}

// ---------------------------------------------------------------------------
// Pure output parsers.
// ---------------------------------------------------------------------------

interface ListPackageJsonEntry {
  id: string;
  requestedVersion?: string;
  resolvedVersion: string;
  latestVersion?: string;
  deprecationReasons?: string[];
  alternativePackage?: { id: string; versionRange?: string };
  vulnerabilities?: { severity: string; advisoryurl?: string; advisoryUrl?: string }[];
}

interface ListPackageJsonFramework {
  framework: string;
  topLevelPackages?: ListPackageJsonEntry[];
  transitivePackages?: ListPackageJsonEntry[];
}

interface ListPackageJsonProject {
  path: string;
  frameworks?: ListPackageJsonFramework[];
}

interface ListPackageJson {
  version?: number;
  projects?: ListPackageJsonProject[];
}

function projectNameFromPath(projectPath: string): string {
  const base = projectPath.replace(/\\/g, "/").split("/").pop() ?? projectPath;
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(0, dot) : base;
}

function entriesOf(
  project: ListPackageJsonProject
): { entry: ListPackageJsonEntry; transitive: boolean }[] {
  const seen = new Set<string>();
  const result: { entry: ListPackageJsonEntry; transitive: boolean }[] = [];
  for (const fw of project.frameworks ?? []) {
    for (const entry of fw.topLevelPackages ?? []) {
      if (!seen.has(`t:${entry.id}`)) {
        seen.add(`t:${entry.id}`);
        result.push({ entry, transitive: false });
      }
    }
    for (const entry of fw.transitivePackages ?? []) {
      if (!seen.has(`x:${entry.id}`)) {
        seen.add(`x:${entry.id}`);
        result.push({ entry, transitive: true });
      }
    }
  }
  return result;
}

function tryParseJson(stdout: string): ListPackageJson | null {
  // `dotnet list package` may print informational lines before the JSON body.
  const start = stdout.indexOf("{");
  if (start < 0) {
    return null;
  }
  try {
    return JSON.parse(stdout.slice(start)) as ListPackageJson;
  } catch {
    return null;
  }
}

export function parseOutdatedJson(stdout: string): OutdatedPackage[] | null {
  const doc = tryParseJson(stdout);
  if (!doc) {
    return null;
  }
  const result: OutdatedPackage[] = [];
  for (const project of doc.projects ?? []) {
    const projectName = projectNameFromPath(project.path);
    for (const { entry, transitive } of entriesOf(project)) {
      if (!entry.latestVersion || entry.latestVersion === entry.resolvedVersion) {
        continue;
      }
      result.push({
        id: entry.id,
        projectName,
        projectPath: project.path,
        requestedVersion: entry.requestedVersion,
        resolvedVersion: entry.resolvedVersion,
        latestVersion: entry.latestVersion,
        isTransitive: transitive
      });
    }
  }
  return result;
}

export function parseVulnerableJson(stdout: string): VulnerablePackage[] | null {
  const doc = tryParseJson(stdout);
  if (!doc) {
    return null;
  }
  const result: VulnerablePackage[] = [];
  for (const project of doc.projects ?? []) {
    const projectName = projectNameFromPath(project.path);
    for (const { entry, transitive } of entriesOf(project)) {
      for (const vuln of entry.vulnerabilities ?? []) {
        result.push({
          id: entry.id,
          projectName,
          projectPath: project.path,
          resolvedVersion: entry.resolvedVersion,
          severity: vuln.severity,
          advisoryUrl: vuln.advisoryurl ?? vuln.advisoryUrl ?? "",
          isTransitive: transitive
        });
      }
    }
  }
  return result;
}

export function parseDeprecatedJson(stdout: string): DeprecatedPackage[] | null {
  const doc = tryParseJson(stdout);
  if (!doc) {
    return null;
  }
  const result: DeprecatedPackage[] = [];
  for (const project of doc.projects ?? []) {
    const projectName = projectNameFromPath(project.path);
    for (const { entry } of entriesOf(project)) {
      if (!entry.deprecationReasons || entry.deprecationReasons.length === 0) {
        continue;
      }
      result.push({
        id: entry.id,
        projectName,
        projectPath: project.path,
        resolvedVersion: entry.resolvedVersion,
        reasons: entry.deprecationReasons,
        alternativeId: entry.alternativePackage?.id,
        alternativeVersionRange: entry.alternativePackage?.versionRange
      });
    }
  }
  return result;
}

/** Parses the default (detailed) output of `dotnet nuget list source`. */
export function parseSourceListOutput(stdout: string): PackageSource[] {
  const sources: PackageSource[] = [];
  const lines = stdout.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const match = /^\s*\d+\.\s+(.+?)\s+\[(Enabled|Disabled)\]\s*$/.exec(lines[i]);
    if (match) {
      const url = (lines[i + 1] ?? "").trim();
      sources.push({
        name: match[1],
        url,
        enabled: match[2] === "Enabled"
      });
    }
  }
  return sources;
}

interface DotnetSearchJson {
  searchResult?: {
    sourceName: string;
    packages?: {
      id: string;
      latestVersion?: string;
      version?: string;
      totalDownloads?: number;
      owners?: string | string[];
      description?: string;
    }[];
  }[];
}

export function parseSearchJson(stdout: string): PackageSearchResult[] | null {
  const start = stdout.indexOf("{");
  if (start < 0) {
    return null;
  }
  let doc: DotnetSearchJson;
  try {
    doc = JSON.parse(stdout.slice(start)) as DotnetSearchJson;
  } catch {
    return null;
  }
  const results: PackageSearchResult[] = [];
  for (const sourceResult of doc.searchResult ?? []) {
    for (const pkg of sourceResult.packages ?? []) {
      results.push({
        id: pkg.id,
        version: pkg.latestVersion ?? pkg.version ?? "",
        description: pkg.description,
        totalDownloads: pkg.totalDownloads,
        authors: [],
        owners:
          typeof pkg.owners === "string"
            ? pkg.owners.split(",").map((o) => o.trim()).filter(Boolean)
            : pkg.owners,
        tags: [],
        source: sourceResult.sourceName
      });
    }
  }
  return results;
}

/** Extracts the SDK version from `dotnet --version` output. */
export function parseSdkVersion(stdout: string): string | undefined {
  const line = stdout.trim().split(/\r?\n/)[0]?.trim();
  return line && /^\d+\.\d+/.test(line) ? line : undefined;
}

// ---------------------------------------------------------------------------
// Service wrapping the dotnet CLI.
// ---------------------------------------------------------------------------

export interface CliLogSink {
  (line: string): void;
}

export class NugetCliService {
  constructor(private readonly log: CliLogSink, private readonly dotnetPath = "dotnet") {}

  run(args: string[], options: RunOptions = {}): Promise<CommandResult> {
    return runCommand(this.dotnetPath, args, { ...options, onLog: this.log });
  }

  async detectSdk(): Promise<{ available: boolean; version?: string }> {
    const result = await runCommand(this.dotnetPath, ["--version"], { timeoutMs: 15000 });
    if (result.spawnError || result.code !== 0) {
      return { available: false };
    }
    return { available: true, version: parseSdkVersion(result.stdout) };
  }

  addPackage(
    projectPath: string,
    packageId: string,
    options: { version?: string; source?: string; prerelease?: boolean; noRestore?: boolean } = {},
    runOptions: RunOptions = {}
  ): Promise<CommandResult> {
    return this.run(buildAddPackageArgs(projectPath, packageId, options), runOptions);
  }

  removePackage(projectPath: string, packageId: string, runOptions: RunOptions = {}): Promise<CommandResult> {
    return this.run(buildRemovePackageArgs(projectPath, packageId), runOptions);
  }

  restore(targetPath?: string, runOptions: RunOptions = {}): Promise<CommandResult> {
    return this.run(buildRestoreArgs(targetPath), runOptions);
  }

  listPackages(
    targetPath: string,
    mode: ListPackageMode,
    options: { includeTransitive?: boolean; includePrerelease?: boolean } = {},
    runOptions: RunOptions = {}
  ): Promise<CommandResult> {
    return this.run(buildListPackageArgs(targetPath, mode, options), runOptions);
  }

  search(
    query: string,
    options: { prerelease?: boolean; take?: number; source?: string; exactMatch?: boolean } = {},
    runOptions: RunOptions = {}
  ): Promise<CommandResult> {
    return this.run(buildSearchArgs(query, options), runOptions);
  }

  listSources(runOptions: RunOptions = {}): Promise<CommandResult> {
    return this.run(["nuget", "list", "source"], runOptions);
  }

  addSource(url: string, name: string, runOptions: RunOptions = {}): Promise<CommandResult> {
    return this.run(["nuget", "add", "source", url, "--name", name], runOptions);
  }

  removeSource(name: string, runOptions: RunOptions = {}): Promise<CommandResult> {
    return this.run(["nuget", "remove", "source", name], runOptions);
  }

  enableSource(name: string, runOptions: RunOptions = {}): Promise<CommandResult> {
    return this.run(["nuget", "enable", "source", name], runOptions);
  }

  disableSource(name: string, runOptions: RunOptions = {}): Promise<CommandResult> {
    return this.run(["nuget", "disable", "source", name], runOptions);
  }

  updateSource(name: string, url: string, runOptions: RunOptions = {}): Promise<CommandResult> {
    return this.run(["nuget", "update", "source", name, "--source", url], runOptions);
  }
}
