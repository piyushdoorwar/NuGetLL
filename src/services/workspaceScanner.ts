import * as fs from "fs/promises";
import * as path from "path";
import { ProjectInfo, ProjectKind } from "../models/projectModel";
import { PackageSource } from "../models/sourceModel";
import { CentralPackagesFile, WorkspaceModel } from "../models/workspaceModel";
import { ancestorDirs, fileNameWithoutExtension } from "../utils/pathUtils";
import {
  parseCentralPackagesProps,
  parseNugetConfig,
  parsePackagesConfig,
  parseProjectFile
} from "./projectParser";

const PROJECT_EXTENSIONS: Record<string, ProjectKind> = {
  ".csproj": "csproj",
  ".fsproj": "fsproj",
  ".vbproj": "vbproj"
};

export interface ScanFileSet {
  solutions: string[];
  projects: string[];
  centralProps: string[];
  buildProps: string[];
  nugetConfigs: string[];
  packagesConfigs: string[];
}

/** Recursively collects relevant files under `root`, skipping excluded folder names. */
export async function collectFiles(root: string, excludedFolders: string[]): Promise<ScanFileSet> {
  const excluded = new Set(excludedFolders.map((f) => f.toLowerCase()));
  const found: ScanFileSet = {
    solutions: [],
    projects: [],
    centralProps: [],
    buildProps: [],
    nugetConfigs: [],
    packagesConfigs: []
  };

  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return; // unreadable directory — skip silently
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!excluded.has(entry.name.toLowerCase())) {
          await walk(full);
        }
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      const lower = entry.name.toLowerCase();
      const ext = path.extname(lower);
      if (ext === ".sln" || ext === ".slnf" || ext === ".slnx") {
        found.solutions.push(full);
      } else if (ext in PROJECT_EXTENSIONS) {
        found.projects.push(full);
      } else if (lower === "directory.packages.props") {
        found.centralProps.push(full);
      } else if (lower === "directory.build.props") {
        found.buildProps.push(full);
      } else if (lower === "nuget.config") {
        found.nugetConfigs.push(full);
      } else if (lower === "packages.config") {
        found.packagesConfigs.push(full);
      }
    }
  }

  await walk(root);
  return found;
}

