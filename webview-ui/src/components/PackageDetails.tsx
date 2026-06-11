import { useEffect, useState } from "react";
import { post } from "../api/vscodeApi";
import { PackageDetails as Details, ProjectInfo } from "../types";
import { ConfirmDialog } from "./ConfirmDialog";
import { ProjectPicker } from "./ProjectPicker";
import { VersionPicker } from "./VersionPicker";

export function PackageDetails(props: {
  details?: Details;
  loading: boolean;
  projects: ProjectInfo[];
  onClose: () => void;
}) {
  const { details } = props;
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [version, setVersion] = useState("");
  const [includePrerelease, setIncludePrerelease] = useState(false);
  const [confirm, setConfirm] = useState<{ title: string; body: string; danger?: boolean; action: () => void }>();
  const [copied, setCopied] = useState<string>();

  useEffect(() => {
    setSelectedProjects(details?.usedInProjects.map((p) => p.path) ?? []);
    setVersion("");
  }, [details?.id]);

  if (props.loading || !details) {
    return (
      <div style={{ textAlign: "center", padding: 30 }}>
        <span className="spinner" style={{ display: "inline-block" }} />
        <p style={{ color: "var(--text-muted)" }}>Loading package details…</p>
      </div>
    );
  }

  const usedIn = details.usedInProjects;
  const installedPaths = new Set(usedIn.map((p) => p.path));
  const effectiveVersion = version || details.latestStableVersion || details.version;

  const copy = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(undefined), 2000);
    } catch {
      // clipboard unavailable in this webview — ignore
    }
  };

  const install = () => {
    const isUpdate = selectedProjects.some((p) => installedPaths.has(p));
    setConfirm({
      title: `${isUpdate ? "Install / update" : "Install"} ${details.id}`,
      body: `Version: ${effectiveVersion}\nProjects:\n${selectedProjects
        .map((path) => `  • ${props.projects.find((p) => p.path === path)?.name ?? path}`)
        .join("\n")}`,
      action: () => {
        post({
          type: isUpdate ? "updatePackage" : "installPackage",
          packageId: details.id,
          version: effectiveVersion,
          projectPaths: selectedProjects
        });
        setConfirm(undefined);
      }
    });
  };

  const remove = () => {
    const targets = selectedProjects.filter((p) => installedPaths.has(p));
    setConfirm({
      title: `Remove ${details.id}`,
      body: `The package will be removed from:\n${targets
        .map((path) => `  • ${props.projects.find((p) => p.path === path)?.name ?? path}`)
        .join("\n")}`,
      danger: true,
      action: () => {
        post({ type: "removePackage", packageId: details.id, projectPaths: targets });
        setConfirm(undefined);
      }
    });
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <h3>{details.id}</h3>
        <button className="btn btn-ghost btn-sm" onClick={props.onClose}>
          ✕
        </button>
      </div>
      <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>{details.description}</p>

      {details.deprecation && (
        <div className="alert warning">
          Deprecated{details.deprecation.reasons.length > 0 ? ` (${details.deprecation.reasons.join(", ")})` : ""}.
          {details.deprecation.alternativePackageId && ` Use ${details.deprecation.alternativePackageId} instead.`}
        </div>
      )}
      {details.vulnerabilities && details.vulnerabilities.length > 0 && (
        <div className="alert error">
          {details.vulnerabilities.length} known vulnerability(ies) in the latest version.
        </div>
      )}

      <div className="details-section">
        <div className="meta-row">
          <span className="k">Latest stable</span>
          <span className="v mono">{details.latestStableVersion ?? "—"}</span>
        </div>
        <div className="meta-row">
          <span className="k">Latest prerelease</span>
          <span className="v mono">{details.latestPrereleaseVersion ?? "—"}</span>
        </div>
        <div className="meta-row">
          <span className="k">Authors</span>
          <span className="v">{details.authors.join(", ") || "—"}</span>
        </div>
        {details.owners && details.owners.length > 0 && (
          <div className="meta-row">
            <span className="k">Owners</span>
            <span className="v">{details.owners.join(", ")}</span>
          </div>
        )}
        <div className="meta-row">
          <span className="k">Downloads</span>
          <span className="v">{details.totalDownloads?.toLocaleString() ?? "—"}</span>
        </div>
        <div className="meta-row">
          <span className="k">License</span>
          <span className="v">
            {details.licenseExpression ??
              (details.licenseUrl ? (
                <a onClick={() => post({ type: "openExternal", url: details.licenseUrl! })} href="#license">
                  license
                </a>
              ) : (
                "—"
              ))}
          </span>
        </div>
        {details.projectUrl && (
          <div className="meta-row">
            <span className="k">Project</span>
            <span className="v">
              <a href="#project" onClick={() => post({ type: "openExternal", url: details.projectUrl! })}>
                {details.projectUrl}
              </a>
            </span>
          </div>
        )}
        <div className="meta-row">
          <span className="k">Source</span>
          <span className="v">{details.source}</span>
        </div>
      </div>

      {details.tags.length > 0 && (
        <div className="details-section">
          <h4>Tags</h4>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {details.tags.map((tag) => (
              <span key={tag} className="tag">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="details-section">
        <h4>Version</h4>
        <VersionPicker
          versions={details.versions}
          value={version}
          includePrerelease={includePrerelease}
          onChange={setVersion}
          onTogglePrerelease={setIncludePrerelease}
        />
      </div>

      <div className="details-section">
        <h4>Projects</h4>
        <ProjectPicker projects={props.projects} selected={selectedProjects} onChange={setSelectedProjects} />
      </div>

      {usedIn.length > 0 && (
        <div className="details-section">
          <h4>Installed in</h4>
          {usedIn.map((p) => (
            <div key={p.path} className="meta-row">
              <span className="k">
                <a href="#open" onClick={() => post({ type: "openFile", path: p.path })}>
                  {p.name}
                </a>
              </span>
              <span className="v mono">{p.version ?? "central"}</span>
            </div>
          ))}
        </div>
      )}

      {details.dependencyGroups.length > 0 && (
        <div className="details-section">
          <h4>Dependencies</h4>
          {details.dependencyGroups.map((group) => (
            <div key={group.targetFramework} className="dep-group">
              <span className="tfm">{group.targetFramework}</span>
              {group.dependencies.length === 0 ? (
                <ul>
                  <li>No dependencies</li>
                </ul>
              ) : (
                <ul>
                  {group.dependencies.map((dep) => (
                    <li key={dep.id}>
                      {dep.id} <span className="mono">{dep.range}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="details-section" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn btn-primary" onClick={install} disabled={selectedProjects.length === 0}>
          {selectedProjects.some((p) => installedPaths.has(p)) ? "Install / Update" : "Install"}
        </button>
        <button
          className="btn btn-danger"
          onClick={remove}
          disabled={!selectedProjects.some((p) => installedPaths.has(p))}
        >
          Remove
        </button>
      </div>
      <div className="details-section" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() =>
            post({ type: "openExternal", url: `https://www.nuget.org/packages/${encodeURIComponent(details.id)}` })
          }
        >
          nuget.org ↗
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() =>
            copy("xml", `<PackageReference Include="${details.id}" Version="${effectiveVersion}" />`)
          }
        >
          {copied === "xml" ? "Copied ✓" : "Copy XML"}
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => copy("cli", `dotnet add package ${details.id} --version ${effectiveVersion}`)}
        >
          {copied === "cli" ? "Copied ✓" : "Copy CLI"}
        </button>
      </div>

      <ConfirmDialog
        open={confirm !== undefined}
        title={confirm?.title ?? ""}
        body={confirm?.body ?? ""}
        danger={confirm?.danger}
        confirmLabel={confirm?.danger ? "Remove" : "Apply"}
        onConfirm={() => confirm?.action()}
        onCancel={() => setConfirm(undefined)}
      />
    </div>
  );
}
