import { useEffect, useState } from "react";
import { PackageSearchResult } from "../types";
import { EmptyState } from "./EmptyState";
import { IconDownload, IconPackage, IconSearch, IconVerified } from "./Icons";

function formatDownloads(count?: number): string | undefined {
  if (count === undefined) {
    return undefined;
  }
  if (count >= 1_000_000_000) {
    return `${(count / 1_000_000_000).toFixed(1)}B`;
  }
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}K`;
  }
  return String(count);
}

export function SearchPackages(props: {
  query: string;
  results?: PackageSearchResult[];
  searching: boolean;
  defaultPrerelease: boolean;
  selectedId?: string;
  onSearch: (query: string, includePrerelease: boolean, exactMatch: boolean) => void;
  onSelect: (packageId: string) => void;
}) {
  const [text, setText] = useState(props.query);
  const [prerelease, setPrerelease] = useState(props.defaultPrerelease);
  const [exact, setExact] = useState(false);

  useEffect(() => setText(props.query), [props.query]);

  const submit = () => props.onSearch(text, prerelease, exact);

  return (
    <div>
      <h2>Browse packages</h2>
      <p className="section-hint">Search nuget.org and configured feeds. Press Enter to search.</p>
      <div className="search-bar">
        <input
          type="search"
          value={text}
          placeholder="Search packages, e.g. Serilog.AspNetCore"
          autoFocus
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              submit();
            }
          }}
        />
        <button className="btn btn-primary" onClick={submit} disabled={props.searching || text.trim().length === 0}>
          {props.searching ? "Searching..." : "Search"}
        </button>
      </div>
      <div className="search-filters">
        <label className="checkbox">
          <input type="checkbox" checked={prerelease} onChange={(e) => setPrerelease(e.target.checked)} />
          Include prerelease
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={exact} onChange={(e) => setExact(e.target.checked)} />
          Exact package ID
        </label>
      </div>

      {props.searching && !props.results && (
        <div className="empty-state">
          <span className="spinner" style={{ display: "inline-block" }} />
          <p>Searching…</p>
        </div>
      )}

      {props.results && props.results.length === 0 && (
        <EmptyState icon={<IconSearch size={30} />} title="No packages found" hint={`Nothing matched "${props.query}".`} />
      )}

      {props.results?.map((result) => (
        <div
          key={`${result.source}:${result.id}`}
          className={`pkg-card ${props.selectedId?.toLowerCase() === result.id.toLowerCase() ? "selected" : ""}`}
          onClick={() => props.onSelect(result.id)}
        >
          <div className="pkg-icon">
            {result.iconUrl ? <img src={result.iconUrl} alt="" loading="lazy" /> : <IconPackage size={19} />}
          </div>
          <div className="pkg-main">
            <div className="pkg-title">
              <span className="name">{result.id}</span>
              <span className="version">{result.version}</span>
              {result.verified && (
                <span className="verified" title="Verified">
                  <IconVerified size={15} />
                </span>
              )}
            </div>
            {result.description && <p className="pkg-desc">{result.description}</p>}
            <div className="pkg-meta">
              {formatDownloads(result.totalDownloads) && (
                <span className="meta-item">
                  <IconDownload size={11} /> {formatDownloads(result.totalDownloads)}
                </span>
              )}
              {result.authors.length > 0 && <span>by {result.authors.join(", ")}</span>}
              <span>{result.source}</span>
              {result.tags.slice(0, 5).map((tag) => (
                <span key={tag} className="tag">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
