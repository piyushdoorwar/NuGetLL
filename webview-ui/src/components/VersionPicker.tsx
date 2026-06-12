import { PackageVersionInfo } from "../types";

export function VersionPicker(props: {
  versions: PackageVersionInfo[];
  value: string;
  includePrerelease: boolean;
  onChange: (version: string) => void;
  onTogglePrerelease: (include: boolean) => void;
}) {
  const visible = props.versions.filter((v) => props.includePrerelease || !v.isPrerelease);

  return (
    <div>
      <div className="version-list">
        <div
          className={`version-item${!props.value ? " selected" : ""}`}
          onClick={() => props.onChange("")}
        >
          Latest stable
        </div>
        {visible.map((v) => (
          <div
            key={v.version}
            className={`version-item${props.value === v.version ? " selected" : ""}${v.isPrerelease ? " prerelease" : ""}`}
            onClick={() => props.onChange(v.version)}
          >
            {v.version}
            {v.isPrerelease && <span className="pre-badge">pre</span>}
          </div>
        ))}
        {visible.length === 0 && (
          <div className="version-item" style={{ color: "var(--text-muted)", cursor: "default" }}>
            No versions available
          </div>
        )}
      </div>
      <label className="checkbox" style={{ marginTop: 8 }}>
        <input
          type="checkbox"
          checked={props.includePrerelease}
          onChange={(e) => props.onTogglePrerelease(e.target.checked)}
        />
        Include prerelease
      </label>
    </div>
  );
}
