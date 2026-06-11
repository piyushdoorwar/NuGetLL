import { PackageReference } from "./packageModel";

export type ProjectKind = "csproj" | "fsproj" | "vbproj";

export interface ProjectInfo {
  /** File name without extension. */
  name: string;
  /** Absolute path to the project file. */
  path: string;
  kind: ProjectKind;
  /** True for SDK-style projects using PackageReference. */
  sdkStyle: boolean;
  /** True when a sibling packages.config drives the package list (read-only support). */
  usesPackagesConfig: boolean;
  targetFrameworks: string[];
  packages: PackageReference[];
  /** True when the project is governed by an applicable Directory.Packages.props with CPM enabled. */
  usesCentralManagement: boolean;
  /** Path of the Directory.Packages.props that applies to this project, if any. */
  centralPackagesPath?: string;
}
