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
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <select value={props.value} onChange={(e) => props.onChange(e.target.value)}>
        <option value="">Latest stable</option>
        {visible.map((v) => (
          <option key={v.version} value={v.version}>
            {v.version}
            {v.isPrerelease ? " (prerelease)" : ""}
          </option>
        ))}
      </select>
      <label className="checkbox">
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
