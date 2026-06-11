import { ProjectInfo } from "../types";

export function ProjectPicker(props: {
  projects: ProjectInfo[];
  selected: string[];
  onChange: (paths: string[]) => void;
}) {
  const writable = props.projects.filter((p) => !p.usesPackagesConfig);
  const toggle = (path: string) => {
    props.onChange(
      props.selected.includes(path)
        ? props.selected.filter((p) => p !== path)
        : [...props.selected, path]
    );
  };
  if (writable.length === 0) {
    return <div className="alert warning">No writable .NET projects found.</div>;
  }
  return (
    <div>
      <div className="project-picker">
        {writable.map((project) => (
          <label key={project.path} className="row checkbox">
            <input
              type="checkbox"
              checked={props.selected.includes(project.path)}
              onChange={() => toggle(project.path)}
            />
            <span>{project.name}</span>
            {project.usesCentralManagement && <span className="tag">CPM</span>}
            <span className="tfm">{project.targetFrameworks.join(", ")}</span>
          </label>
        ))}
      </div>
      <div className="picker-actions">
        <button onClick={() => props.onChange(writable.map((p) => p.path))}>Select all</button>
        <button onClick={() => props.onChange([])}>Clear</button>
      </div>
    </div>
  );
}
