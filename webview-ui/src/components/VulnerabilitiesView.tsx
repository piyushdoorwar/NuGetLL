import { useState } from "react";
import { post } from "../api/vscodeApi";
import { DeprecatedPackage, VulnerablePackage } from "../types";
import { EmptyState } from "./EmptyState";

export function VulnerabilitiesView(props: {
  vulnerable?: VulnerablePackage[];
  deprecated?: DeprecatedPackage[];
  checkingVulnerable: boolean;
  checkingDeprecated: boolean;
  onCheckVulnerable: () => void;
  onCheckDeprecated: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyReport = async () => {
    const lines = ["| Package | Project | Version | Severity | Advisory |", "| --- | --- | --- | --- | --- |"];
    for (const v of props.vulnerable ?? []) {
      lines.push(`| ${v.id} | ${v.projectName} | ${v.resolvedVersion} | ${v.severity} | ${v.advisoryUrl} |`);
    }
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — ignore
    }
  };

  return (
    <div>
      <h2>Vulnerabilities</h2>
      <p className="section-hint">Reported by dotnet list package --vulnerable (includes transitive packages).</p>
      <div className="toolbar">
        <button className="btn btn-primary" onClick={props.onCheckVulnerable} disabled={props.checkingVulnerable}>
          {props.checkingVulnerable ? "Checking..." : "Check vulnerabilities"}
        </button>
        {(props.vulnerable?.length ?? 0) > 0 && (
          <button className="btn btn-ghost" onClick={copyReport}>
            {copied ? "Copied ✓" : "Copy report"}
          </button>
        )}
      </div>

      {props.vulnerable === undefined && !props.checkingVulnerable && (
        <EmptyState
          icon="⛨"
          title="No vulnerability check yet"
          hint="Run a check to scan top-level and transitive packages for known advisories."
          actionLabel="Check vulnerabilities"
          onAction={props.onCheckVulnerable}
        />
      )}
      {props.vulnerable !== undefined && props.vulnerable.length === 0 && !props.checkingVulnerable && (
        <EmptyState icon="✓" title="No known vulnerabilities" hint="No advisories were found for the restored packages." />
      )}

      {(props.vulnerable?.length ?? 0) > 0 && (
        <table className="data">
          <thead>
            <tr>
              <th>Package</th>
              <th>Project</th>
              <th>Version</th>
              <th>Severity</th>
              <th>Advisory</th>
              <th style={{ width: 160 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {props.vulnerable!.map((entry, i) => (
              <tr key={`${entry.id}:${entry.projectPath}:${i}`}>
                <td className="pkg">
                  {entry.id}
                  {entry.isTransitive && <span className="tag" style={{ marginLeft: 6 }}>transitive</span>}
                </td>
                <td>{entry.projectName}</td>
                <td className="mono">{entry.resolvedVersion}</td>
                <td>
                  <span className={`severity ${entry.severity.toLowerCase()}`}>{entry.severity}</span>
                </td>
                <td>
                  {entry.advisoryUrl && (
                    <a href="#advisory" onClick={() => post({ type: "openExternal", url: entry.advisoryUrl })}>
                      View advisory ↗
                    </a>
                  )}
                </td>
                <td>
                  {!entry.isTransitive && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() =>
                        post({ type: "updatePackage", packageId: entry.id, version: "", projectPaths: [entry.projectPath] })
                      }
                    >
                      Update to latest
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 style={{ marginTop: 32 }}>Deprecated packages</h2>
      <p className="section-hint">Reported by dotnet list package --deprecated.</p>
      <div className="toolbar">
        <button className="btn btn-secondary" onClick={props.onCheckDeprecated} disabled={props.checkingDeprecated}>
          {props.checkingDeprecated ? "Checking..." : "Check deprecated"}
        </button>
      </div>
      {props.deprecated !== undefined && props.deprecated.length === 0 && !props.checkingDeprecated && (
        <p className="section-hint">No deprecated packages found.</p>
      )}
      {(props.deprecated?.length ?? 0) > 0 && (
        <table className="data">
          <thead>
            <tr>
              <th>Package</th>
              <th>Project</th>
              <th>Version</th>
              <th>Reason</th>
              <th>Alternative</th>
            </tr>
          </thead>
          <tbody>
            {props.deprecated!.map((entry, i) => (
              <tr key={`${entry.id}:${entry.projectPath}:${i}`}>
                <td className="pkg">{entry.id}</td>
                <td>{entry.projectName}</td>
                <td className="mono">{entry.resolvedVersion}</td>
                <td>{entry.reasons.join(", ")}</td>
                <td>
                  {entry.alternativeId
                    ? `${entry.alternativeId}${entry.alternativeVersionRange ? ` (${entry.alternativeVersionRange})` : ""}`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
