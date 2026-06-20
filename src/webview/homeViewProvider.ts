import * as vscode from "vscode";
import { GetllServices } from "../services/container";
import { DashboardPanel } from "./dashboardPanel";

function nonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let value = "";
  for (let i = 0; i < 32; i++) {
    value += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return value;
}

/**
 * The single activity-bar view: a small webview launcher that opens the full
 * dashboard. No native tree UI — everything lives in webviews.
 */
export class HomeViewProvider implements vscode.WebviewViewProvider {
  static readonly viewId = "getll.home";
  private autoOpened = false;
  private view?: vscode.WebviewView;
  private cachedSourceCount: number | "—" = "—";

  constructor(private readonly services: GetllServices) {
    this.refreshSources();
  }

  private refreshSources(): void {
    this.services.sources.listSources().then((sources) => {
      this.cachedSourceCount = sources.length;
      this.push();
    }).catch(() => {});
  }

  /** Push fresh stats to the sidebar (called after scan / check operations). */
  push(refreshSources = false): void {
    if (!this.view) {
      return;
    }
    if (refreshSources) {
      this.refreshSources();
      return;
    }
    const { projects, packages, outdated, vulnerable, sources, sdk, frameworks, projectList } =
      this.stats();
    this.view.webview.postMessage({
      type: "stats",
      projects,
      packages,
      outdated,
      vulnerable,
      sources,
      sdk,
      frameworks,
      projectList
    });
  }

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = { enableScripts: true };
    view.webview.html = this.html(view.webview);

    view.webview.onDidReceiveMessage((message: { command: string; tab?: string }) => {
      if (message.command === "open") {
        DashboardPanel.createOrShow(this.services, { tab: message.tab });
      }
      if (message.command === "ready") {
        this.push();
      }
    });

