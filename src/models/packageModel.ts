/** A package referenced by a project (top-level or transitive). */
export interface PackageReference {
  id: string;
  /** Declared version. Absent for projects using Central Package Management. */
  version?: string;
  /** Version resolved by restore, when known. */
  resolvedVersion?: string;
  isTransitive?: boolean;
}

export interface PackageSearchResult {
  id: string;
  version: string;
  description?: string;
  iconUrl?: string;
  totalDownloads?: number;
  verified?: boolean;
  authors: string[];
  owners?: string[];
  tags: string[];
  projectUrl?: string;
  /** Display name of the source this result came from. */
  source: string;
}

export interface PackageVersionInfo {
  version: string;
  downloads?: number;
  isPrerelease: boolean;
}

export interface PackageDependency {
  id: string;
  range: string;
}

export interface PackageDependencyGroup {
  targetFramework: string;
  dependencies: PackageDependency[];
}

export interface PackageDeprecationInfo {
  reasons: string[];
  message?: string;
  alternativePackageId?: string;
  alternativePackageRange?: string;
}

export interface PackageVulnerabilityInfo {
  severity: string;
  advisoryUrl: string;
}

export interface PackageDetails extends PackageSearchResult {
  licenseExpression?: string;
  licenseUrl?: string;
  repositoryUrl?: string;
  latestStableVersion?: string;
  latestPrereleaseVersion?: string;
  versions: PackageVersionInfo[];
  deprecation?: PackageDeprecationInfo;
  vulnerabilities?: PackageVulnerabilityInfo[];
  dependencyGroups: PackageDependencyGroup[];
  /** Project file paths in the current workspace that reference this package. */
  usedInProjects: { name: string; path: string; version?: string }[];
}

export interface OutdatedPackage {
  id: string;
  projectName: string;
  projectPath: string;
  requestedVersion?: string;
  resolvedVersion: string;
  latestVersion: string;
  isTransitive?: boolean;
}

export interface VulnerablePackage {
  id: string;
  projectName: string;
  projectPath: string;
  resolvedVersion: string;
  severity: string;
  advisoryUrl: string;
  isTransitive?: boolean;
}

export interface DeprecatedPackage {
  id: string;
  projectName: string;
  projectPath: string;
  resolvedVersion: string;
  reasons: string[];
  alternativeId?: string;
  alternativeVersionRange?: string;
}
