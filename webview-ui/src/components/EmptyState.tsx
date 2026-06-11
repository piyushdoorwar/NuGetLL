import { ReactNode } from "react";
import { IconPackage } from "./Icons";

export function EmptyState(props: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="empty-state">
      <div className="icon" aria-hidden="true">
        {props.icon ?? <IconPackage size={30} />}
      </div>
      <h3>{props.title}</h3>
      {props.hint && <p>{props.hint}</p>}
      {props.actionLabel && props.onAction && (
        <button className="btn btn-primary" onClick={props.onAction}>
          {props.actionLabel}
        </button>
      )}
    </div>
  );
}
