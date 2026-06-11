import { useState } from "react";
import { post } from "../api/vscodeApi";
import { PackageSource } from "../types";
import { ConfirmDialog } from "./ConfirmDialog";
import { EmptyState } from "./EmptyState";

export function SourcesView(props: { sources?: PackageSource[]; busy: boolean }) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [removeTarget, setRemoveTarget] = useState<PackageSource>();
  const [formError, setFormError] = useState<string>();

  const add = () => {
    if (!name.trim() || !url.trim()) {
      setFormError("Both a name and a URL/path are required.");
      return;
    }
    if (/:\/\/[^/]*:[^/@]*@/.test(url)) {
      setFormError("Do not embed credentials in the URL. Use a NuGet credential provider for authenticated feeds.");
      return;
    }
    setFormError(undefined);
    post({ type: "addSource", name: name.trim(), url: url.trim() });
    setName("");
    setUrl("");
  };

  return (
    <div>
      <h2>Package sources</h2>
      <p className="section-hint">
        Sources are managed through dotnet nuget and your NuGet.Config files. Credentials are never stored or logged
        by GetLL — use a credential provider for private feeds.
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
          <EmptyState icon="⊕" title="No package sources found" hint="Add a source above or check your NuGet.Config." />
        )}
        {props.sources?.map((source) => (
          <div key={source.name} className="card">
            <div className="source-row">
              <span className={`dot ${source.enabled ? "" : "off"}`} />
              <div className="info">
                <div className="name">
                  {source.name}
                  {!source.enabled && (
                    <span className="tag" style={{ marginLeft: 8 }}>
                      disabled
                    </span>
                  )}
                </div>
                <div className="url">{source.url}</div>
                {source.configPath && (
                  <div className="url">
                    config:{" "}
                    <a href="#config" onClick={() => post({ type: "openFile", path: source.configPath! })}>
                      {source.configPath}
                    </a>
                  </div>
                )}
              </div>
              <div className="actions">
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
        body={`${removeTarget?.url ?? ""}\n\nThis edits your NuGet configuration.`}
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
