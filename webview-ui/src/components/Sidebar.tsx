import { TabId } from "../types";

const TABS: { id: TabId; label: string; icon: string; countKey?: keyof Counts }[] = [
  { id: "overview", label: "Overview", icon: "◫" },
  { id: "browse", label: "Browse", icon: "⌕" },
  { id: "installed", label: "Installed", icon: "▣", countKey: "installed" },
  { id: "updates", label: "Updates", icon: "↑", countKey: "outdated" },
  { id: "vulnerabilities", label: "Vulnerabilities", icon: "⛨", countKey: "vulnerable" },
  { id: "sources", label: "Sources", icon: "⊕", countKey: "sources" },
  { id: "settings", label: "Settings", icon: "⚙" }
];

interface Counts {
  projects: number;
  installed: number;
  outdated?: number;
  vulnerable?: number;
  sources?: number;
}

export function Sidebar(props: { tab: TabId; counts: Counts; onSelect: (tab: TabId) => void }) {
  return (
    <nav className="sidebar">
      {TABS.map((t) => {
        const count = t.countKey !== undefined ? props.counts[t.countKey] : undefined;
        return (
          <button
            key={t.id}
            className={props.tab === t.id ? "active" : ""}
            onClick={() => props.onSelect(t.id)}
          >
            <span aria-hidden="true">{t.icon}</span>
            {t.label}
            {count !== undefined && <span className="count">{count}</span>}
          </button>
        );
      })}
    </nav>
  );
}
