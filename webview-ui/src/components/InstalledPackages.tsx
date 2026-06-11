import { useMemo, useState } from "react";
import { post } from "../api/vscodeApi";
import { WorkspaceModel } from "../types";
import { ConfirmDialog } from "./ConfirmDialog";
import { EmptyState } from "./EmptyState";
import { IconPackage } from "./Icons";

interface Row {
  id: string;
  versions: string[];
  projects: { name: string; path: string; version?: string }[];
}

export function InstalledPackages(props: {
  model?: WorkspaceModel;
  onDetails: (packageId: string) => void;
}) {
  const [filter, setFilter] = useState("");
  const [removeTarget, setRemoveTarget] = useState<Row>();

  const rows = useMemo<Row[]>(() => {
    const byId = new Map<string, Row>();
    for (const project of props.model?.projects ?? []) {
      for (const pkg of project.packages) {
        if (pkg.isTransitive) {
          continue;
        }
        let row = byId.get(pkg.id.toLowerCase());
        if (!row) {
          row = { id: pkg.id, versions: [], projects: [] };
          byId.set(pkg.id.toLowerCase(), row);
        }
        const version = pkg.version ?? pkg.resolvedVersion;
        if (version && !row.versions.includes(version)) {
          row.versions.push(version);
        }
        row.projects.push({ name: project.name, path: project.path, version });
      }
    }
    return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
  }, [props.model]);

  const filtered = rows.filter((row) => row.id.toLowerCase().includes(filter.toLowerCase()));

  if (!props.model || props.model.projects.length === 0) {
    return <EmptyState title="No .NET projects found" hint="Open a workspace containing .csproj, .fsproj, or .vbproj files." />;
  }
  if (rows.length === 0) {
    return <EmptyState icon={<IconPackage size={30} />} title="No packages installed" hint="Use Browse to find and install NuGet packages." />;
  }

  return (
    <div>
      <h2>Installed packages</h2>
      <p className="section-hint">
        {rows.length} unique package(s) across {props.model.projects.length} project(s).
      </p>
      <div className="toolbar">
        <input
          type="search"
          placeholder="Filter installed packages..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ width: 280 }}
        />
      </div>
      <table className="data">
        <thead>
          <tr>
            <th>Package</th>
            <th>Version(s)</th>
            <th>Projects</th>
            <th style={{ width: 180 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((row) => (
            <tr key={row.id}>
              <td className="pkg">{row.id}</td>
              <td className="mono">{row.versions.join(", ") || "central"}</td>
              <td>{row.projects.map((p) => p.name).join(", ")}</td>
              <td>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => props.onDetails(row.id)}>
                    Details
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => setRemoveTarget(row)}>
                    Remove
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ConfirmDialog
        open={removeTarget !== undefined}
        title={`Remove ${removeTarget?.id}`}
        body={`The package will be removed from:\n${(removeTarget?.projects ?? [])
          .map((p) => `  • ${p.name}`)
          .join("\n")}`}
        danger
        confirmLabel="Remove"
        onConfirm={() => {
          if (removeTarget) {
            post({
              type: "removePackage",
              packageId: removeTarget.id,
              projectPaths: removeTarget.projects.map((p) => p.path)
            });
          }
          setRemoveTarget(undefined);
        }}
        onCancel={() => setRemoveTarget(undefined)}
      />
    </div>
  );
}
