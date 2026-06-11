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
    const strokeIcon = (paths: string, size = 15, viewBox = "0 0 24 24", strokeWidth = 2) =>
      `<svg width="${size}" height="${size}" viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
    const fillIcon = (paths: string, viewBox: string, size = 15) =>
      `<svg width="${size}" height="${size}" viewBox="${viewBox}" fill="currentColor" aria-hidden="true">${paths}</svg>`;
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
  <div class="logo">${strokeIcon(`<path d="${logoPath}"/>`, 26)}</div>
  <h2>GetLL</h2>
  <p>${projects} .NET project${projects === 1 ? "" : "s"} in this workspace.</p>
  <button class="primary" onclick="open_('overview')">Open Dashboard</button>
  <button onclick="open_('browse')">${strokeIcon(
    `<path d="M15.7955 15.8111L21 21M18 10.5C18 14.6421 14.6421 18 10.5 18C6.35786 18 3 14.6421 3 10.5C3 6.35786 6.35786 3 10.5 3C14.6421 3 18 6.35786 18 10.5Z"/>`
  )} Browse packages</button>
  <button onclick="open_('installed')">${fillIcon(
    `<path d="M10.3,18.87l7,6.89a1,1,0,0,0,1.4,0l7-6.89a1,1,0,0,0-1.4-1.43L19,22.65V4a1,1,0,0,0-2,0V22.65l-5.3-5.21a1,1,0,0,0-1.4,1.43Z"/><circle cx="30" cy="6" r="5"/>`,
    "0 0 36 36"
  )} Installed</button>
  <button onclick="open_('updates')">${fillIcon(
    `<path d="M5.857 3.882v3.341a1.03 1.03 0 0 1-2.058 0v-.97a5.401 5.401 0 0 0-1.032 2.27 1.03 1.03 0 1 1-2.02-.395A7.462 7.462 0 0 1 2.235 4.91h-.748a1.03 1.03 0 1 1 0-2.058h3.34a1.03 1.03 0 0 1 1.03 1.03zm-3.25 9.237a1.028 1.028 0 0 1-1.358-.523 7.497 7.497 0 0 1-.37-1.036 1.03 1.03 0 1 1 1.983-.55 5.474 5.474 0 0 0 .269.751 1.029 1.029 0 0 1-.524 1.358zm2.905 2.439a1.028 1.028 0 0 1-1.42.322 7.522 7.522 0 0 1-.885-.652 1.03 1.03 0 0 1 1.34-1.563 5.435 5.435 0 0 0 .643.473 1.03 1.03 0 0 1 .322 1.42zm3.68.438a1.03 1.03 0 0 1-1.014 1.044h-.106a7.488 7.488 0 0 1-.811-.044 1.03 1.03 0 0 1 .224-2.046 5.41 5.41 0 0 0 .664.031h.014a1.03 1.03 0 0 1 1.03 1.015zm.034-12.847a1.03 1.03 0 0 1-1.029 1.01h-.033a1.03 1.03 0 0 1 .017-2.06h.017l.019.001a1.03 1.03 0 0 1 1.009 1.05zm3.236 11.25a1.029 1.029 0 0 1-.3 1.425 7.477 7.477 0 0 1-.797.453 1.03 1.03 0 1 1-.905-1.849 5.479 5.479 0 0 0 .578-.328 1.03 1.03 0 0 1 1.424.3zM10.475 3.504a1.029 1.029 0 0 1 1.41-.359l.018.011a1.03 1.03 0 1 1-1.06 1.764l-.01-.006a1.029 1.029 0 0 1-.358-1.41zm4.26 9.445a7.5 7.5 0 0 1-.315.56 1.03 1.03 0 1 1-1.749-1.086 5.01 5.01 0 0 0 .228-.405 1.03 1.03 0 1 1 1.836.93zm-1.959-6.052a1.03 1.03 0 0 1 1.79-1.016l.008.013a1.03 1.03 0 1 1-1.79 1.017zm2.764 2.487a9.327 9.327 0 0 1 0 .366 1.03 1.03 0 0 1-1.029 1.005h-.025A1.03 1.03 0 0 1 13.482 9.7a4.625 4.625 0 0 0 0-.266 1.03 1.03 0 0 1 1.003-1.055h.026a1.03 1.03 0 0 1 1.029 1.004z"/>`,
    "-1.5 0 19 19"
  )} Updates</button>
  <button onclick="open_('vulnerabilities')">${fillIcon(
    `<path d="M256.001,0L29.89,130.537c0,47.476,4.506,88.936,12.057,125.463C88.61,481.721,256.001,512,256.001,512 s167.389-30.279,214.053-256c7.551-36.527,12.057-77.986,12.057-125.463L256.001,0z M256.118,466.723 c-0.035-0.012-0.082-0.028-0.117-0.039v-47.672V256H140.77H91.122c-6.67-29.738-11.109-63.506-12.394-101.93L255.999,51.728h0.002 v51.73V256h115.27h49.625C385.636,413.404,287.327,456.774,256.118,466.723z"/>`,
    "0 0 512 512",
    14
  )} Vulnerabilities</button>
  <button onclick="open_('sources')">${fillIcon(
    `<path fill-rule="evenodd" clip-rule="evenodd" d="M14.962 13.41c-.927.06-1.915.09-2.962.09-1.047 0-2.035-.03-2.962-.09.267 4.954 1.884 8.74 2.962 8.74 1.078 0 2.694-3.785 2.962-8.74zm-7.936-.188c.152 3.571.961 6.533 2.06 8.442C4.983 20.404 2 16.554 2 12v-.09c1.329.621 3.003 1.056 5.026 1.312zm-4.784-3.44c1.127.662 2.719 1.14 4.769 1.42.103-3.76.933-6.882 2.074-8.866C5.67 3.386 3.03 6.23 2.242 9.782zm6.765 1.622C9.129 6.057 10.864 1.85 12 1.85s2.871 4.207 2.993 9.554c-.925.064-1.923.096-2.993.096a43.67 43.67 0 0 1-2.993-.096zm7.967 1.818c2.023-.256 3.697-.69 5.026-1.311V12c0 4.554-2.984 8.404-7.085 9.664 1.098-1.91 1.907-4.871 2.06-8.442zm4.784-3.44c-1.127.662-2.719 1.14-4.769 1.42-.103-3.76-.933-6.882-2.074-8.866 3.415 1.05 6.055 3.894 6.843 7.446z"/>`,
    "0 0 24 24"
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
