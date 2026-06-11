import * as vscode from "vscode";
import { getConfig } from "../config";
import { OutdatedPackage } from "../models/packageModel";
import { GetllServices } from "../services/container";
import { logger } from "../utils/logger";

function listTargets(services: GetllServices): string[] {
  const model = services.scanner.getModel();
  if (!model) {
    return [];
  }
  return model.solutions.length > 0 ? model.solutions : model.projects.map((p) => p.path);
}

function reportErrors(errors: string[]): void {
  for (const error of errors) {
    logger.warn(`dotnet list package: ${error}`);
  }
  if (errors.length > 0) {
    vscode.window.showWarningMessage("GetLL: some projects could not be analyzed. See output for details.");
  }
}

export async function runOutdatedCheck(services: GetllServices): Promise<OutdatedPackage[] | undefined> {
  if (!services.dotnet.available) {
    vscode.window.showErrorMessage("GetLL: dotnet SDK not found.");
    return undefined;
  }
  const targets = listTargets(services);
  if (targets.length === 0) {
    vscode.window.showInformationMessage("GetLL: no .NET projects found.");
    return undefined;
  }
  const config = getConfig();
  let results: OutdatedPackage[] | undefined;
  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: "GetLL: Checking outdated packages", cancellable: true },
    async (_progress, token) => {
      const abort = new AbortController();
      token.onCancellationRequested(() => abort.abort());
      const outcome = await services.vulnerabilities.checkOutdated(
        targets,
        { includePrerelease: config.includePrerelease, includeTransitive: config.showTransitivePackages },
        { signal: abort.signal }
      );
      if (token.isCancellationRequested) {
        return;
      }
      reportErrors(outcome.errors);
      services.results.setOutdated(outcome.results);
      results = outcome.results;
    }
  );
  return results;
}

export function registerCheckCommands(services: GetllServices): vscode.Disposable[] {
  const outdated = vscode.commands.registerCommand("getll.checkOutdated", async () => {
    const results = await runOutdatedCheck(services);
    if (results) {
      vscode.window.showInformationMessage(
        results.length === 0 ? "GetLL: all packages are up to date." : `GetLL: ${results.length} outdated package(s) found.`
      );
    }
  });

  const vulnerable = vscode.commands.registerCommand("getll.checkVulnerable", async () => {
    if (!services.dotnet.available) {
      vscode.window.showErrorMessage("GetLL: dotnet SDK not found.");
      return;
    }
    const targets = listTargets(services);
    if (targets.length === 0) {
      vscode.window.showInformationMessage("GetLL: no .NET projects found.");
      return;
    }
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: "GetLL: Checking vulnerable packages", cancellable: true },
      async (_progress, token) => {
        const abort = new AbortController();
        token.onCancellationRequested(() => abort.abort());
        const outcome = await services.vulnerabilities.checkVulnerable(targets, { includeTransitive: true }, { signal: abort.signal });
        if (token.isCancellationRequested) {
          return;
        }
        reportErrors(outcome.errors);
        services.results.setVulnerable(outcome.results);
        vscode.window.showInformationMessage(
          outcome.results.length === 0
            ? "GetLL: no known vulnerabilities found."
            : `GetLL: ${outcome.results.length} vulnerable package reference(s) found.`
        );
      }
    );
  });

  const deprecated = vscode.commands.registerCommand("getll.checkDeprecated", async () => {
    if (!services.dotnet.available) {
      vscode.window.showErrorMessage("GetLL: dotnet SDK not found.");
      return;
    }
    const targets = listTargets(services);
    if (targets.length === 0) {
      vscode.window.showInformationMessage("GetLL: no .NET projects found.");
      return;
    }
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: "GetLL: Checking deprecated packages", cancellable: true },
      async (_progress, token) => {
        const abort = new AbortController();
        token.onCancellationRequested(() => abort.abort());
        const outcome = await services.vulnerabilities.checkDeprecated(targets, {}, { signal: abort.signal });
        if (token.isCancellationRequested) {
          return;
        }
        reportErrors(outcome.errors);
        services.results.setDeprecated(outcome.results);
        if (outcome.results.length === 0) {
          vscode.window.showInformationMessage("GetLL: no deprecated packages found.");
        } else {
          const lines = outcome.results.map(
            (d) =>
              `${d.projectName}: ${d.id} ${d.resolvedVersion} — ${d.reasons.join(", ")}${d.alternativeId ? ` (use ${d.alternativeId})` : ""}`
          );
          logger.info(`Deprecated packages:\n${lines.join("\n")}`);
          vscode.window
            .showWarningMessage(`GetLL: ${outcome.results.length} deprecated package(s) found.`, "Show Details")
            .then((choice) => {
              if (choice === "Show Details") {
                logger.show();
              }
            });
        }
      }
    );
  });

  return [outdated, vulnerable, deprecated];
}
