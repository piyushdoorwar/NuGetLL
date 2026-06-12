import { useState } from "react";
import { post } from "../api/vscodeApi";
import { PackageSource } from "../types";
import { ConfirmDialog } from "./ConfirmDialog";
import { EmptyState } from "./EmptyState";
import { IconGlobe, IconLock } from "./Icons";

interface CredForm {
  sourceName: string;
  credType: "pat" | "basic";
  username: string;
  password: string;
  error?: string;
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

  const openCredForm = (source: PackageSource) => {
    setCredForm({ sourceName: source.name, credType: "pat", username: "", password: "" });
  };

  const saveCredential = () => {
    if (!credForm) {
      return;
    }
    if (!credForm.password.trim()) {
      setCredForm({ ...credForm, error: "Password / token is required." });
      return;
    }
    post({
      type: "saveCredential",
      sourceName: credForm.sourceName,
      credType: credForm.credType,
      username: credForm.username.trim() || undefined,
      password: credForm.password.trim()
    });
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
                  {!source.enabled && (
                    <span className="tag" style={{ marginLeft: 4 }}>disabled</span>
                  )}
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
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                      <label style={{ fontSize: 12, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>Auth type</label>
                      <select
                        value={credForm.credType}
                        onChange={(e) => setCredForm({ ...credForm, credType: e.target.value as "pat" | "basic" })}
                        style={{ fontSize: 12, padding: "3px 6px", background: "var(--input-bg)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text)" }}
                      >
                        <option value="pat">PAT (Personal Access Token)</option>
                        <option value="basic">Basic (username + password)</option>
                      </select>
                    </div>
                    {credForm.credType === "basic" && (
                      <input
                        type="text"
                        placeholder="Username"
                        value={credForm.username}
                        onChange={(e) => setCredForm({ ...credForm, username: e.target.value })}
                        style={{ marginBottom: 6, width: "100%" }}
                      />
                    )}
                    <input
                      type="password"
                      placeholder={credForm.credType === "pat" ? "Personal Access Token" : "Password"}
                      value={credForm.password}
                      onChange={(e) => setCredForm({ ...credForm, password: e.target.value })}
                      onKeyDown={(e) => e.key === "Enter" && saveCredential()}
                      style={{ marginBottom: 6, width: "100%" }}
                      autoFocus
                    />
                    {credForm.error && <div className="alert error" style={{ marginBottom: 6 }}>{credForm.error}</div>}
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn btn-primary btn-sm" onClick={saveCredential}>Save credential</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setCredForm(undefined)}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
              <div className="actions">
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => { setEditing(source.name); setEditUrl(source.url); }}
                >
                  Edit
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => credForm?.sourceName === source.name ? setCredForm(undefined) : openCredForm(source)}
                >
                  {source.hasCredentials ? "Update creds" : "Set credentials"}
                </button>
                {source.hasCredentials && (
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ color: "var(--danger)" }}
                    onClick={() => post({ type: "removeCredential", sourceName: source.name })}
                  >
                    Clear creds
                  </button>
                )}
                {source.enabled ? (
                  <button className="btn btn-ghost btn-sm" onClick={() => post({ type: "disableSource", name: source.name })}>
                    Disable
                  </button>
                ) : (
                  <button className="btn btn-secondary btn-sm" onClick={() => post({ type: "enableSource", name: source.name })}>
                    Enable
                  </button>
                )}
                <button className="btn btn-danger btn-sm" onClick={() => setRemoveTarget(source)}>
                  Remove
                </button>
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
          if (removeTarget) {
            post({ type: "removeSource", name: removeTarget.name });
          }
          setRemoveTarget(undefined);
        }}
        onCancel={() => setRemoveTarget(undefined)}
      />
    </div>
  );
}
