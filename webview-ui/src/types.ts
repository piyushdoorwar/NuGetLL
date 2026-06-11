// Mirror of the extension-side models and message protocol
// (src/models/* and src/webview/messageProtocol.ts). Keep in sync.

export interface PackageReference {
  id: string;
  version?: string;
  resolvedVersion?: string;
  isTransitive?: boolean;
}

export interface ProjectInfo {
  name: string;
  path: string;
  kind: "csproj" | "fsproj" | "vbproj";
  sdkStyle: boolean;
  usesPackagesConfig: boolean;
  targetFrameworks: string[];
  packages: PackageReference[];
  usesCentralManagement: boolean;
  centralPackagesPath?: string;
}

export interface PackageSource {
  name: string;
  url: string;
  enabled: boolean;
  configPath?: string;
}

export interface CentralPackagesFile {
  path: string;
  managementEnabled: boolean;
  packageVersions: Record<string, string>;
}

export interface WorkspaceModel {
  folders: string[];
  solutions: string[];
  projects: ProjectInfo[];
  centralPackageFiles: CentralPackagesFile[];
  nugetConfigPaths: string[];
  sources: PackageSource[];
  dotnetSdkVersion?: string;
  scannedAt: number;
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
  source: string;
}

export interface PackageVersionInfo {
  version: string;
  downloads?: number;
  isPrerelease: boolean;
}

export interface PackageDependencyGroup {
  targetFramework: string;
  dependencies: { id: string; range: string }[];
}

export interface PackageDetails extends PackageSearchResult {
  licenseExpression?: string;
  licenseUrl?: string;
  repositoryUrl?: string;
  latestStableVersion?: string;
  latestPrereleaseVersion?: string;
  versions: PackageVersionInfo[];
  deprecation?: {
    reasons: string[];
    message?: string;
    alternativePackageId?: string;
    alternativePackageRange?: string;
  };
  vulnerabilities?: { severity: string; advisoryUrl: string }[];
  dependencyGroups: PackageDependencyGroup[];
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

export interface GetllSettingsSnapshot {
  defaultPackageSource: string;
  includePrerelease: boolean;
  showTransitivePackages: boolean;
  confirmBeforeMultiProjectChanges: boolean;
  restoreAfterInstall: boolean;
  restoreAfterUpdate: boolean;
  preferDotnetCli: boolean;
  nugetOrgApiUrl: string;
  maxSearchResults: number;
  dotnetAvailable: boolean;
  dotnetSdkVersion?: string;
}

export type WebviewToExtensionMessage =
  | { type: "scanWorkspace" }
  | {
      type: "searchPackages";
      query: string;
      includePrerelease: boolean;
      exactMatch?: boolean;
      source?: string;
      skip?: number;
      take?: number;
    }
  | { type: "getPackageDetails"; packageId: string; source?: string }
  | { type: "installPackage"; packageId: string; version?: string; projectPaths: string[] }
  | { type: "updatePackage"; packageId: string; version: string; projectPaths: string[] }
  | { type: "removePackage"; packageId: string; projectPaths: string[] }
  | { type: "checkOutdated" }
  | { type: "checkVulnerable" }
  | { type: "checkDeprecated" }
  | { type: "listSources" }
  | { type: "addSource"; name: string; url: string }
  | { type: "removeSource"; name: string }
  | { type: "enableSource"; name: string }
  | { type: "disableSource"; name: string }
  | { type: "restoreProject"; projectPath: string }
  | { type: "openExternal"; url: string }
  | { type: "openFile"; path: string }
  | { type: "openVsCodeSettings" }
  | { type: "getSettings" };

export type ExtensionToWebviewMessage =
  | { type: "workspaceModel"; model: WorkspaceModel }
  | { type: "searchResults"; query: string; results: PackageSearchResult[] }
  | { type: "packageDetails"; details: PackageDetails }
  | { type: "operationStarted"; operationId: string; label: string }
  | { type: "operationProgress"; operationId: string; message: string }
  | { type: "operationCompleted"; operationId: string; message: string }
  | { type: "operationFailed"; operationId: string; error: string }
  | { type: "sourcesUpdated"; sources: PackageSource[] }
  | { type: "settingsUpdated"; settings: GetllSettingsSnapshot }
  | { type: "navigate"; tab: string; query?: string }
  | { type: "outdatedResults"; results: OutdatedPackage[]; errors: string[] }
  | { type: "vulnerableResults"; results: VulnerablePackage[]; errors: string[] }
  | { type: "deprecatedResults"; results: DeprecatedPackage[]; errors: string[] };

export type TabId =
  | "overview"
  | "browse"
  | "installed"
  | "updates"
  | "vulnerabilities"
  | "sources"
  | "settings";
