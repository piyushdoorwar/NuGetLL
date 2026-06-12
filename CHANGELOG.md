# Changelog

All notable changes to the NeuGetLL extension are documented in this file.

## [0.1.0] - 2026-06-11

### Added

- Initial release.
- Workspace scanner for `.sln`, `.slnf`, `.csproj`, `.fsproj`, `.vbproj`, `Directory.Packages.props`, `Directory.Build.props`, `NuGet.Config`, and `packages.config`.
- Activity bar sidebar with Projects, Installed Packages, Outdated Packages, Vulnerable Packages, and Package Sources views.
- Dark, green-accented webview dashboard with Overview, Browse, Installed, Updates, Vulnerabilities, Sources, and Settings tabs.
- Package search via the NuGet v3 API with dotnet CLI fallback.
- Install, update, and remove packages in one or multiple projects.
- Outdated, vulnerable, and deprecated package reports via `dotnet list package`.
- Central Package Management (Directory.Packages.props) support with confirmation before edits.
- Package sources manager backed by `dotnet nuget` commands.
- Restore commands for workspace, solution, and project.
- File watchers with debounced refresh.
- Secret masking in logs and shell-injection-safe command execution.
