import { ProjectInfo } from "./projectModel";
import { PackageSource } from "./sourceModel";

export interface CentralPackagesFile {
  /** Absolute path of the Directory.Packages.props file. */
  path: string;
  /** True when ManagePackageVersionsCentrally is enabled (or PackageVersion entries exist). */
  managementEnabled: boolean;
  /** PackageVersion entries: package id -> version. */
  packageVersions: Record<string, string>;
}

export interface WorkspaceModel {
  folders: string[];
  solutions: string[];
  projects: ProjectInfo[];
  centralPackageFiles: CentralPackagesFile[];
  nugetConfigPaths: string[];
  /** Sources read from NuGet.Config files found in the workspace. */
  sources: PackageSource[];
  dotnetSdkVersion?: string;
  scannedAt: number;
}

export function emptyWorkspaceModel(): WorkspaceModel {
  return {
    folders: [],
    solutions: [],
    projects: [],
    centralPackageFiles: [],
    nugetConfigPaths: [],
    sources: [],
    scannedAt: Date.now()
  };
}
