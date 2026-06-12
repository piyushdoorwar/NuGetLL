import * as vscode from "vscode";
import { GetllServices } from "../services/container";
import { DashboardPanel } from "./dashboardPanel";

/**
 * The single activity-bar view: a small webview launcher that opens the full
 * dashboard. No native tree UI — everything lives in webviews.
 */
export class HomeViewProvider implements vscode.WebviewViewProvider {
  static readonly viewId = "getll.home";
  private autoOpened = false;
  private view?: vscode.WebviewView;

  constructor(private readonly services: GetllServices) {}

  /** Push fresh stats to the sidebar (called after scan / check operations). */
  push(): void {
    if (!this.view) {
      return;
    }
    const model = this.services.scanner.getModel();
    const projects = model?.projects.length ?? 0;
    const packages = new Set(
      (model?.projects ?? []).flatMap((p) =>
        p.packages.filter((pkg) => !pkg.isTransitive).map((pkg) => pkg.id)
      )
    ).size;
    const outdated = this.services.results.outdated?.length ?? "—";
    const vulnerable = this.services.results.vulnerable?.length ?? "—";
    const sources = model?.sources?.length ?? "—";
    this.view.webview.postMessage({ type: "stats", projects, packages, outdated, vulnerable, sources });
  }

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = { enableScripts: true };
    view.webview.html = this.html();

    view.webview.onDidReceiveMessage((message: { command: string; tab?: string }) => {
      if (message.command === "open") {
        DashboardPanel.createOrShow(this.services, { tab: message.tab });
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
    const sources = model?.sources?.length ?? "—";
    return { projects, packages, outdated, vulnerable, sources };
  }

  private html(): string {
    const { projects, packages, outdated, vulnerable, sources } = this.stats();
    const logoPath =
      "M20.5 7.27783L12 12.0001M12 12.0001L3.49997 7.27783M12 12.0001L12 21.5001M14 20.889L12.777 21.5684C12.4934 21.726 12.3516 21.8047 12.2015 21.8356C12.0685 21.863 11.9315 21.863 11.7986 21.8356C11.6484 21.8047 11.5066 21.726 11.223 21.5684L3.82297 17.4573C3.52346 17.2909 3.37368 17.2077 3.26463 17.0893C3.16816 16.9847 3.09515 16.8606 3.05048 16.7254C3 16.5726 3 16.4013 3 16.0586V7.94153C3 7.59889 3 7.42757 3.05048 7.27477C3.09515 7.13959 3.16816 7.01551 3.26463 6.91082C3.37368 6.79248 3.52345 6.70928 3.82297 6.54288L11.223 2.43177C11.5066 2.27421 11.6484 2.19543 11.7986 2.16454C11.9315 2.13721 12.0685 2.13721 12.2015 2.16454C12.3516 2.19543 12.4934 2.27421 12.777 2.43177L20.177 6.54288C20.4766 6.70928 20.6263 6.79248 20.7354 6.91082C20.8318 7.01551 20.9049 7.13959 20.9495 7.27477C21 7.42757 21 7.59889 21 7.94153L21 12.5001M7.5 4.50008L16.5 9.50008M16 18.0001L18 20.0001L22 16.0001";
    const strokeIcon = (paths: string, size = 15, viewBox = "0 0 24 24", strokeWidth = 2) =>
      `<svg width="${size}" height="${size}" viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<style>
  * { box-sizing: border-box; }
  ::-webkit-scrollbar { width: 8px; }
  ::-webkit-scrollbar-thumb { background: #1f9f45; border-radius: 99px; }
  ::-webkit-scrollbar-thumb:hover { background: #35c75a; }
  body {
    font-family: var(--vscode-font-family);
    color: #f4f4f4;
    background: transparent;
    padding: 16px 12px;
    -webkit-font-smoothing: antialiased;
  }
  .logo {
    width: 46px; height: 46px; border-radius: 13px;
    background: linear-gradient(135deg, #35c75a, #1f9f45);
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 12px; color: #0c1f12;
    box-shadow: 0 4px 16px rgba(53, 199, 90, 0.25);
  }
  h2 { margin: 0 0 2px; font-size: 15px; letter-spacing: -0.2px; }
  p { margin: 0 0 16px; color: #b8b8b8; font-size: 12px; }
  button.primary {
    display: flex; align-items: center; justify-content: center;
    gap: 9px; width: 100%;
    background: linear-gradient(180deg, #35c75a, #2bb84f); color: #0b1a0f;
    font-weight: 700; border: none; border-radius: 9px;
    padding: 9px 13px; margin-bottom: 18px;
    font-size: 12.5px; cursor: pointer; font-family: inherit;
    box-shadow: 0 2px 12px rgba(53, 199, 90, 0.25);
    transition: filter 0.15s ease;
  }
  button.primary:hover { filter: brightness(1.07); }
  .cards {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .card {
    background: #181818;
    border: 1px solid #262626;
    border-radius: 10px;
    padding: 12px 13px;
    cursor: pointer;
    transition: border-color 0.15s ease, transform 0.15s ease;
  }
  .card:hover { border-color: #1f9f45; transform: translateY(-1px); }
  .card .value {
    font-size: 24px; font-weight: 700; letter-spacing: -0.5px;
    color: #35c75a; line-height: 1.1;
  }
  .card .value.neutral { color: #f4f4f4; }
  .card .value.bad { color: #e5534b; }
  .card .label {
    font-size: 10px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.7px; color: #7a7a7a; margin-top: 3px;
  }
</style>
</head>
<body>
  <div class="logo">${strokeIcon(`<path d="${logoPath}"/>`, 26)}</div>
  <h2>NuGet LL</h2>
  <p>Visual NuGet package management.</p>
  <button class="primary" onclick="open_('overview')">Open Dashboard</button>
  <div class="cards">
    <div class="card" onclick="open_('overview')">
      <div class="value neutral" id="val-projects">${projects}</div>
      <div class="label">Projects</div>
    </div>
    <div class="card" onclick="open_('installed')">
      <div class="value" id="val-packages">${packages}</div>
      <div class="label">Packages</div>
    </div>
    <div class="card" onclick="open_('updates')">
      <div class="value${typeof outdated === "number" && outdated > 0 ? " bad" : ""}" id="val-outdated">${outdated}</div>
      <div class="label">Outdated</div>
    </div>
    <div class="card" onclick="open_('vulnerabilities')">
      <div class="value${typeof vulnerable === "number" && vulnerable > 0 ? " bad" : ""}" id="val-vulnerable">${vulnerable}</div>
      <div class="label">Vulnerable</div>
    </div>
    <div class="card" onclick="open_('sources')">
      <div class="value neutral" id="val-sources">${sources}</div>
      <div class="label">Sources</div>
    </div>
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    function open_(tab) { vscode.postMessage({ command: "open", tab }); }
    window.addEventListener("message", (e) => {
      const m = e.data;
      if (m.type !== "stats") return;
      set("val-projects", m.projects, false);
      set("val-packages", m.packages, false);
      set("val-outdated", m.outdated, true);
      set("val-vulnerable", m.vulnerable, true);
      set("val-sources", m.sources, false);
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
