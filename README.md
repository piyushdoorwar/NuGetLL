# NeuGetLL: NuGet Package Manager

Visual NuGet package management for VS Code workspaces.

NeuGetLL brings a Visual Studio-style NuGet experience to VS Code: scan your workspace, browse and search packages, install into one or many projects, keep dependencies updated, and stay on top of vulnerable or deprecated packages — all from a fast, dark, green-accented dashboard and a dedicated sidebar.

> **Screenshots coming soon.**

## Features

- **Workspace scanner** — detects `.sln`, `.slnf`, `.csproj`, `.fsproj`, `.vbproj`, `Directory.Packages.props`, `Directory.Build.props`, `NuGet.Config`, and `packages.config` across all workspace folders, skipping `bin`, `obj`, `.git`, `node_modules`, and friends.
- **Sidebar views** — Projects (with installed packages per project), Installed Packages, Outdated Packages, Vulnerable Packages, and Package Sources, with rich context menus.
- **Dashboard** — a polished webview with Overview, Browse, Installed, Updates, Vulnerabilities, Sources, and Settings tabs.
- **Search** — NuGet v3 API search against nuget.org (or your configured feed), with a `dotnet package search` fallback; filter by prerelease and exact package id.
- **Package details** — versions, downloads, license, authors/owners, tags, dependencies by target framework, deprecation and vulnerability info, and the projects in your workspace that use the package.
- **Install / update / remove** — into one or multiple projects at once, with version pickers (latest stable, latest prerelease, or a specific version) and confirmation before multi-project changes.
- **Central Package Management** — projects governed by `Directory.Packages.props` are detected; NeuGetLL edits `PackageVersion` entries and version-less `PackageReference`s, and always asks before touching shared props files.
- **Outdated / vulnerable / deprecated reports** — powered by `dotnet list package --outdated/--vulnerable/--deprecated`, with patch/minor/major classification, batch updates, advisory links, and a copyable report.
- **Package sources manager** — list, add, remove, enable, disable, and edit sources via `dotnet nuget`, with quick access to the defining `NuGet.Config`.
- **Restore** — restore the workspace, a solution, or a single project with progress and full output logging.
- **Live refresh** — file watchers refresh the model (debounced 500 ms) whenever project or NuGet config files change.

## How to use

1. Open a workspace that contains .NET projects.
2. Click the **NeuGetLL** icon in the activity bar to see your projects and packages.
3. Run **NeuGetLL: Open Dashboard** (or click the dashboard icon in the Projects view) for the full UI.
4. In **Browse**, search for a package, pick a version and target projects, and click **Install**.
5. Use **Updates** and **Vulnerabilities** to keep your dependency graph healthy.

## Commands

| Command | Description |
| --- | --- |
| `NeuGetLL: Open Dashboard` | Open the NeuGetLL dashboard webview |
| `NeuGetLL: Refresh Workspace` | Rescan projects and packages |
| `NeuGetLL: Search Packages` | Search NuGet packages |
| `NeuGetLL: Add Package` | Install a package into one or more projects |
| `NeuGetLL: Update Package` / `Update All Packages` | Update package references |
| `NeuGetLL: Remove Package` | Remove a package from projects |
| `NeuGetLL: Check Outdated / Vulnerable / Deprecated Packages` | Run dependency health checks |
| `NeuGetLL: Restore Workspace / Solution / Project` | Run `dotnet restore` |
| `NeuGetLL: Manage Package Sources` / `Add / Remove / Enable / Disable Package Source` | Manage NuGet feeds |
| `NeuGetLL: Open Output Channel` | Show detailed logs |
| `NeuGetLL: Open Settings` | Open NeuGetLL settings |

## Requirements

- VS Code 1.96+
- [.NET SDK](https://dotnet.microsoft.com/download) on your `PATH` (`dotnet --version` should work). NeuGetLL detects the SDK on activation and disables package actions with a clear message if it is missing.
- For the JSON-based reports (`--format json`), .NET SDK 7.0.200 or newer is recommended.

## Known limitations

- `packages.config` projects are **read-only** in this first version — packages are listed but cannot be modified.
- Some private feeds require an existing [NuGet credential provider](https://learn.microsoft.com/nuget/reference/extensibility/nuget-cross-platform-authentication-plugin) setup; NeuGetLL does not store feed credentials.
- Central Package Management is supported, but NeuGetLL always asks before modifying shared `Directory.Packages.props` files.
- Visual Studio-specific project system features (e.g. license acceptance flows, packages folder management) are not fully replicated.

## Privacy & security

- NeuGetLL talks only to the NuGet feeds you configure (nuget.org by default) and runs the `dotnet` CLI locally.
- Commands are executed via `spawn` with argument arrays — never through a shell.
- Passwords, tokens, API keys, and URL-embedded credentials are masked in the NeuGetLL output channel and the UI.
- NeuGetLL never stores feed credentials; use NuGet credential providers for authenticated feeds.
- File edits are restricted to files inside your workspace, and shared config files are only modified after confirmation.

## Roadmap

- Writable `packages.config` support
- Per-solution dashboards and dependency graphs
- Version pinning / floating version helpers
- License and SBOM reports
- Search across multiple feeds simultaneously

## Development

```bash
npm install
npm run compile
code .
# Press F5 to launch the Extension Development Host
```

Other scripts: `npm run watch`, `npm run lint`, `npm run test`, `npm run package`, `npm run webview:dev`, `npm run webview:build`.

## License

[MIT](LICENSE)
