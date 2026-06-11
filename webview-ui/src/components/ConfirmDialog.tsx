export function ConfirmDialog(props: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!props.open) {
    return null;
  }
  return (
    <div className="dialog-overlay" onClick={props.onCancel}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h3>{props.title}</h3>
        <div className="dialog-body">{props.body}</div>
        <div className="dialog-actions">
          <button className="btn btn-ghost" onClick={props.onCancel}>
            Cancel
          </button>
          <button
            className={`btn ${props.danger ? "btn-danger" : "btn-primary"}`}
            onClick={props.onConfirm}
            autoFocus
          >
            {props.confirmLabel ?? "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
