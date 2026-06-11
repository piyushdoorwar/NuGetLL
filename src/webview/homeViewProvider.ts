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
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<style>
  body {
    font-family: var(--vscode-font-family);
    color: #f4f4f4;
    background: transparent;
    padding: 14px 12px;
  }
  .logo {
    width: 42px; height: 42px; border-radius: 10px;
    background: linear-gradient(135deg, #35c75a, #1f9f45);
    display: flex; align-items: center; justify-content: center;
    font-weight: 800; font-size: 18px; color: #0c0c0c; margin-bottom: 10px;
  }
  h2 { margin: 0 0 2px; font-size: 15px; }
  p { margin: 0 0 14px; color: #b8b8b8; font-size: 12px; }
  button {
    display: block; width: 100%; text-align: left;
    background: #181818; border: 1px solid #2a2a2a; color: #f4f4f4;
    border-radius: 7px; padding: 8px 12px; margin-bottom: 7px;
    font-size: 12.5px; cursor: pointer; font-family: inherit;
  }
  button:hover { border-color: #1f9f45; }
  button.primary { background: #35c75a; color: #0b1a0f; font-weight: 700; border: none; }
  button.primary:hover { filter: brightness(1.08); }
  .hint { color: #7a7a7a; font-size: 11px; margin-top: 10px; }
</style>
</head>
<body>
  <div class="logo">G</div>
  <h2>GetLL</h2>
  <p>${projects} .NET project${projects === 1 ? "" : "s"} in this workspace.</p>
  <button class="primary" onclick="open_('overview')">Open Dashboard</button>
  <button onclick="open_('browse')">⌕ Browse packages</button>
  <button onclick="open_('installed')">▣ Installed</button>
  <button onclick="open_('updates')">↑ Updates</button>
  <button onclick="open_('vulnerabilities')">⛨ Vulnerabilities</button>
  <button onclick="open_('sources')">⊕ Sources</button>
  <div class="hint">Everything is managed in the GetLL dashboard.</div>
  <script>
    const vscode = acquireVsCodeApi();
    function open_(tab) { vscode.postMessage({ command: "open", tab }); }
  </script>
</body>
</html>`;
  }
}
