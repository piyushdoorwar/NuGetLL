import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { scanWorkspaceFolders, WorkspaceScanner } from "../services/workspaceScanner";

const EXCLUDED = ["bin", "obj", ".git", "node_modules", ".vs", ".vscode-test"];

let root: string;

async function write(relative: string, content: string): Promise<void> {
  const full = path.join(root, relative);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, content, "utf8");
}

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "getll-test-"));
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe("scanWorkspaceFolders", () => {
  it("finds projects, solutions and packages across folders", async () => {
    await write("MyApp.sln", "");
    await write(
      "src/MyApp.Api/MyApp.Api.csproj",
      `<Project Sdk="Microsoft.NET.Sdk.Web">
        <PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup>
        <ItemGroup>
          <PackageReference Include="Serilog.AspNetCore" Version="8.0.1" />
        </ItemGroup>
      </Project>`
    );
    await write(
      "src/MyApp.Tests/MyApp.Tests.fsproj",
      `<Project Sdk="Microsoft.NET.Sdk">
        <PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup>
      </Project>`
    );

    const { model, issues } = await scanWorkspaceFolders([root], EXCLUDED);
    expect(issues).toEqual([]);
    expect(model.solutions).toHaveLength(1);
    expect(model.projects.map((p) => p.name).sort()).toEqual(["MyApp.Api", "MyApp.Tests"]);
    const api = model.projects.find((p) => p.name === "MyApp.Api")!;
    expect(api.kind).toBe("csproj");
    expect(api.sdkStyle).toBe(true);
    expect(api.targetFrameworks).toEqual(["net8.0"]);
    expect(api.packages).toEqual([{ id: "Serilog.AspNetCore", version: "8.0.1" }]);
  });

  it("skips excluded folders like bin and obj", async () => {
    await write("bin/Decoy/Decoy.csproj", `<Project Sdk="Microsoft.NET.Sdk" />`);
    await write("node_modules/x/X.csproj", `<Project Sdk="Microsoft.NET.Sdk" />`);
    await write("src/Real/Real.csproj", `<Project Sdk="Microsoft.NET.Sdk" />`);

    const { model } = await scanWorkspaceFolders([root], EXCLUDED);
    expect(model.projects.map((p) => p.name)).toEqual(["Real"]);
  });

  it("detects central package management and resolves versions", async () => {
    await write(
      "Directory.Packages.props",
      `<Project>
        <PropertyGroup><ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally></PropertyGroup>
        <ItemGroup><PackageVersion Include="Serilog" Version="4.0.0" /></ItemGroup>
      </Project>`
    );
    await write(
      "src/App/App.csproj",
      `<Project Sdk="Microsoft.NET.Sdk">
        <PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup>
        <ItemGroup><PackageReference Include="Serilog" /></ItemGroup>
      </Project>`
    );

    const { model } = await scanWorkspaceFolders([root], EXCLUDED);
    expect(model.centralPackageFiles).toHaveLength(1);
    const project = model.projects[0];
    expect(project.usesCentralManagement).toBe(true);
    expect(project.centralPackagesPath).toBe(path.join(root, "Directory.Packages.props"));
    expect(project.packages[0].resolvedVersion).toBe("4.0.0");
  });

  it("reads packages.config projects as read-only", async () => {
    await write(
      "legacy/Legacy.csproj",
      `<Project ToolsVersion="15.0"><PropertyGroup /></Project>`
    );
    await write(
      "legacy/packages.config",
      `<?xml version="1.0"?><packages><package id="Newtonsoft.Json" version="13.0.3" /></packages>`
    );

    const { model } = await scanWorkspaceFolders([root], EXCLUDED);
    const project = model.projects[0];
    expect(project.usesPackagesConfig).toBe(true);
    expect(project.packages).toEqual([{ id: "Newtonsoft.Json", version: "13.0.3" }]);
  });

  it("parses NuGet.Config sources", async () => {
    await write(
      "NuGet.Config",
      `<configuration><packageSources>
        <add key="nuget.org" value="https://api.nuget.org/v3/index.json" />
      </packageSources></configuration>`
    );

    const { model } = await scanWorkspaceFolders([root], EXCLUDED);
    expect(model.nugetConfigPaths).toHaveLength(1);
    expect(model.sources).toEqual([
      {
        name: "nuget.org",
        url: "https://api.nuget.org/v3/index.json",
        enabled: true,
        configPath: path.join(root, "NuGet.Config")
      }
    ]);
  });

  it("reports invalid XML as issues instead of crashing", async () => {
    await write("bad/Bad.csproj", "<Project><Unclosed>");
    await write("good/Good.csproj", `<Project Sdk="Microsoft.NET.Sdk" />`);

    const { model, issues } = await scanWorkspaceFolders([root], EXCLUDED);
    expect(model.projects.map((p) => p.name)).toEqual(["Good"]);
    expect(issues).toHaveLength(1);
    expect(issues[0].file).toContain("Bad.csproj");
  });
});

describe("WorkspaceScanner", () => {
  it("notifies listeners and caches the model", async () => {
    await write("App/App.csproj", `<Project Sdk="Microsoft.NET.Sdk" />`);
    const scanner = new WorkspaceScanner(
      () => [root],
      () => EXCLUDED
    );
    let notified = 0;
    scanner.onDidChangeModel(() => notified++);

    expect(scanner.getModel()).toBeUndefined();
    await scanner.scan();
    expect(notified).toBe(1);
    expect(scanner.getModel()?.projects).toHaveLength(1);
  });
});
