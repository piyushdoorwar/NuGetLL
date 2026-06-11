import { GetllSettingsSnapshot } from "../types";

export function Header(props: {
  settings?: GetllSettingsSnapshot;
  projectCount: number;
  onRefresh: () => void;
}) {
  const { settings, projectCount, onRefresh } = props;
  return (
    <header className="header">
      <div className="logo">G</div>
      <div>
        <h1>GetLL</h1>
        <p className="subtitle">Visual NuGet package management for VS Code workspaces.</p>
      </div>
      <div className="spacer" />
      <span className="badge">{projectCount} project{projectCount === 1 ? "" : "s"}</span>
      {settings &&
        (settings.dotnetAvailable ? (
          <span className="badge ok">dotnet {settings.dotnetSdkVersion ?? "SDK"}</span>
        ) : (
          <span className="badge error">dotnet SDK not found</span>
        ))}
      <button className="btn btn-ghost btn-sm" onClick={onRefresh}>
        ⟳ Refresh
      </button>
    </header>
  );
}
