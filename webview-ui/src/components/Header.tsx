import { GetllSettingsSnapshot, TabId } from "../types";
import { IconRefresh } from "./Icons";

const TITLES: Record<TabId, string> = {
  overview: "Overview",
  browse: "Browse packages",
  installed: "Installed packages",
  updates: "Updates",
  vulnerabilities: "Vulnerabilities",
  sources: "Package sources",
  settings: "Settings",
};
export function Header(props: {
  settings?: GetllSettingsSnapshot;
  tab: TabId;
  onRefresh: () => void;
}) {
  return (
    <header className="header">
      <div className="breadcrumb">
        <span>Workspace</span>
        <span aria-hidden="true">/</span>
        <strong>{TITLES[props.tab]}</strong>
      </div>
      <div className="header-actions">
        {props.settings && (
          <span
            className={`badge ${props.settings.dotnetAvailable ? "ok" : "error"}`}
          >
            {props.settings.dotnetAvailable
              ? `.NET ${props.settings.dotnetSdkVersion ?? "SDK"}`
              : ".NET SDK not found"}
          </span>
        )}
        <button
          className="btn btn-ghost btn-sm"
          aria-label="Refresh workspace"
          onClick={props.onRefresh}
        >
          <IconRefresh size={14} />
          <span>Refresh</span>
        </button>
      </div>
    </header>
  );
}
