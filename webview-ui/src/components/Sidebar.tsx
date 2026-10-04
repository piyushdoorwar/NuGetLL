import { ReactNode } from "react";
import { TabId } from "../types";
import {
  IconDashboard,
  IconGlobe,
  IconInstalled,
  IconSearch,
  IconSettings,
  IconShield,
  IconUpdate,
  IconLogo,
} from "./Icons";

interface Counts {
  projects: number;
  installed: number;
  outdated?: number;
  vulnerable?: number;
  sources?: number;
}
const GROUPS: {
  label: string;
  items: {
    id: TabId;
    label: string;
    icon: ReactNode;
    countKey?: keyof Counts;
  }[];
}[] = [
  {
    label: "Workspace",
    items: [
      { id: "overview", label: "Overview", icon: <IconDashboard size={17} /> },
      {
        id: "browse",
        label: "Browse packages",
        icon: <IconSearch size={17} />,
      },
      {
        id: "installed",
        label: "Installed",
        icon: <IconInstalled size={17} />,
        countKey: "installed",
      },
    ],
  },
  {
    label: "Health",
    items: [
      {
        id: "updates",
        label: "Updates",
        icon: <IconUpdate size={17} />,
        countKey: "outdated",
      },
      {
        id: "vulnerabilities",
        label: "Vulnerabilities",
        icon: <IconShield size={17} />,
        countKey: "vulnerable",
      },
    ],
  },
  {
    label: "Manage",
    items: [
      {
        id: "sources",
        label: "Package sources",
        icon: <IconGlobe size={17} />,
        countKey: "sources",
      },
      { id: "settings", label: "Settings", icon: <IconSettings size={17} /> },
    ],
  },
];

export function Sidebar(props: {
  tab: TabId;
  counts: Counts;
  onSelect: (tab: TabId) => void;
}) {
  return (
    <aside className="workspace-sidebar">
      <div className="sidebar-brand">
        <IconLogo size={28} stroke="#1f9cf0" />
        <div>
          <strong>NuGet LL</strong>
          <span>Package manager</span>
        </div>
      </div>
      <nav className="workspace-nav" aria-label="Package manager views">
        {GROUPS.map((group) => (
          <div className="nav-group" key={group.label}>
            <p className="nav-label">{group.label}</p>
            {group.items.map((item) => {
              const count = item.countKey
                ? props.counts[item.countKey]
                : undefined;
              return (
                <button
                  key={item.id}
                  aria-current={props.tab === item.id ? "page" : undefined}
                  className={props.tab === item.id ? "active" : ""}
                  onClick={() => props.onSelect(item.id)}
                  title={item.label}
                  aria-label={item.label}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-title">{item.label}</span>
                  {count !== undefined && (
                    <span className="count">{count}</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="sidebar-workspace">
        <span className="workspace-dot" />
        <div>
          <strong>.NET workspace</strong>
          <span>
            {props.counts.projects} projects · {props.counts.installed} packages
          </span>
        </div>
      </div>
    </aside>
  );
}
