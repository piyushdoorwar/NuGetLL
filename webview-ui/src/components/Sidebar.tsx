import { ReactNode } from "react";
import { TabId } from "../types";
import {
  IconDashboard,
  IconGlobe,
  IconInstalled,
  IconSearch,
  IconSettings,
  IconShield,
  IconUpdate
} from "./Icons";

interface Counts {
  projects: number;
  installed: number;
  outdated?: number;
  vulnerable?: number;
  sources?: number;
}

const TABS: { id: TabId; label: string; icon: ReactNode; countKey?: keyof Counts }[] = [
  { id: "overview", label: "Overview", icon: <IconDashboard size={17} /> },
  { id: "browse", label: "Browse", icon: <IconSearch size={17} /> },
  { id: "installed", label: "Installed", icon: <IconInstalled size={17} />, countKey: "installed" },
  { id: "updates", label: "Updates", icon: <IconUpdate size={17} />, countKey: "outdated" },
  { id: "vulnerabilities", label: "Vulnerabilities", icon: <IconShield size={16} />, countKey: "vulnerable" },
  { id: "sources", label: "Sources", icon: <IconGlobe size={17} />, countKey: "sources" },
  { id: "settings", label: "Settings", icon: <IconSettings size={17} /> }
];

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
            <span className="tab-icon">{t.icon}</span>
            {t.label}
            {count !== undefined && <span className="count">{count}</span>}
          </button>
        );
      })}
    </nav>
  );
}
