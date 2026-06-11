import * as vscode from "vscode";

/** Typed access to the extension's settings. */
export function getConfig() {
  const cfg = vscode.workspace.getConfiguration("getll");
  return {
    defaultPackageSource: cfg.get<string>("defaultPackageSource", ""),
    includePrerelease: cfg.get<boolean>("includePrerelease", false),
    autoRefreshOnProjectFileChange: cfg.get<boolean>("autoRefreshOnProjectFileChange", true),
    scanOnStartup: cfg.get<boolean>("scanOnStartup", true),
    showTransitivePackages: cfg.get<boolean>("showTransitivePackages", false),
    enableCentralPackageManagementSupport: cfg.get<boolean>("enableCentralPackageManagementSupport", true),
    confirmBeforeMultiProjectChanges: cfg.get<boolean>("confirmBeforeMultiProjectChanges", true),
    restoreAfterInstall: cfg.get<boolean>("restoreAfterInstall", false),
    restoreAfterUpdate: cfg.get<boolean>("restoreAfterUpdate", false),
    preferDotnetCli: cfg.get<boolean>("preferDotnetCli", false),
    nugetOrgApiUrl: cfg.get<string>("nugetOrgApiUrl", "https://api.nuget.org/v3/index.json"),
    maxSearchResults: cfg.get<number>("maxSearchResults", 25),
    excludedFolders: cfg.get<string[]>("excludedFolders", [
      "bin",
      "obj",
      ".git",
      "node_modules",
      ".vs",
      ".vscode-test"
    ])
  };
}

export type GetllConfig = ReturnType<typeof getConfig>;
