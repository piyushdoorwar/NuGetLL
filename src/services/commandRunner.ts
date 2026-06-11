import { spawn } from "child_process";
import { maskArgs } from "../utils/security";

export interface CommandResult {
  /** Exit code; null when the process failed to start or was killed. */
  code: number | null;
  stdout: string;
  stderr: string;
  cancelled: boolean;
  /** Set when the process could not be spawned (e.g. command not found). */
  spawnError?: string;
}

export interface RunOptions {
  cwd?: string;
  /** Abort to cancel the running process. */
  signal?: AbortSignal;
  /** Called with masked log lines (the command line, then streamed output). */
  onLog?: (line: string) => void;
  timeoutMs?: number;
}

/**
 * Runs a command with `spawn` and an argument array — never through a shell —
 * so arguments cannot be used for shell injection.
 */
export function runCommand(command: string, args: string[], options: RunOptions = {}): Promise<CommandResult> {
  return new Promise((resolve) => {
    const log = options.onLog ?? (() => undefined);
    log(`> ${command} ${maskArgs(args).join(" ")}`);

    let settled = false;
    const finish = (result: CommandResult) => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };

    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(command, args, {
        cwd: options.cwd,
        shell: false,
        signal: options.signal,
        env: process.env
      });
    } catch (err) {
      finish({ code: null, stdout: "", stderr: String(err), cancelled: false, spawnError: String(err) });
      return;
    }

    let stdout = "";
    let stderr = "";
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (options.timeoutMs) {
      timer = setTimeout(() => child.kill(), options.timeoutMs);
    }

    child.stdout?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;
      log(text.trimEnd());
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;
      log(text.trimEnd());
    });

    child.on("error", (err: NodeJS.ErrnoException) => {
      if (timer) {
        clearTimeout(timer);
      }
      const cancelled = err.name === "AbortError";
      finish({
        code: null,
        stdout,
        stderr: stderr || err.message,
        cancelled,
        spawnError: cancelled ? undefined : err.message
      });
    });

    child.on("close", (code, signal) => {
      if (timer) {
        clearTimeout(timer);
      }
      finish({
        code,
        stdout,
        stderr,
        cancelled: options.signal?.aborted === true || signal === "SIGTERM"
      });
    });
  });
}
