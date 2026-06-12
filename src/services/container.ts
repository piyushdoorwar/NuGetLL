import * as vscode from "vscode";
import { DeprecatedPackage, OutdatedPackage, VulnerablePackage } from "../models/packageModel";
import { CentralPackageService } from "./centralPackageService";
import { CredentialStorageService } from "./credentialStorageService";
import { NugetApiService } from "./nugetApiService";
import { NugetCliService } from "./nugetCliService";
import { PackageSourceService } from "./packageSourceService";
import { VulnerabilityService } from "./vulnerabilityService";
import { WorkspaceScanner } from "./workspaceScanner";

/** Holds the latest outdated/vulnerable/deprecated reports for trees and webview. */
export class ResultsStore {
  private readonly emitter = new vscode.EventEmitter<void>();
  readonly onDidChange = this.emitter.event;

  outdated: OutdatedPackage[] | undefined;
  vulnerable: VulnerablePackage[] | undefined;
  deprecated: DeprecatedPackage[] | undefined;

  setOutdated(results: OutdatedPackage[]): void {
    this.outdated = results;
    this.emitter.fire();
  }

  setVulnerable(results: VulnerablePackage[]): void {
    this.vulnerable = results;
    this.emitter.fire();
  }

  setDeprecated(results: DeprecatedPackage[]): void {
    this.deprecated = results;
    this.emitter.fire();
  }

  clear(): void {
    this.outdated = undefined;
    this.vulnerable = undefined;
    this.deprecated = undefined;
    this.emitter.fire();
  }
}

export interface DotnetState {
  available: boolean;
  version?: string;
}

/** Dependency container shared by commands, views and the webview panel. */
export interface GetllServices {
  context: vscode.ExtensionContext;
  scanner: WorkspaceScanner;
  cli: NugetCliService;
  api: NugetApiService;
  sources: PackageSourceService;
  credentials: CredentialStorageService;
  central: CentralPackageService;
  vulnerabilities: VulnerabilityService;
  results: ResultsStore;
  dotnet: DotnetState;
}
