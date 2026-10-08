import { GetllSettingsSnapshot, TabId } from "../types";
import { IconLogo, IconRefresh, IconSettings } from "./Icons";

interface Counts {
  installed: number;
  outdated?: number;
  vulnerable?: number;
  sources?: number;
}

// Settings lives as an icon on the right, so it isn't one of the tabs.
const TABS: {
  id: TabId;
  label: string;
  countKey?: keyof Counts;
  // Counts above zero are worth noticing, so they get a coloured pill.
  tone?: "warn" | "bad";
}[] = [
  { id: "overview", label: "Overview" },
  { id: "browse", label: "Browse" },
  { id: "installed", label: "Installed", countKey: "installed" },
  { id: "updates", label: "Updates", countKey: "outdated", tone: "warn" },
  {
    id: "vulnerabilities",
    label: "Vulnerabilities",
    countKey: "vulnerable",
    tone: "bad",
  },
  { id: "sources", label: "Sources", countKey: "sources" },
];

export function TopBar(props: {
  tab: TabId;
  counts: Counts;
  settings?: GetllSettingsSnapshot;
  onSelect: (tab: TabId) => void;
  onRefresh: () => void;
}) {
  return (
    <header className="topbar">
      <div className="topbar-brand">
        <IconLogo size={20} stroke="#1f9cf0" />
        <strong>NuGet LL</strong>
      </div>
      <nav className="tabs" role="tablist" aria-label="Package manager views">
        {TABS.map((item) => {
          const count = item.countKey ? props.counts[item.countKey] : undefined;
          const active = props.tab === item.id;
          const tone = count && item.tone ? item.tone : "";
          return (
            <button
              key={item.id}
              role="tab"
              aria-selected={active}
              className={`tab${active ? " active" : ""}`}
              onClick={() => props.onSelect(item.id)}
            >
              {item.label}
              {count !== undefined && (
                <span className={`tab-count ${tone}`}>{count}</span>
              )}
            </button>
          );
        })}
      </nav>
      <div className="topbar-actions">
        {props.settings && (
          <span
            className={`sdk-status ${props.settings.dotnetAvailable ? "ok" : "error"}`}
            title={
              props.settings.dotnetAvailable
                ? ".NET SDK detected"
                : ".NET SDK not found on PATH"
            }
          >
            <span className="dot" />
            {props.settings.dotnetAvailable
              ? `.NET ${props.settings.dotnetSdkVersion ?? "SDK"}`
              : "No .NET SDK"}
          </span>
        )}
        <button
          className={`icon-btn topbar-icon${props.tab === "settings" ? " active" : ""}`}
          aria-label="Settings"
          title="Settings"
          aria-pressed={props.tab === "settings"}
          onClick={() => props.onSelect("settings")}
        >
          <IconSettings size={16} />
        </button>
        <button
          className="icon-btn topbar-icon"
          aria-label="Refresh workspace"
          title="Rescan workspace"
          onClick={props.onRefresh}
        >
          <IconRefresh size={15} />
        </button>
      </div>
    </header>
  );
}
