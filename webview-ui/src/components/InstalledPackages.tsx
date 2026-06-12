import { useMemo, useState } from "react";
import { WorkspaceModel } from "../types";
import { EmptyState } from "./EmptyState";
import { IconPackage, IconSearch } from "./Icons";

function NuGetIcon({ id, version }: { id: string; version?: string }) {
  const [failed, setFailed] = useState(false);
  if (version && !failed) {
    return (
      <img
        src={`https://api.nuget.org/v3-flatcontainer/${id.toLowerCase()}/${version}/icon`}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        style={{ width: 22, height: 22, objectFit: "contain" }}
      />
    );
  }
  return <IconPackage size={19} />;
}

interface Row {
  id: string;
  versions: string[];
  projects: { name: string; path: string; version?: string }[];
  transitiveIn: { name: string; path: string }[];
}

export function InstalledPackages(props: {
  model?: WorkspaceModel;
  selectedId?: string;
  onDetails: (packageId: string) => void;
}) {
  const [filter, setFilter] = useState("");

  const rows = useMemo<Row[]>(() => {
    const byId = new Map<string, Row>();
    for (const project of props.model?.projects ?? []) {
      for (const pkg of project.packages) {
        const key = pkg.id.toLowerCase();
        let row = byId.get(key);
        if (!row) {
          row = { id: pkg.id, versions: [], projects: [], transitiveIn: [] };
          byId.set(key, row);
        }
        const version = pkg.version ?? pkg.resolvedVersion;
        if (pkg.isTransitive) {
          if (!row.transitiveIn.some((p) => p.path === project.path)) {
            row.transitiveIn.push({ name: project.name, path: project.path });
          }
        } else {
          if (version && !row.versions.includes(version)) {
            row.versions.push(version);
          }
          row.projects.push({ name: project.name, path: project.path, version });
        }
      }
    }
    return [...byId.values()]
      .filter((r) => r.projects.length > 0)
      .sort((a, b) => a.id.localeCompare(b.id));
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
        {rows.length} unique package(s) across {props.model.projects.length} project(s). Click a package for details.
      </p>
      <div className="toolbar">
        <div className="search-input-wrap" style={{ maxWidth: 340 }}>
          <span className="search-icon"><IconSearch size={14} /></span>
          <input
            type="text"
            placeholder="Filter installed packages..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          {filter && (
            <button className="search-clear" onClick={() => setFilter("")} title="Clear">
              <span style={{ fontSize: 14, lineHeight: 1 }}>×</span>
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 && (
        <EmptyState icon={<IconPackage size={30} />} title="No matches" hint={`Nothing matched "${filter}".`} />
      )}

      {filtered.map((row) => (
        <div
          key={row.id}
          className={`pkg-card ${props.selectedId?.toLowerCase() === row.id.toLowerCase() ? "selected" : ""}`}
          onClick={() => props.onDetails(row.id)}
        >
          <div className="pkg-icon">
            <NuGetIcon id={row.id} version={row.versions[0]} />
          </div>
          <div className="pkg-main">
            <div className="pkg-title">
              <span className="name">{row.id}</span>
              <span className="version">{row.versions.join(", ") || "central"}</span>
            </div>
            <div className="pkg-meta">
              {row.projects.map((p) => (
                <span key={p.path} className="tag">{p.name}</span>
              ))}
              {row.transitiveIn.map((p) => (
                <span key={p.path} className="tag transitive" title="Transitive dependency">{p.name}</span>
              ))}
            </div>
          </div>
        </div>
      ))}

    </div>
  );
}
