import { CheckProgressInfo } from "../types";

/**
 * Inline "still working" banner shown while a streaming check runs. Results are
 * already rendered below it as each project finishes; this just reports how far
 * along the scan is, reusing the same spinner as the status bar.
 */
export function CheckProgress(props: { progress?: CheckProgressInfo; noun: string }) {
  const { progress, noun } = props;
  const label = progress
    ? `Reviewing ${progress.completed}/${progress.total} ${noun}${progress.total === 1 ? "" : "s"}…`
    : "Starting…";
  return (
    <div className="check-progress">
      <span className="spinner" />
      <span>{label}</span>
    </div>
  );
}
