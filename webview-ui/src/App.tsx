import { useCallback, useEffect, useMemo, useState } from "react";
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
import {
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
          setOutdated(message.results);
          break;
        case "vulnerableResults":
          setVulnerable(message.results);
          break;
        case "deprecatedResults":
          setDeprecated(message.results);
          break;
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
            <div className="browse-layout">
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
              {(details || isRunning("Load details")) && (
                <div className="details-panel card">
                  <PackageDetails
                    details={details}
                    loading={!details && isRunning("Load details")}
                    projects={model?.projects ?? []}
                    onClose={() => setDetails(undefined)}
                  />
                </div>
              )}
            </div>
          )}
          {tab === "installed" && (
            <InstalledPackages model={model} onDetails={(id) => { setTab("browse"); showDetails(id); }} />
          )}
          {tab === "updates" && (
            <UpdatesView
              outdated={outdated}
              checking={isRunning("Check outdated")}
              onCheck={() => post({ type: "checkOutdated" })}
              onDetails={(id) => { setTab("browse"); showDetails(id); }}
            />
          )}
          {tab === "vulnerabilities" && (
            <VulnerabilitiesView
              vulnerable={vulnerable}
              deprecated={deprecated}
              checkingVulnerable={isRunning("Check vulnerable")}
              checkingDeprecated={isRunning("Check deprecated")}
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
