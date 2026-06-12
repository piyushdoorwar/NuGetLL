import { useState } from "react";
import { post } from "../api/vscodeApi";
import { PackageSource } from "../types";
import { ConfirmDialog } from "./ConfirmDialog";
import { EmptyState } from "./EmptyState";
import { IconEdit, IconEye, IconEyeOff, IconGlobe, IconKey, IconLock, IconLockOff, IconTrash } from "./Icons";

interface CredForm {
  sourceName: string;
  email: string;
  token: string;
  error?: string;
}

function IconBtn(props: {
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
  danger?: boolean;
  accent?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      className="btn-icon"
      title={props.title}
      onClick={props.onClick}
      disabled={props.disabled}
      style={{ color: props.danger ? "var(--danger)" : props.accent ? "var(--accent)" : undefined }}
    >
      {props.icon}
    </button>
  );
}

export function SourcesView(props: { sources?: PackageSource[]; busy: boolean }) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [removeTarget, setRemoveTarget] = useState<PackageSource>();
  const [formError, setFormError] = useState<string>();
  const [editing, setEditing] = useState<string>();
  const [editUrl, setEditUrl] = useState("");
  const [credForm, setCredForm] = useState<CredForm>();

  const saveEdit = (source: PackageSource) => {
    const trimmed = editUrl.trim();
    if (trimmed && trimmed !== source.url) {
      post({ type: "updateSource", name: source.name, url: trimmed });
    }
    setEditing(undefined);
  };

  const add = () => {
    if (!name.trim() || !url.trim()) {
      setFormError("Both a name and a URL/path are required.");
      return;
    }
    if (/:\/\/[^/]*:[^/@]*@/.test(url)) {
      setFormError("Do not embed credentials in the URL — use the credential fields on the source row instead.");
      return;
    }
    setFormError(undefined);
    post({ type: "addSource", name: name.trim(), url: url.trim() });
    setName("");
    setUrl("");
  };

  const saveCredential = () => {
    if (!credForm) return;
    if (!credForm.email.trim()) {
      setCredForm({ ...credForm, error: "Email is required." });
      return;
    }
    if (!credForm.token.trim()) {
      setCredForm({ ...credForm, error: "Personal Access Token is required." });
      return;
    }
    post({ type: "saveCredential", sourceName: credForm.sourceName, email: credForm.email.trim(), token: credForm.token.trim() });
    setCredForm(undefined);
  };

  return (
    <div>
      <h2>Package sources</h2>
      <p className="section-hint">
        Sources are managed through dotnet nuget and your NuGet.Config files. Credentials are
        stored in VS Code&apos;s encrypted secret storage — never written to disk or logs.
      </p>

      <div className="card">
        <h4 style={{ margin: "0 0 10px", color: "var(--text-secondary)" }}>Add source</h4>
        <div className="add-source-form">
          <input type="text" placeholder="Name (e.g. my-feed)" value={name} onChange={(e) => setName(e.target.value)} />
          <input
            type="text"
            placeholder="https://example.com/v3/index.json or local path"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <button className="btn btn-primary" onClick={add} disabled={props.busy}>
            Add source
          </button>
        </div>
        {formError && <div className="alert error">{formError}</div>}
      </div>

      <div style={{ marginTop: 16 }}>
        {props.sources === undefined && <p className="section-hint">Loading sources…</p>}
        {props.sources !== undefined && props.sources.length === 0 && (
          <EmptyState icon={<IconGlobe size={30} />} title="No package sources found" hint="Add a source above or check your NuGet.Config." />
        )}
        {props.sources?.map((source) => (
          <div key={source.name} className="card" style={{ marginBottom: 8 }}>
            <div className="source-row">
              <span className={`dot ${source.enabled ? "" : "off"}`} />
              <div className="info">
                <div className="name" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {source.name}
                  {source.hasCredentials && (
                    <span title="Credentials stored" style={{ display: "inline-flex", color: "var(--accent)" }}>
                      <IconLock size={13} />
                    </span>
                  )}
                  {!source.enabled && <span className="tag" style={{ marginLeft: 4 }}>disabled</span>}
                </div>

                {editing === source.name ? (
                  <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                    <input
                      type="text"
                      value={editUrl}
                      onChange={(e) => setEditUrl(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveEdit(source)}
                      style={{ flex: 1 }}
                      autoFocus
                    />
                    <button className="btn btn-primary btn-sm" onClick={() => saveEdit(source)}>Save</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditing(undefined)}>Cancel</button>
                  </div>
                ) : (
                  <div className="url">{source.url}</div>
                )}

                {source.configPath && (
                  <div className="url">
                    config:{" "}
                    <a href="#config" onClick={() => post({ type: "openFile", path: source.configPath! })}>
                      {source.configPath}
                    </a>
                  </div>
                )}

                {credForm?.sourceName === source.name && (
                  <div className="cred-form">
                    <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--text-secondary)" }}>
                      Enter your email and Personal Access Token for <strong>{source.name}</strong>.
                    </p>
                    <input
                      type="email"
                      placeholder="Email"
                      value={credForm.email}
                      onChange={(e) => setCredForm({ ...credForm, email: e.target.value })}
                      style={{ marginBottom: 6, width: "100%" }}
                      autoFocus
                    />
                    <input
                      type="password"
                      placeholder="Personal Access Token"
                      value={credForm.token}
                      onChange={(e) => setCredForm({ ...credForm, token: e.target.value })}
                      onKeyDown={(e) => e.key === "Enter" && saveCredential()}
                      style={{ marginBottom: 6, width: "100%" }}
                    />
                    {credForm.error && <div className="alert error" style={{ marginBottom: 6 }}>{credForm.error}</div>}
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn btn-primary btn-sm" onClick={saveCredential}>Save</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setCredForm(undefined)}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>

              <div className="actions" style={{ gap: 2 }}>
                <IconBtn icon={<IconEdit size={15} />} title="Edit URL" onClick={() => { setEditing(source.name); setEditUrl(source.url); }} />
                <IconBtn
                  icon={<IconKey size={15} />}
                  title={source.hasCredentials ? "Update credentials" : "Set credentials"}
                  accent={source.hasCredentials}
                  onClick={() => credForm?.sourceName === source.name ? setCredForm(undefined) : setCredForm({ sourceName: source.name, email: "", token: "" })}
                />
                {source.hasCredentials && (
                  <IconBtn icon={<IconLockOff size={15} />} title="Clear credentials" onClick={() => post({ type: "removeCredential", sourceName: source.name })} />
                )}
                {source.enabled ? (
                  <IconBtn icon={<IconEyeOff size={15} />} title="Disable source" onClick={() => post({ type: "disableSource", name: source.name })} />
                ) : (
                  <IconBtn icon={<IconEye size={15} />} title="Enable source" accent onClick={() => post({ type: "enableSource", name: source.name })} />
                )}
                <IconBtn icon={<IconTrash size={15} />} title="Remove source" danger onClick={() => setRemoveTarget(source)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={removeTarget !== undefined}
        title={`Remove source "${removeTarget?.name}"?`}
        body={`${removeTarget?.url ?? ""}\n\nThis edits your NuGet configuration.${removeTarget?.hasCredentials ? "\n\nStored credentials for this source will also be deleted." : ""}`}
        danger
        confirmLabel="Remove"
        onConfirm={() => {
          if (removeTarget) post({ type: "removeSource", name: removeTarget.name });
          setRemoveTarget(undefined);
        }}
        onCancel={() => setRemoveTarget(undefined)}
      />
    </div>
  );
}
