import { post } from "../api/vscodeApi";
import {
  GetllSettingsSnapshot,
  OutdatedPackage,
  TabId,
  VulnerablePackage,
  WorkspaceModel
} from "../types";
import { EmptyState } from "./EmptyState";

export function OverviewView(props: {
  model?: WorkspaceModel;
  outdated?: OutdatedPackage[];
  vulnerable?: VulnerablePackage[];
  settings?: GetllSettingsSnapshot;
  onNavigate: (tab: TabId) => void;
}) {
  const { model } = props;
  if (!model) {
    return <p className="section-hint">Scanning workspace…</p>;
  }
  if (model.projects.length === 0) {
    return (
      <EmptyState
        icon="▦"
        title="No .NET projects found"
        hint="Open a workspace containing .csproj, .fsproj, or .vbproj files, then refresh."
        actionLabel="Rescan workspace"
        onAction={() => post({ type: "scanWorkspace" })}
      />
    );
  }

  const uniquePackages = new Set(
    model.projects.flatMap((p) => p.packages.filter((pkg) => !pkg.isTransitive).map((pkg) => pkg.id.toLowerCase()))
  ).size;

  return (
    <div>
      <h2>Overview</h2>
      <p className="section-hint">Workspace scanned {new Date(model.scannedAt).toLocaleTimeString()}.</p>

      {props.settings && !props.settings.dotnetAvailable && (
        <div className="alert error">
          The dotnet SDK was not found on PATH. Install the .NET SDK to enable package actions.{" "}
          <a href="#install" onClick={() => post({ type: "openExternal", url: "https://dotnet.microsoft.com/download" })}>
            Install instructions ↗
          </a>
        </div>
      )}

      <div className="grid stats">
        <div className="stat-card">
          <div className="value neutral">{model.projects.length}</div>
          <div className="label">Projects</div>
        </div>
        <div className="stat-card">
          <div className="value">{uniquePackages}</div>
          <div className="label">Packages</div>
        </div>
        <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => props.onNavigate("updates")}>
          <div className={`value ${props.outdated && props.outdated.length > 0 ? "bad" : ""}`}>
            {props.outdated?.length ?? "—"}
          </div>
          <div className="label">Outdated</div>
        </div>
        <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => props.onNavigate("vulnerabilities")}>
          <div className={`value ${props.vulnerable && props.vulnerable.length > 0 ? "bad" : ""}`}>
            {props.vulnerable?.length ?? "—"}
          </div>
          <div className="label">Vulnerable</div>
        </div>
      </div>

      <div className="toolbar">
        <button className="btn btn-primary" onClick={() => props.onNavigate("browse")}>
          Browse packages
        </button>
        <button className="btn btn-secondary" onClick={() => post({ type: "checkOutdated" })}>
          Check updates
        </button>
        <button className="btn btn-secondary" onClick={() => post({ type: "checkVulnerable" })}>
          Check vulnerabilities
        </button>
      </div>

      <table className="data" style={{ marginTop: 8 }}>
        <thead>
          <tr>
            <th>Project</th>
            <th>Frameworks</th>
            <th>Packages</th>
            <th>Mode</th>
            <th style={{ width: 160 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {model.projects.map((project) => (
            <tr key={project.path}>
              <td className="pkg">
                <a href="#open" onClick={() => post({ type: "openFile", path: project.path })}>
                  {project.name}
                </a>
              </td>
              <td>{project.targetFrameworks.join(", ") || "—"}</td>
              <td>{project.packages.filter((p) => !p.isTransitive).length}</td>
              <td>
                {project.usesPackagesConfig ? (
                  <span className="tag">packages.config</span>
                ) : project.usesCentralManagement ? (
                  <span className="tag">CPM</span>
                ) : (
                  <span className="tag">PackageReference</span>
                )}
              </td>
              <td>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => post({ type: "restoreProject", projectPath: project.path })}
                >
                  Restore
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
