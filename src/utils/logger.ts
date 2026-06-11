import * as vscode from "vscode";
import { maskSecrets } from "./security";

let channel: vscode.OutputChannel | undefined;

export function getOutputChannel(): vscode.OutputChannel {
  if (!channel) {
    channel = vscode.window.createOutputChannel("GetLL");
  }
  return channel;
}

function write(level: string, message: string): void {
  const time = new Date().toISOString();
  getOutputChannel().appendLine(`[${time}] [${level}] ${maskSecrets(message)}`);
}

export const logger = {
  info(message: string): void {
    write("info", message);
  },
  warn(message: string): void {
    write("warn", message);
  },
  error(message: string, err?: unknown): void {
    const detail = err instanceof Error ? `: ${err.message}` : err !== undefined ? `: ${String(err)}` : "";
    write("error", `${message}${detail}`);
  },
  /** Raw command output, still masked. */
  output(text: string): void {
    if (text.trim().length > 0) {
      getOutputChannel().append(maskSecrets(text.endsWith("\n") ? text : `${text}\n`));
    }
  },
  show(): void {
    getOutputChannel().show(true);
  },
  dispose(): void {
    channel?.dispose();
    channel = undefined;
  }
};
