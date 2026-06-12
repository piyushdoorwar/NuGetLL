import { post } from "../api/vscodeApi";
import { GetllSettingsSnapshot } from "../types";
import { IconVsCode } from "./Icons";

const ROWS: { key: keyof GetllSettingsSnapshot; label: string }[] = [
  { key: "defaultPackageSource", label: "Default package source" },
  { key: "includePrerelease", label: "Include prerelease" },
  { key: "showTransitivePackages", label: "Show transitive packages" },
  { key: "confirmBeforeMultiProjectChanges", label: "Confirm multi-project changes" },
  { key: "restoreAfterInstall", label: "Restore after install" },
  { key: "restoreAfterUpdate", label: "Restore after update" },
  { key: "preferDotnetCli", label: "Prefer dotnet CLI for search" },
  { key: "nugetOrgApiUrl", label: "NuGet API URL" },
  { key: "maxSearchResults", label: "Max search results" }
];

export function SettingsView(props: { settings?: GetllSettingsSnapshot }) {
  return (
    <div>
      <h2>Settings</h2>
      <p className="section-hint">NeuGetLL settings are managed in VS Code settings under the "getll" namespace.</p>
      <div className="card settings-list">
        {props.settings ? (
          ROWS.map((row) => {
            const value = props.settings![row.key];
            return (
              <div key={row.key} className="meta-row">
                <span className="k">{row.label}</span>
                <span className="v">
                  {typeof value === "boolean" ? (value ? "On" : "Off") : String(value || "—")}
                </span>
              </div>
            );
          })
        ) : (
          <p className="section-hint">Loading settings…</p>
        )}
        <div style={{ marginTop: 14 }}>
          <button className="btn btn-primary" onClick={() => post({ type: "openVsCodeSettings" })}>
            <IconVsCode size={15} />
            Open VS Code settings
          </button>
        </div>
      </div>
    </div>
  );
}
