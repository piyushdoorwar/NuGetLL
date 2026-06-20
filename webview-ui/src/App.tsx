import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { onMessage, post } from "./api/vscodeApi";
import { Header } from "./components/Header";
import { IconCheck, IconClose } from "./components/Icons";
import { InstalledPackages } from "./components/InstalledPackages";
import { OverviewView } from "./components/OverviewView";
import { PackageDetails } from "./components/PackageDetails";
import { SearchPackages } from "./components/SearchPackages";
import { SettingsView } from "./components/SettingsView";
import { Sidebar } from "./components/Sidebar";
import { SourcesView } from "./components/SourcesView";
import { UpdatesView } from "./components/UpdatesView";
import { VulnerabilitiesView } from "./components/VulnerabilitiesView";
import { outdatedKey } from "./keys";
import {
  CheckProgressInfo,
  DeprecatedPackage,
  GetllSettingsSnapshot,
  OutdatedPackage,
  PackageDetails as PackageDetailsModel,
  PackageSearchResult,
  PackageSource,
  TabId,
  VulnerablePackage,
  WorkspaceModel
} from "./types";

export interface OperationState {
  label: string;
  status: "running" | "completed" | "failed";
  message?: string;
}

export function App() {
  const [tab, setTab] = useState<TabId>("overview");
  const [model, setModel] = useState<WorkspaceModel>();
  const [settings, setSettings] = useState<GetllSettingsSnapshot>();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PackageSearchResult[]>();
  const [details, setDetails] = useState<PackageDetailsModel>();
  const [outdated, setOutdated] = useState<OutdatedPackage[]>();
  const [vulnerable, setVulnerable] = useState<VulnerablePackage[]>();
  const [deprecated, setDeprecated] = useState<DeprecatedPackage[]>();
  const [sources, setSources] = useState<PackageSource[]>();
  const [operations, setOperations] = useState<Record<string, OperationState>>({});
  // Live progress for the streaming checks, cleared once each check is done.
  const [outdatedProgress, setOutdatedProgress] = useState<CheckProgressInfo>();
  const [vulnerableProgress, setVulnerableProgress] = useState<CheckProgressInfo>();
  const [deprecatedProgress, setDeprecatedProgress] = useState<CheckProgressInfo>();
  // Outdated rows with an update in flight (keyed by outdatedKey), so the UI can
  // show per-row progress and drop rows the moment their update succeeds.
  const [updatingKeys, setUpdatingKeys] = useState<Set<string>>(new Set());
  // Rows the user already updated during the current check. A streaming check
  // keeps re-sending its full (pre-update) result set — including its final
  // message — so without this an updated row would reappear. Read via a ref
  // because the message handler closes over state once. Reset on each new check.
  const resolvedKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const dispose = onMessage((message) => {
      switch (message.type) {
        case "workspaceModel":
          setModel(message.model);
          break;
        case "settingsUpdated":
          setSettings(message.settings);
          break;
        case "searchResults":
          setSearchResults(message.results);
          break;
        case "packageDetails":
          setDetails(message.details);
          break;
        case "sourcesUpdated":
          setSources(message.sources);
          break;
        case "outdatedResults":
          // Drop rows the user already updated this session so a later (or final)
          // streaming snapshot built from pre-update data can't resurrect them.
          setOutdated(message.results.filter((e) => !resolvedKeysRef.current.has(outdatedKey(e.id, e.projectPath))));
          setOutdatedProgress(message.done ? undefined : message.progress);
          break;
        case "vulnerableResults":
          setVulnerable(message.results);
          setVulnerableProgress(message.done ? undefined : message.progress);
          break;
        case "deprecatedResults":
          setDeprecated(message.results);
          setDeprecatedProgress(message.done ? undefined : message.progress);
          break;
        case "packageUpdated": {
          const keys = new Set(message.projectPaths.map((p) => outdatedKey(message.packageId, p)));
          setUpdatingKeys((prev) => {
            const next = new Set(prev);
            for (const k of keys) {
              next.delete(k);
            }
            return next;
          });
          // On success the package is now at its latest version in those
          // projects, so drop the rows immediately — no full re-check needed.
          if (message.success) {
            for (const k of keys) {
              resolvedKeysRef.current.add(k);
            }
            setOutdated((prev) => prev?.filter((e) => !keys.has(outdatedKey(e.id, e.projectPath))));
          }
          break;
        }
        case "navigate":
          if (message.tab === "details" && message.query) {
            setTab("browse");
            setSearchQuery(message.query);
            setDetails(undefined);
            post({ type: "getPackageDetails", packageId: message.query });
            post({ type: "searchPackages", query: message.query, includePrerelease: true, exactMatch: true });
          } else {
            setTab(message.tab as TabId);
            if (message.tab === "browse" && message.query) {
              setSearchQuery(message.query);
              post({ type: "searchPackages", query: message.query, includePrerelease: false });
            }
          }
          break;
        case "operationStarted":
          setOperations((prev) => ({
            ...prev,
            [message.operationId]: { label: message.label, status: "running" }
          }));
          break;
        case "operationProgress":
          setOperations((prev) => {
            const current = prev[message.operationId];
            return current
              ? { ...prev, [message.operationId]: { ...current, message: message.message } }
              : prev;
          });
          break;
        case "operationCompleted":
          setOperations((prev) => {
            const current = prev[message.operationId];
            if (!current) {
              return prev;
            }
            const next = { ...prev, [message.operationId]: { ...current, status: "completed" as const, message: message.message } };
            // Completed entries fade out shortly after.
            setTimeout(() => {
              setOperations((later) => {
                const copy = { ...later };
                delete copy[message.operationId];
                return copy;
              });
            }, 3500);
            return next;
          });
          break;
        case "operationFailed":
          setOperations((prev) => {
            const current = prev[message.operationId];
            return {
              ...prev,
              [message.operationId]: {
                label: current?.label ?? "Operation",
                status: "failed",
                message: message.error
              }
            };
          });
          break;
      }
    });
    post({ type: "scanWorkspace" });
    post({ type: "listSources" });
    return dispose;
  }, []);

  const isRunning = useCallback(
    (prefix: string) =>
      Object.values(operations).some((op) => op.status === "running" && op.label.startsWith(prefix)),
    [operations]
  );

  const search = useCallback(
    (query: string, includePrerelease: boolean, exactMatch: boolean) => {
      setSearchQuery(query);
      if (query.trim().length > 0) {
        setSearchResults(undefined);
        post({ type: "searchPackages", query: query.trim(), includePrerelease, exactMatch });
      }
    },
    []
  );

  const showDetails = useCallback((packageId: string) => {
    setDetails(undefined);
    post({ type: "getPackageDetails", packageId });
  }, []);

  // Marks rows as in-flight, then fires one update per (package, project) row.
  const applyUpdates = useCallback((entries: OutdatedPackage[]) => {
    setUpdatingKeys((prev) => {
      const next = new Set(prev);
      for (const e of entries) {
        next.add(outdatedKey(e.id, e.projectPath));
      }
      return next;
    });
    for (const e of entries) {
      post({ type: "updatePackage", packageId: e.id, version: e.latestVersion, projectPaths: [e.projectPath] });
    }
  }, []);

  // A fresh check re-evaluates reality, so forget what was resolved last time.
  const checkOutdated = useCallback(() => {
    resolvedKeysRef.current = new Set();
    post({ type: "checkOutdated" });
  }, []);

  const counts = useMemo(
    () => ({
      projects: model?.projects.length ?? 0,
      installed: new Set(
        (model?.projects ?? []).flatMap((p) => p.packages.filter((pkg) => !pkg.isTransitive).map((pkg) => pkg.id))
      ).size,
      outdated: outdated?.length,
      vulnerable: vulnerable?.length,
      sources: sources?.length
    }),
    [model, outdated, vulnerable, sources]
  );

  const dismissOperation = (id: string) =>
    setOperations((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });

  // Shared right-hand details panel, reused by the Browse and Installed tabs.
  const detailsPanel =
    details || isRunning("Load details") ? (
      <div className="details-panel card">
        <PackageDetails
          details={details}
          loading={!details && isRunning("Load details")}
          projects={model?.projects ?? []}
          onClose={() => setDetails(undefined)}
        />
      </div>
    ) : null;

  return (
    <div className="app">
      <Header
        settings={settings}
        projectCount={counts.projects}
        onRefresh={() => post({ type: "scanWorkspace" })}
      />
      <div className="body">
        <Sidebar tab={tab} counts={counts} onSelect={setTab} />
        <main className="content">
          {tab === "overview" && (
            <OverviewView
              model={model}
              outdated={outdated}
              vulnerable={vulnerable}
              settings={settings}
              onNavigate={setTab}
            />
          )}
          {tab === "browse" && (
            <div className="browse-layout split">
              <div className="browse-results">
                <SearchPackages
                  query={searchQuery}
                  results={searchResults}
                  searching={isRunning("Search")}
                  defaultPrerelease={settings?.includePrerelease ?? false}
                  onSearch={search}
                  onSelect={showDetails}
                  selectedId={details?.id}
                />
              </div>
              {detailsPanel}
            </div>
          )}
          {tab === "installed" && (
            <div className="browse-layout split">
              <div className="browse-results">
                <InstalledPackages model={model} onDetails={showDetails} selectedId={details?.id} />
              </div>
              {detailsPanel}
            </div>
          )}
          {tab === "updates" && (
            <UpdatesView
              outdated={outdated}
              checking={isRunning("Check outdated")}
              progress={outdatedProgress}
              updatingKeys={updatingKeys}
              onUpdate={applyUpdates}
              onCheck={checkOutdated}
              onDetails={(id) => { setTab("browse"); showDetails(id); }}
            />
          )}
          {tab === "vulnerabilities" && (
            <VulnerabilitiesView
              vulnerable={vulnerable}
              deprecated={deprecated}
              checkingVulnerable={isRunning("Check vulnerable")}
              checkingDeprecated={isRunning("Check deprecated")}
              vulnerableProgress={vulnerableProgress}
              deprecatedProgress={deprecatedProgress}
              onCheckVulnerable={() => post({ type: "checkVulnerable" })}
              onCheckDeprecated={() => post({ type: "checkDeprecated" })}
            />
          )}
          {tab === "sources" && <SourcesView sources={sources} busy={isRunning("Add source") || isRunning("Remove source")} />}
          {tab === "settings" && <SettingsView settings={settings} />}
        </main>
      </div>
      <div className="statusbar">
        {Object.entries(operations).map(([id, op]) => (
          <div key={id} className={`status-item ${op.status}`}>
            {op.status === "running" && <span className="spinner" />}
            {op.status === "failed" && <IconClose size={13} />}
            {op.status === "completed" && (
              <span style={{ color: "var(--accent)", display: "inline-flex" }}>
                <IconCheck size={13} />
              </span>
            )}
            <span>
              {op.label}
              {op.message ? ` — ${op.message}` : ""}
            </span>
            {op.status !== "running" && (
              <button className="dismiss" onClick={() => dismissOperation(id)} title="Dismiss">
                <IconClose size={12} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
