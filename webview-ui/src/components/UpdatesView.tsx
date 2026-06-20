import { useMemo, useState } from "react";
import { post } from "../api/vscodeApi";
import { CheckProgressInfo, OutdatedPackage } from "../types";
import { CheckProgress } from "./CheckProgress";
import { ConfirmDialog } from "./ConfirmDialog";
import { EmptyState } from "./EmptyState";
import { IconCheck, IconUpdate } from "./Icons";

type DiffLevel = "patch" | "minor" | "major" | "other";

function diffLevel(current: string, latest: string): DiffLevel {
  const a = current.split("-")[0].split(".").map((n) => parseInt(n, 10));
  const b = latest.split("-")[0].split(".").map((n) => parseInt(n, 10));
  if (a.some(isNaN) || b.some(isNaN)) {
    return "other";
  }
  if (a[0] !== b[0]) {
    return "major";
  }
  if ((a[1] ?? 0) !== (b[1] ?? 0)) {
    return "minor";
  }
  return "patch";
}

export function UpdatesView(props: {
  outdated?: OutdatedPackage[];
  checking: boolean;
  progress?: CheckProgressInfo;
  onCheck: () => void;
  onDetails: (packageId: string) => void;
}) {
  const [ignored, setIgnored] = useState<Set<string>>(new Set());
  const [confirmBatch, setConfirmBatch] = useState<{ label: string; entries: OutdatedPackage[] }>();

  const visible = useMemo(
    () => (props.outdated ?? []).filter((p) => !p.isTransitive && !ignored.has(p.id.toLowerCase())),
    [props.outdated, ignored]
  );

  const toggleIgnore = (id: string) => {
    setIgnored((prev) => {
      const next = new Set(prev);
      if (next.has(id.toLowerCase())) {
        next.delete(id.toLowerCase());
      } else {
        next.add(id.toLowerCase());
      }
      return next;
    });
  };

  const updateOne = (entry: OutdatedPackage) =>
    post({
      type: "updatePackage",
      packageId: entry.id,
      version: entry.latestVersion,
      projectPaths: [entry.projectPath]
    });

  const runBatch = (entries: OutdatedPackage[]) => {
    for (const entry of entries) {
      updateOne(entry);
    }
    setConfirmBatch(undefined);
  };

  const batch = (label: string, level?: DiffLevel) => {
    const entries = visible.filter((e) => !level || diffLevel(e.resolvedVersion, e.latestVersion) === level);
    if (entries.length > 0) {
      setConfirmBatch({ label, entries });
    }
  };

  return (
    <div>
      <h2>Updates</h2>
      <p className="section-hint">Outdated packages reported by dotnet list package --outdated.</p>
      <div className="toolbar">
        <button className="btn btn-primary" onClick={props.onCheck} disabled={props.checking}>
          {props.checking ? "Checking..." : "Check for updates"}
        </button>
        <div className="spacer" />
        {visible.length > 0 && (
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => batch("patch updates", "patch")}>
              Update patch
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => batch("minor updates", "minor")}>
              Update minor
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => batch("all updates")}>
              Update all
            </button>
          </>
        )}
      </div>

      {props.checking && <CheckProgress progress={props.progress} noun="project" />}

      {props.outdated === undefined && !props.checking && (
        <EmptyState
          icon={<IconUpdate size={30} />}
          title="No update check yet"
          hint="Run a check to see which packages have newer versions."
          actionLabel="Check for updates"
          onAction={props.onCheck}
        />
      )}
      {props.outdated !== undefined && visible.length === 0 && !props.checking && (
        <EmptyState
          icon={<IconCheck size={30} />}
          title="No outdated packages"
          hint="Everything is up to date (ignored packages are hidden)."
        />
      )}

      {visible.length > 0 && (
        <table className="data">
          <thead>
            <tr>
              <th>Package</th>
              <th>Project</th>
              <th>Current</th>
              <th>Latest</th>
              <th>Change</th>
              <th style={{ width: 220 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((entry) => {
              const level = diffLevel(entry.resolvedVersion, entry.latestVersion);
              return (
                <tr key={`${entry.id}:${entry.projectPath}`}>
                  <td className="pkg">
                    <a href="#details" onClick={() => props.onDetails(entry.id)}>
                      {entry.id}
                    </a>
                  </td>
                  <td>{entry.projectName}</td>
                  <td className="mono">{entry.resolvedVersion}</td>
                  <td className="mono" style={{ color: "var(--accent)" }}>
                    {entry.latestVersion}
                  </td>
                  <td>
                    <span className={`severity ${level === "major" ? "high" : level === "minor" ? "moderate" : "low"}`}>
                      {level}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn btn-primary btn-sm" onClick={() => updateOne(entry)}>
                        Update
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => toggleIgnore(entry.id)}>
                        Ignore
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {ignored.size > 0 && (
        <p className="section-hint" style={{ marginTop: 10 }}>
          {ignored.size} package(s) ignored.{" "}
          <a href="#reset" onClick={() => setIgnored(new Set())}>
            Reset
          </a>
        </p>
      )}

      <ConfirmDialog
        open={confirmBatch !== undefined}
        title={`Apply ${confirmBatch?.label}?`}
        body={(confirmBatch?.entries ?? [])
          .map((e) => `  • ${e.projectName}: ${e.id} ${e.resolvedVersion} → ${e.latestVersion}`)
          .join("\n")}
        confirmLabel="Update"
        onConfirm={() => confirmBatch && runBatch(confirmBatch.entries)}
        onCancel={() => setConfirmBatch(undefined)}
      />
    </div>
  );
}
