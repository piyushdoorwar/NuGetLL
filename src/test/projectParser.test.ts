import { describe, expect, it } from "vitest";
import {
  addPackageReferenceWithoutVersion,
  hasPackageVersion,
  removePackageReference,
  removePackageVersion,
  setPackageVersion
} from "../services/centralPackageService";
import {
  parseCentralPackagesProps,
  parseNugetConfig,
  parsePackagesConfig,
  parseProjectFile
} from "../services/projectParser";

const SDK_PROJECT = `<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.EntityFrameworkCore" Version="8.0.7" />
    <PackageReference Include="Serilog.AspNetCore">
      <Version>8.0.1</Version>
    </PackageReference>
  </ItemGroup>
</Project>`;

describe("parseProjectFile", () => {
  it("parses an SDK-style project with PackageReference entries", () => {
    const parsed = parseProjectFile(SDK_PROJECT);
    expect(parsed).not.toBeNull();
    expect(parsed!.sdkStyle).toBe(true);
    expect(parsed!.targetFrameworks).toEqual(["net8.0"]);
    expect(parsed!.packages).toEqual([
      { id: "Microsoft.EntityFrameworkCore", version: "8.0.7" },
      { id: "Serilog.AspNetCore", version: "8.0.1" }
    ]);
  });

  it("parses multi-targeted projects", () => {
    const parsed = parseProjectFile(`<Project Sdk="Microsoft.NET.Sdk">
      <PropertyGroup><TargetFrameworks>net8.0;netstandard2.0</TargetFrameworks></PropertyGroup>
    </Project>`);
    expect(parsed!.targetFrameworks).toEqual(["net8.0", "netstandard2.0"]);
  });

  it("detects non-SDK projects", () => {
    const parsed = parseProjectFile(`<Project ToolsVersion="15.0"><PropertyGroup /></Project>`);
    expect(parsed!.sdkStyle).toBe(false);
  });

  it("parses version-less PackageReference (CPM style)", () => {
    const parsed = parseProjectFile(`<Project Sdk="Microsoft.NET.Sdk">
      <ItemGroup><PackageReference Include="Newtonsoft.Json" /></ItemGroup>
    </Project>`);
    expect(parsed!.packages).toEqual([{ id: "Newtonsoft.Json" }]);
  });

  it("reads ManagePackageVersionsCentrally from the project", () => {
    const parsed = parseProjectFile(`<Project Sdk="Microsoft.NET.Sdk">
      <PropertyGroup><ManagePackageVersionsCentrally>false</ManagePackageVersionsCentrally></PropertyGroup>
    </Project>`);
    expect(parsed!.managePackageVersionsCentrally).toBe(false);
  });

  it("returns null for invalid XML", () => {
    expect(parseProjectFile("<Project><Unclosed>")).toBeNull();
    expect(parseProjectFile("not xml at all")).toBeNull();
    expect(parseProjectFile("")).toBeNull();
  });
});

describe("parseCentralPackagesProps", () => {
  const PROPS = `<Project>
  <PropertyGroup>
    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
  </PropertyGroup>
  <ItemGroup>
    <PackageVersion Include="Serilog" Version="4.0.0" />
    <PackageVersion Include="xunit" Version="2.8.1" />
  </ItemGroup>
</Project>`;

  it("parses enabled flag and package versions", () => {
    const parsed = parseCentralPackagesProps(PROPS);
    expect(parsed!.managementEnabled).toBe(true);
    expect(parsed!.packageVersions).toEqual({ Serilog: "4.0.0", xunit: "2.8.1" });
  });

  it("treats PackageVersion entries without the flag as enabled", () => {
    const parsed = parseCentralPackagesProps(`<Project><ItemGroup>
      <PackageVersion Include="A" Version="1.0.0" />
    </ItemGroup></Project>`);
    expect(parsed!.managementEnabled).toBe(true);
  });

  it("returns null for invalid XML", () => {
    expect(parseCentralPackagesProps("<Project>")).toBeNull();
  });
});

describe("parseNugetConfig", () => {
  const CONFIG = `<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <add key="nuget.org" value="https://api.nuget.org/v3/index.json" />
    <add key="local" value="../packages" />
  </packageSources>
  <disabledPackageSources>
    <add key="local" value="true" />
  </disabledPackageSources>
</configuration>`;

  it("parses sources with enabled/disabled state", () => {
    const sources = parseNugetConfig(CONFIG, "/x/NuGet.Config");
    expect(sources).toEqual([
      { name: "nuget.org", url: "https://api.nuget.org/v3/index.json", enabled: true, configPath: "/x/NuGet.Config" },
      { name: "local", url: "../packages", enabled: false, configPath: "/x/NuGet.Config" }
    ]);
  });

  it("returns null for invalid XML", () => {
    expect(parseNugetConfig("<configuration", "/x")).toBeNull();
  });
});

describe("parsePackagesConfig", () => {
  it("parses legacy packages.config", () => {
    const parsed = parsePackagesConfig(`<?xml version="1.0"?>
<packages>
  <package id="Newtonsoft.Json" version="13.0.3" targetFramework="net48" />
</packages>`);
    expect(parsed).toEqual([{ id: "Newtonsoft.Json", version: "13.0.3" }]);
  });
});

describe("central package management edits", () => {
  const PROPS = `<Project>
  <PropertyGroup>
    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
  </PropertyGroup>
  <ItemGroup>
    <PackageVersion Include="Serilog" Version="4.0.0" />
  </ItemGroup>
</Project>`;

  it("updates an existing PackageVersion in place", () => {
    const updated = setPackageVersion(PROPS, "Serilog", "4.1.0");
    expect(updated).toContain(`<PackageVersion Include="Serilog" Version="4.1.0" />`);
    expect(updated).not.toContain("4.0.0");
  });

  it("inserts a new PackageVersion next to existing entries", () => {
    const updated = setPackageVersion(PROPS, "xunit", "2.8.1");
    expect(updated).toContain(`<PackageVersion Include="xunit" Version="2.8.1" />`);
    expect(parseCentralPackagesProps(updated)!.packageVersions).toEqual({
      Serilog: "4.0.0",
      xunit: "2.8.1"
    });
  });

  it("creates an ItemGroup when none has PackageVersion entries", () => {
    const updated = setPackageVersion(`<Project>\n</Project>`, "A.B", "1.0.0");
    expect(parseCentralPackagesProps(updated)!.packageVersions).toEqual({ "A.B": "1.0.0" });
  });

  it("removes a PackageVersion entry", () => {
    const updated = removePackageVersion(PROPS, "Serilog");
    expect(updated).not.toContain("Serilog");
    expect(hasPackageVersion(updated, "Serilog")).toBe(false);
  });

  it("rejects suspicious package ids", () => {
    expect(() => setPackageVersion(PROPS, `A" /><Evil`, "1.0.0")).toThrow();
    expect(() => setPackageVersion(PROPS, "Ok.Package", `1.0"><Evil`)).toThrow();
  });

  it("adds and removes version-less PackageReference entries", () => {
    const project = `<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <PackageReference Include="Serilog" />
  </ItemGroup>
</Project>`;
    const added = addPackageReferenceWithoutVersion(project, "xunit");
    expect(added).toContain(`<PackageReference Include="xunit" />`);
    // adding again is a no-op
    expect(addPackageReferenceWithoutVersion(added, "xunit")).toBe(added);
    const removed = removePackageReference(added, "xunit");
    expect(removed).not.toContain("xunit");
    expect(removed).toContain(`<PackageReference Include="Serilog" />`);
  });
});
