# NuGet LL — guide for Claude Code

VS Code extension that brings a Visual Studio-style NuGet experience to VS Code:
workspace scanning, package browse/search/install/update/remove, dependency health
reports, and source management — surfaced through a sidebar and a React dashboard
webview. The `dotnet` CLI does the package work; the extension orchestrates it.

## Architecture

Two separately-built halves:

1. **Extension host** (Node, TypeScript) — `src/`, bundled by esbuild to
   `dist/extension.js` (CJS, platform `node`, `vscode` external).
2. **Dashboard webview** (React + Vite) — `webview-ui/`, built to `dist/webview/`
   with **fixed, unhashed filenames** (`index.js`, `index.css`) so the extension can
   reference them via stable URIs. Don't introduce content hashing — see
   `webview-ui/vite.config.ts`.

The two communicate over a typed message protocol in
`src/webview/messageProtocol.ts` (mirrored by `webview-ui/src/types.ts` and
`webview-ui/src/api/vscodeApi.ts`). Keep both sides of the protocol in sync.

### Source layout (`src/`)
- `extension.ts` — activation, command + view registration, file watchers.
- `services/` — the real work. `commandRunner.ts` (spawn wrapper), `nugetCliService.ts`
  / `nugetApiService.ts` (dotnet CLI + NuGet v3 API), `workspaceScanner.ts`,
  `projectParser.ts`, `packageOperations.ts`, `centralPackageService.ts`,
  `vulnerabilityService.ts`, `packageSourceService.ts`, `credentialStorageService.ts`,
  `container.ts` (DI/wiring).
- `models/` — `workspaceModel`, `projectModel`, `packageModel`, `sourceModel`.
- `commands/` — one file per command group; `pickers.ts` for shared quick-pick UI.
- `webview/` — `dashboardPanel.ts` (panel lifecycle + message handling),
  `webviewHtml.ts` (React dashboard HTML shell + CSP/nonce), `homeViewProvider.ts`
  (sidebar launcher; also builds its own CSP/nonce HTML), `messageProtocol.ts`.
- `utils/` — `security.ts` (credential masking), `xmlUtils.ts`, `logger.ts`,
  `debounce.ts`, `pathUtils.ts`.

### Dependency-health checks stream per project

The Updates / Vulnerabilities / Deprecated checks run `dotnet list … package` **one
project at a time** (`dashboardPanel.listTargets()` prefers individual projects over
the solution so there are chunks to stream). `vulnerabilityService` takes an
`onPartial` callback and the panel posts incremental `*Results` messages carrying
`done` + `progress {completed,total}`; the webview renders rows as they arrive and
shows a "Reviewing N/M projects" banner (`CheckProgress`). When adding a similar
long-running check, follow this shape rather than awaiting all targets.

The Updates tab prunes a row optimistically when its update succeeds (the host posts
`packageUpdated`; the webview drops the row — no full re-check). Because a streaming
check keeps re-sending its full pre-update result set (including the final message),
`App.tsx` tracks already-updated rows in `resolvedKeysRef` and filters incoming
results against it so an updated row can't reappear; the set resets on each new check.

## Commands / scripts

| Task | Command |
| --- | --- |
| Build everything | `npm run compile` (esbuild + webview build) |
| Watch extension host | `npm run watch` |
| Build webview only | `npm run webview:build` |
| Webview dev server | `npm run webview:dev` |
| Typecheck (lint) | `npm run lint` (`tsc --noEmit`, no emit) |
| Tests | `npm run test` (Vitest, `src/test/*.test.ts`) |
| Production VSIX prep | `npm run package` |

`postinstall` runs `npm install` inside `webview-ui/`, so a top-level `npm install`
sets up both halves.

## Conventions & guardrails

- **Never run `dotnet` (or anything) through a shell.** Use `commandRunner` /
  `spawn` with an argument array. This is a security boundary, not a style choice.
- **Mask secrets.** Route any feed URL / token / output that could contain
  credentials through `utils/security.ts` before logging or surfacing it. NuGet LL
  does not persist feed credentials — rely on NuGet credential providers.
- **Confirm before touching shared files.** Edits to `Directory.Packages.props` and
  other shared props/config must prompt the user. File writes stay inside the
  workspace.
- **`packages.config` is read-only** in the current version — list, don't mutate.
- **Keep the message protocol typed and symmetric** across host and webview when
  adding dashboard features.
- **No inline event handlers in webview HTML.** Inline `onclick="…"` attributes are
  blocked by the webview CSP and silently do nothing. Every hand-written webview
  (`webviewHtml.ts`, `homeViewProvider.ts`) must set a CSP with a per-render nonce,
  give its `<script>` that nonce, and wire clicks via a delegated `addEventListener`
  on `data-*` attributes — never inline `onclick`.
- **Webview output filenames are fixed** — don't add hashing or change the
  `dist/webview` layout without updating `webviewHtml.ts`.
- Run `npm run lint` and `npm run test` before considering a change done.

## Branding

The product name is **NuGet LL** (NuGet + **L**ibrary **L**ens). Command category and
activity-bar title are both `NuGet LL`. The logo (`media/getll.svg`, exported to
`media/getll.png` at 256×256) is an isometric package cube inside a magnifying-glass
lens, in VS Code blue. Regenerate the PNG from the SVG if the logo changes.
