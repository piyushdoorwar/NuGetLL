import { GetllSettingsSnapshot } from "../types";
import { IconLogo, IconRefresh } from "./Icons";

export function Header(props: {
  settings?: GetllSettingsSnapshot;
  projectCount: number;
  onRefresh: () => void;
}) {
  const { settings, projectCount, onRefresh } = props;
  return (
    <header className="header">
      <div className="logo">
        <IconLogo size={24} stroke="#0c1f12" />
      </div>
      <div>
        <h1>NeuGetLL</h1>
        <p className="subtitle">Visual NuGet package management for VS Code workspaces.</p>
      </div>
      <div className="spacer" />
      <span className="badge">
        {projectCount} project{projectCount === 1 ? "" : "s"}
      </span>
      {settings &&
        (settings.dotnetAvailable ? (
          <span className="badge ok">dotnet {settings.dotnetSdkVersion ?? "SDK"}</span>
        ) : (
          <span className="badge error">dotnet SDK not found</span>
        ))}
      <button className="btn btn-ghost btn-sm" onClick={onRefresh}>
        <IconRefresh size={14} />
        Refresh
      </button>
    </header>
  );
}