async function readTextOrNull(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

export interface ScanIssue {
  file: string;
  message: string;
}

export interface ScanResult {
  model: WorkspaceModel;
  issues: ScanIssue[];
}

/**
 * Scans the given workspace folders and builds the in-memory model.
 * Pure Node implementation (fs only) so it is unit-testable outside VS Code.
 */
export async function scanWorkspaceFolders(
  folders: string[],
  excludedFolders: string[]
): Promise<ScanResult> {
  const issues: ScanIssue[] = [];
  const solutions: string[] = [];
  const projects: ProjectInfo[] = [];
  const centralPackageFiles: CentralPackagesFile[] = [];
  const nugetConfigPaths: string[] = [];
  const sources: PackageSource[] = [];

  for (const folder of folders) {
    const files = await collectFiles(folder, excludedFolders);
    solutions.push(...files.solutions);
    nugetConfigPaths.push(...files.nugetConfigs);

    const centralByDir = new Map<string, CentralPackagesFile>();
    for (const propsPath of files.centralProps) {
      const content = await readTextOrNull(propsPath);
      const parsed = content !== null ? parseCentralPackagesProps(content) : null;
      if (!parsed) {
        issues.push({ file: propsPath, message: "Could not parse Directory.Packages.props (invalid XML?)" });
        continue;
      }
      const file: CentralPackagesFile = {
        path: propsPath,
        managementEnabled: parsed.managementEnabled,
        packageVersions: parsed.packageVersions
      };
      centralPackageFiles.push(file);
      centralByDir.set(path.dirname(propsPath), file);
    }

    for (const configPath of files.nugetConfigs) {
      const content = await readTextOrNull(configPath);
      const parsed = content !== null ? parseNugetConfig(content, configPath) : null;
      if (!parsed) {
        issues.push({ file: configPath, message: "Could not parse NuGet.Config (invalid XML?)" });
        continue;
      }
      for (const source of parsed) {
        if (!sources.some((s) => s.name.toLowerCase() === source.name.toLowerCase())) {
          sources.push(source);
        }
      }
    }

    const packagesConfigDirs = new Set(files.packagesConfigs.map((p) => path.dirname(p)));

    for (const projectPath of files.projects) {
      const content = await readTextOrNull(projectPath);
      const parsed = content !== null ? parseProjectFile(content) : null;
      if (!parsed) {
        issues.push({ file: projectPath, message: "Could not parse project file (invalid XML?)" });
        continue;
      }

      // Nearest Directory.Packages.props in ancestor directories governs CPM.
      let central: CentralPackagesFile | undefined;
      for (const dir of ancestorDirs(projectPath, folder)) {
        const candidate = centralByDir.get(dir);
        if (candidate) {
          central = candidate;
          break;
        }
      }
      const usesCentralManagement =
        parsed.managePackageVersionsCentrally ?? (central?.managementEnabled ?? false);

      const project: ProjectInfo = {
        name: fileNameWithoutExtension(projectPath),
        path: projectPath,
        kind: PROJECT_EXTENSIONS[path.extname(projectPath).toLowerCase()],
        sdkStyle: parsed.sdkStyle,
        usesPackagesConfig: packagesConfigDirs.has(path.dirname(projectPath)),
        targetFrameworks: parsed.targetFrameworks,
        packages: parsed.packages,
        usesCentralManagement: usesCentralManagement && !!central,
        centralPackagesPath: usesCentralManagement ? central?.path : undefined
      };

      if (project.usesPackagesConfig && project.packages.length === 0) {
        const pkgConfigPath = path.join(path.dirname(projectPath), "packages.config");
        const pkgContent = await readTextOrNull(pkgConfigPath);
        const pkgParsed = pkgContent !== null ? parsePackagesConfig(pkgContent) : null;
        if (pkgParsed) {
          project.packages = pkgParsed;
        } else if (pkgContent !== null) {
          issues.push({ file: pkgConfigPath, message: "Could not parse packages.config (invalid XML?)" });
        }
      }

      // Resolve CPM versions for display.
      if (project.usesCentralManagement && central) {
        for (const pkg of project.packages) {
          if (!pkg.version && central.packageVersions[pkg.id]) {
            pkg.resolvedVersion = central.packageVersions[pkg.id];
          }
        }
      }

      projects.push(project);
    }
  }

  projects.sort((a, b) => a.name.localeCompare(b.name));

  return {
    model: {
      folders,
      solutions,
      projects,
      centralPackageFiles,
      nugetConfigPaths,
      sources,
      scannedAt: Date.now()
    },
    issues
  };
}

export type ModelListener = (model: WorkspaceModel) => void;

/**
 * Stateful scanner with change notification. Folder/exclusion lookups are
 * injected so the class stays free of the `vscode` module and unit-testable.
 */
export class WorkspaceScanner {
  private model: WorkspaceModel | undefined;
  private listeners: ModelListener[] = [];
  private scanning: Promise<ScanResult> | undefined;

  constructor(
    private readonly getFolders: () => string[],
    private readonly getExcludedFolders: () => string[]
  ) {}

  getModel(): WorkspaceModel | undefined {
    return this.model;
  }

  onDidChangeModel(listener: ModelListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /** Runs a scan; concurrent calls share the in-flight scan. */
  async scan(): Promise<ScanResult> {
    if (this.scanning) {
      return this.scanning;
    }
    this.scanning = scanWorkspaceFolders(this.getFolders(), this.getExcludedFolders())
      .then((result) => {
        this.model = result.model;
        for (const listener of this.listeners) {
          listener(result.model);
        }
        return result;
      })
      .finally(() => {
        this.scanning = undefined;
      });
    return this.scanning;
  }
}
