import {
  DeprecatedPackage,
  OutdatedPackage,
  PackageDetails,
  PackageSearchResult,
  VulnerablePackage
} from "../models/packageModel";
import { PackageSource } from "../models/sourceModel";
import { WorkspaceModel } from "../models/workspaceModel";

/** Settings snapshot shared with the webview. */
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

// ---------------------------------------------------------------------------
// Webview -> Extension
// ---------------------------------------------------------------------------

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
  | { type: "updateSource"; name: string; url: string }
  | { type: "removeSource"; name: string }
  | { type: "enableSource"; name: string }
  | { type: "disableSource"; name: string }
  | { type: "saveCredential"; sourceName: string; credType: "pat" | "basic"; username?: string; password: string }
  | { type: "removeCredential"; sourceName: string }
  | { type: "restoreProject"; projectPath: string }
  | { type: "openExternal"; url: string }
  | { type: "openFile"; path: string }
  | { type: "openVsCodeSettings" }
  | { type: "getSettings" };

// ---------------------------------------------------------------------------
// Extension -> Webview
// ---------------------------------------------------------------------------

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
