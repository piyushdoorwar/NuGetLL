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

  constructor(private readonly services: GetllServices) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    view.webview.options = { enableScripts: true };
    view.webview.html = this.html();

    view.webview.onDidReceiveMessage((message: { command: string; tab?: string }) => {
      if (message.command === "open") {
        DashboardPanel.createOrShow(this.services, { tab: message.tab });
      }
    });

    // Clicking the activity bar icon is the "open GetLL" gesture: surface the
    // dashboard immediately the first time the view becomes visible.
    if (!this.autoOpened) {
      this.autoOpened = true;
      DashboardPanel.createOrShow(this.services);
    }
  }

  private html(): string {
    const model = this.services.scanner.getModel();
    const projects = model?.projects.length ?? 0;
    const logoPath =
      "M20.5 7.27783L12 12.0001M12 12.0001L3.49997 7.27783M12 12.0001L12 21.5001M14 20.889L12.777 21.5684C12.4934 21.726 12.3516 21.8047 12.2015 21.8356C12.0685 21.863 11.9315 21.863 11.7986 21.8356C11.6484 21.8047 11.5066 21.726 11.223 21.5684L3.82297 17.4573C3.52346 17.2909 3.37368 17.2077 3.26463 17.0893C3.16816 16.9847 3.09515 16.8606 3.05048 16.7254C3 16.5726 3 16.4013 3 16.0586V7.94153C3 7.59889 3 7.42757 3.05048 7.27477C3.09515 7.13959 3.16816 7.01551 3.26463 6.91082C3.37368 6.79248 3.52345 6.70928 3.82297 6.54288L11.223 2.43177C11.5066 2.27421 11.6484 2.19543 11.7986 2.16454C11.9315 2.13721 12.0685 2.13721 12.2015 2.16454C12.3516 2.19543 12.4934 2.27421 12.777 2.43177L20.177 6.54288C20.4766 6.70928 20.6263 6.79248 20.7354 6.91082C20.8318 7.01551 20.9049 7.13959 20.9495 7.27477C21 7.42757 21 7.59889 21 7.94153L21 12.5001M7.5 4.50008L16.5 9.50008M16 18.0001L18 20.0001L22 16.0001";
    const icon = (paths: string, size = 14) =>
      `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
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
  button {
    display: flex; align-items: center; gap: 9px; width: 100%; text-align: left;
    background: #181818; border: 1px solid #262626; color: #d8d8d8;
    border-radius: 9px; padding: 9px 13px; margin-bottom: 7px;
    font-size: 12.5px; cursor: pointer; font-family: inherit;
    transition: border-color 0.15s ease, color 0.15s ease, transform 0.15s ease;
  }
  button:hover { border-color: #1f9f45; color: #f4f4f4; transform: translateY(-1px); }
  button svg { color: #1f9f45; flex-shrink: 0; }
  button.primary {
    background: linear-gradient(180deg, #35c75a, #2bb84f); color: #0b1a0f;
    font-weight: 700; border: none; justify-content: center;
    box-shadow: 0 2px 12px rgba(53, 199, 90, 0.25);
  }
  button.primary:hover { filter: brightness(1.07); }
  button.primary svg { color: #0b1a0f; }
  .hint { color: #7a7a7a; font-size: 11px; margin-top: 12px; }
</style>
</head>
<body>
  <div class="logo">${icon(`<path d="${logoPath}" stroke-width="2"/>`, 26)}</div>
  <h2>GetLL</h2>
  <p>${projects} .NET project${projects === 1 ? "" : "s"} in this workspace.</p>
  <button class="primary" onclick="open_('overview')">Open Dashboard</button>
  <button onclick="open_('browse')">${icon(`<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>`)} Browse packages</button>
  <button onclick="open_('installed')">${icon(
    `<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" y1="22" x2="12" y2="12"/>`
  )} Installed</button>
  <button onclick="open_('updates')">${icon(
    `<circle cx="12" cy="12" r="10"/><polyline points="16 12 12 8 8 12"/><line x1="12" y1="16" x2="12" y2="8"/>`
  )} Updates</button>
  <button onclick="open_('vulnerabilities')">${icon(
    `<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1 1 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>`
  )} Vulnerabilities</button>
  <button onclick="open_('sources')">${icon(
    `<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>`
  )} Sources</button>
  <div class="hint">Everything is managed in the GetLL dashboard.</div>
  <script>
    const vscode = acquireVsCodeApi();
    function open_(tab) { vscode.postMessage({ command: "open", tab }); }
  </script>
</body>
</html>`;
  }
}
