import { ExtensionToWebviewMessage, WebviewToExtensionMessage } from "../types";

interface VsCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

const vscode = acquireVsCodeApi();

export function post(message: WebviewToExtensionMessage): void {
  vscode.postMessage(message);
}

export function onMessage(handler: (message: ExtensionToWebviewMessage) => void): () => void {
  const listener = (event: MessageEvent) => handler(event.data as ExtensionToWebviewMessage);
  window.addEventListener("message", listener);
  return () => window.removeEventListener("message", listener);
}

export function getPersistedState<T>(): T | undefined {
  return vscode.getState() as T | undefined;
}

export function persistState(state: unknown): void {
  vscode.setState(state);
}