    // Clicking the activity bar icon is the "open NuGet LL" gesture: surface the
    // dashboard immediately the first time the view becomes visible.
    if (!this.autoOpened) {
      this.autoOpened = true;
      DashboardPanel.createOrShow(this.services);
    }
  }

  private stats() {
    const model = this.services.scanner.getModel();
    const projects = model?.projects.length ?? 0;
    const packages = new Set(
      (model?.projects ?? []).flatMap((p) =>
        p.packages.filter((pkg) => !pkg.isTransitive).map((pkg) => pkg.id)
      )
    ).size;
    const outdated = this.services.results.outdated?.length ?? "—";
    const vulnerable = this.services.results.vulnerable?.length ?? "—";
    const sources = this.cachedSourceCount;
    const sdk = model?.dotnetSdkVersion ?? this.services.dotnet.version ?? null;
    const frameworks = [
      ...new Set((model?.projects ?? []).flatMap((p) => p.targetFrameworks))
    ].sort();
    const projectList = (model?.projects ?? []).map((p) => ({
      name: p.name,
      tfm: p.targetFrameworks[0] ?? "",
      pkgCount: p.packages.filter((pkg) => !pkg.isTransitive).length
    }));
    return { projects, packages, outdated, vulnerable, sources, sdk, frameworks, projectList };
  }

  private html(webview: vscode.Webview): string {
    const { projects, packages, outdated, vulnerable, sources, sdk, frameworks, projectList } =
      this.stats();
    const scriptNonce = nonce();

    // Brand mark: 3D package cube inside a magnifying-glass lens (media/getll.svg).
    const logoSvg = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <g transform="translate(4 4) scale(0.5)">
        <path d="M8.42229 20.6181C10.1779 21.5395 11.0557 22.0001 12 22.0001V12.0001L2.63802 7.07275C2.62423 7.09491 2.6107 7.11727 2.5974 7.13986C2 8.15436 2 9.41678 2 11.9416V12.0586C2 14.5834 2 15.8459 2.5974 16.8604C3.19479 17.8749 4.27063 18.4395 6.42229 19.5686L8.42229 20.6181Z" fill="#007acc"/>
        <path opacity="0.7" d="M17.5774 4.43152L15.5774 3.38197C13.8218 2.46066 12.944 2 11.9997 2C11.0554 2 10.1776 2.46066 8.42197 3.38197L6.42197 4.43152C4.31821 5.53552 3.24291 6.09982 2.6377 7.07264L11.9997 12L21.3617 7.07264C20.7564 6.09982 19.6811 5.53552 17.5774 4.43152Z" fill="#007acc"/>
        <path opacity="0.5" d="M21.4026 7.13986C21.3893 7.11727 21.3758 7.09491 21.362 7.07275L12 12.0001V22.0001C12.9443 22.0001 13.8221 21.5395 15.5777 20.6181L17.5777 19.5686C19.7294 18.4395 20.8052 17.8749 21.4026 16.8604C22 15.8459 22 14.5834 22 12.0586V11.9416C22 9.41678 22 8.15436 21.4026 7.13986Z" fill="#007acc"/>
      </g>
      <g stroke="#1f9cf0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="10" cy="10" r="7.5"/>
        <path d="M15.3 15.3 L21 21"/>
      </g>
    </svg>`;

    const si = (paths: string, sz = 14, vb = "0 0 24 24", sw = 2) =>
      `<svg width="${sz}" height="${sz}" viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

    const frameworksHtml = (tfms: string[]) =>
      tfms.length
        ? tfms.map((f) => `<span class="chip">${f}</span>`).join("")
        : `<span class="chip muted">—</span>`;

    const projectListHtml = (list: { name: string; tfm: string; pkgCount: number }[]) =>
      list.length
        ? list
            .map(
              (p) =>
                `<div class="proj-row" data-open="installed">
                  <span class="proj-name">${p.name}</span>
                  <span class="proj-meta">${p.pkgCount} pkg${p.pkgCount !== 1 ? "s" : ""}</span>
                </div>`
            )
            .join("")
        : `<div style="color:#7a7a7a;font-size:11px;padding:6px 0">No projects found.</div>`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data:; style-src 'unsafe-inline'; script-src 'nonce-${scriptNonce}';" />
<style>
  * { box-sizing: border-box; }
  ::-webkit-scrollbar { width: 8px; }
  ::-webkit-scrollbar-thumb { background: #0065a9; border-radius: 99px; }
  ::-webkit-scrollbar-thumb:hover { background: #1f9cf0; }
  body {
    font-family: var(--vscode-font-family);
    color: #f4f4f4;
    background: transparent;
    padding: 16px 12px 24px;
    -webkit-font-smoothing: antialiased;
  }
  .logo {
    width: 46px; height: 46px; border-radius: 13px;
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 12px; color: #1f9cf0;
  }
  h2 { margin: 0 0 2px; font-size: 15px; letter-spacing: -0.2px; }
  p { margin: 0 0 16px; color: #b8b8b8; font-size: 12px; }
  button.primary {
    display: flex; align-items: center; justify-content: center;
    gap: 9px; width: 100%;
    background: linear-gradient(180deg, #1f9cf0, #007acc); color: #06243a;
    font-weight: 700; border: none; border-radius: 9px;
    padding: 9px 13px; margin-bottom: 18px;
    font-size: 12.5px; cursor: pointer; font-family: inherit;
    box-shadow: 0 2px 12px rgba(31, 156, 240, 0.25);
    transition: filter 0.15s ease;
  }
  button.primary:hover { filter: brightness(1.07); }
  /* stat cards */
  .cards { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 20px; }
  .card {
    background: #181818; border: 1px solid #262626;
    border-radius: 10px; padding: 12px 13px;
    cursor: pointer; transition: border-color 0.15s ease, transform 0.15s ease;
  }
  .card:hover { border-color: #007acc; transform: translateY(-1px); }
  .card .value { font-size: 24px; font-weight: 700; letter-spacing: -0.5px; color: #1f9cf0; line-height: 1.1; }
  .card .value.neutral { color: #f4f4f4; }
  .card .value.bad { color: #e5534b; }
  .card .label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.7px; color: #7a7a7a; margin-top: 3px; }
  /* section label */
  .sec { font-size: 10px; font-weight: 600; letter-spacing: 0.8px; text-transform: uppercase; color: #5a5a5a; margin: 18px 0 8px; }
  /* quick actions */
  .actions { display: flex; flex-direction: column; gap: 6px; }
  .action {
    display: flex; align-items: center; gap: 9px; width: 100%;
    background: #181818; border: 1px solid #262626; color: #c8c8c8;
    border-radius: 8px; padding: 8px 12px;
    font-size: 12px; cursor: pointer; font-family: inherit;
    transition: border-color 0.15s, color 0.15s, background 0.15s;
  }
  .action:hover { border-color: #007acc; color: #f4f4f4; background: #1e1e1e; }
  .action svg { color: #007acc; flex-shrink: 0; }
  /* workspace info */
  .info-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
  .info-key { font-size: 11.5px; color: #7a7a7a; }
  .sdk-badge {
    font-family: "SF Mono", Consolas, monospace; font-size: 11px;
    background: rgba(31,156,240,0.1); color: #1f9cf0;
    border: 1px solid rgba(31,156,240,0.25); border-radius: 99px;
    padding: 2px 9px;
  }
  .chips { display: flex; flex-wrap: wrap; gap: 5px; }
  .chip {
    background: #1e1e1e; border: 1px solid #2a2a2a;
    border-radius: 99px; padding: 2px 9px;
    font-size: 10.5px; color: #a0a0a0;
    font-family: "SF Mono", Consolas, monospace;
  }
  .chip.muted { color: #5a5a5a; }
  /* projects list */
  .proj-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 7px 10px; border-radius: 7px; cursor: pointer;
    transition: background 0.12s;
  }
  .proj-row:hover { background: #1e1e1e; }
  .proj-name { font-size: 12px; color: #d0d0d0; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .proj-meta { font-size: 10.5px; color: #5a5a5a; flex-shrink: 0; margin-left: 8px; }
</style>
</head>
<body>
  <div class="logo">${logoSvg}</div>
  <h2>NuGet LL</h2>
  <p>NuGet package management and Library Lens.</p>
  <button class="primary" data-open="overview">Open Dashboard</button>

  <div class="cards">
    <div class="card" data-open="overview">
      <div class="value neutral" id="val-projects">${projects}</div>
      <div class="label">Projects</div>
    </div>
    <div class="card" data-open="installed">
      <div class="value" id="val-packages">${packages}</div>
      <div class="label">Packages</div>
    </div>
    <div class="card" data-open="updates">
      <div class="value${typeof outdated === "number" && outdated > 0 ? " bad" : ""}" id="val-outdated">${outdated}</div>
      <div class="label">Outdated</div>
    </div>
    <div class="card" data-open="vulnerabilities">
      <div class="value${typeof vulnerable === "number" && vulnerable > 0 ? " bad" : ""}" id="val-vulnerable">${vulnerable}</div>
      <div class="label">Vulnerable</div>
    </div>
    <div class="card" data-open="sources">
      <div class="value neutral" id="val-sources">${sources}</div>
      <div class="label">Sources</div>
    </div>
  </div>

  <div class="sec">Workspace</div>
  <div class="info-row">
    <span class="info-key">SDK</span>
    <span class="sdk-badge" id="val-sdk">${sdk ? `dotnet ${sdk}` : "—"}</span>
  </div>
  <div class="chips" id="val-frameworks">${frameworksHtml(frameworks)}</div>

  <div class="sec">Projects</div>
  <div id="val-project-list">${projectListHtml(projectList)}</div>

  <script nonce="${scriptNonce}">
    const vscode = acquireVsCodeApi();
    function open_(tab) { vscode.postMessage({ command: "open", tab }); }
    // Event delegation: inline onclick handlers are blocked by the webview CSP,
    // so route every [data-open] element through a single listener instead.
    document.addEventListener("click", (e) => {
      const el = e.target.closest("[data-open]");
      if (el) open_(el.getAttribute("data-open"));
    });
    vscode.postMessage({ command: "ready" });
    window.addEventListener("message", (e) => {
      const m = e.data;
      if (m.type !== "stats") return;
      set("val-projects", m.projects, false);
      set("val-packages", m.packages, false);
      set("val-outdated", m.outdated, true);
      set("val-vulnerable", m.vulnerable, true);
      set("val-sources", m.sources, false);
      const sdkEl = document.getElementById("val-sdk");
      if (sdkEl) sdkEl.textContent = m.sdk ? "dotnet " + m.sdk : "—";
      const fwEl = document.getElementById("val-frameworks");
      if (fwEl) fwEl.innerHTML = m.frameworks.length
        ? m.frameworks.map(f => '<span class="chip">' + f + '</span>').join("")
        : '<span class="chip muted">—</span>';
      const plEl = document.getElementById("val-project-list");
      if (plEl) plEl.innerHTML = m.projectList.length
        ? m.projectList.map(p => '<div class="proj-row" data-open="installed">' +
            '<span class="proj-name">' + p.name + '</span>' +
            '<span class="proj-meta">' + p.pkgCount + ' pkg' + (p.pkgCount !== 1 ? 's' : '') + '</span></div>').join("")
        : '<div style="color:#7a7a7a;font-size:11px;padding:6px 0">No projects found.</div>';
    });
    function set(id, val, bad) {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = String(val);
      el.className = "value" + (bad && typeof val === "number" && val > 0 ? " bad" : !bad ? " neutral" : "");
    }
  </script>
</body>
</html>`;
  }
}
