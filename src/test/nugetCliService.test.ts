import { describe, expect, it } from "vitest";
import {
  buildAddPackageArgs,
  buildListPackageArgs,
  buildRemovePackageArgs,
  buildRestoreArgs,
  buildSearchArgs,
  parseDeprecatedJson,
  parseOutdatedJson,
  parseSdkVersion,
  parseSearchJson,
  parseSourceListOutput,
  parseVulnerableJson
} from "../services/nugetCliService";
import { MASK, maskArgs, maskSecrets } from "../utils/security";

describe("dotnet CLI argument builders", () => {
  it("builds add package args", () => {
    expect(buildAddPackageArgs("/w/App.csproj", "Serilog", { version: "4.0.0" })).toEqual([
      "add",
      "/w/App.csproj",
      "package",
      "Serilog",
      "--version",
      "4.0.0"
    ]);
  });

  it("uses --prerelease only when no version is given", () => {
    expect(buildAddPackageArgs("p.csproj", "X", { prerelease: true })).toContain("--prerelease");
    expect(buildAddPackageArgs("p.csproj", "X", { prerelease: true, version: "1.0.0" })).not.toContain("--prerelease");
  });

  it("appends source and no-restore flags", () => {
    const args = buildAddPackageArgs("p.csproj", "X", { source: "myfeed", noRestore: true });
    expect(args).toContain("--source");
    expect(args).toContain("myfeed");
    expect(args).toContain("--no-restore");
  });

  it("builds remove and restore args", () => {
    expect(buildRemovePackageArgs("p.csproj", "X")).toEqual(["remove", "p.csproj", "package", "X"]);
    expect(buildRestoreArgs()).toEqual(["restore"]);
    expect(buildRestoreArgs("a.sln")).toEqual(["restore", "a.sln"]);
  });

  it("builds list package args for each mode", () => {
    expect(buildListPackageArgs("a.sln", "outdated")).toEqual([
      "list",
      "a.sln",
      "package",
      "--format",
      "json",
      "--outdated"
    ]);
    expect(buildListPackageArgs("a.sln", "vulnerable", { includeTransitive: true })).toContain("--include-transitive");
    expect(buildListPackageArgs("a.sln", "deprecated")).toContain("--deprecated");
  });

  it("builds search args", () => {
    expect(buildSearchArgs("json", { take: 10, exactMatch: true })).toEqual([
      "package",
      "search",
      "json",
      "--format",
      "json",
      "--take",
      "10",
      "--exact-match"
    ]);
  });
});

describe("dotnet list package output parsing", () => {
  const OUTDATED = JSON.stringify({
    version: 1,
    parameters: "--outdated",
    projects: [
      {
        path: "/w/src/MyApp.Api/MyApp.Api.csproj",
        frameworks: [
          {
            framework: "net8.0",
            topLevelPackages: [
              { id: "Serilog", requestedVersion: "3.0.0", resolvedVersion: "3.0.0", latestVersion: "4.0.1" },
              { id: "UpToDate", requestedVersion: "1.0.0", resolvedVersion: "1.0.0", latestVersion: "1.0.0" }
            ]
          }
        ]
      }
    ]
  });

  it("parses outdated packages and drops up-to-date ones", () => {
    const result = parseOutdatedJson(`Informational line\n${OUTDATED}`);
    expect(result).toEqual([
      {
        id: "Serilog",
        projectName: "MyApp.Api",
        projectPath: "/w/src/MyApp.Api/MyApp.Api.csproj",
        requestedVersion: "3.0.0",
        resolvedVersion: "3.0.0",
        latestVersion: "4.0.1",
        isTransitive: false
      }
    ]);
  });

  it("parses vulnerable packages", () => {
    const json = JSON.stringify({
      projects: [
        {
          path: "/w/App.csproj",
          frameworks: [
            {
              framework: "net8.0",
              topLevelPackages: [
                {
                  id: "BadPkg",
                  resolvedVersion: "1.0.0",
                  vulnerabilities: [{ severity: "High", advisoryurl: "https://github.com/advisories/X" }]
                }
              ]
            }
          ]
        }
      ]
    });
    const result = parseVulnerableJson(json);
    expect(result).toHaveLength(1);
    expect(result![0].severity).toBe("High");
    expect(result![0].advisoryUrl).toBe("https://github.com/advisories/X");
  });

  it("parses deprecated packages with alternatives", () => {
    const json = JSON.stringify({
      projects: [
        {
          path: "/w/App.csproj",
          frameworks: [
            {
              framework: "net8.0",
              topLevelPackages: [
                {
                  id: "OldPkg",
                  resolvedVersion: "1.0.0",
                  deprecationReasons: ["Legacy"],
                  alternativePackage: { id: "NewPkg", versionRange: ">= 2.0.0" }
                }
              ]
            }
          ]
        }
      ]
    });
    const result = parseDeprecatedJson(json);
    expect(result![0].reasons).toEqual(["Legacy"]);
    expect(result![0].alternativeId).toBe("NewPkg");
  });

  it("returns null for unparseable output", () => {
    expect(parseOutdatedJson("error: not json")).toBeNull();
    expect(parseVulnerableJson("")).toBeNull();
  });
});

describe("dotnet nuget list source parsing", () => {
  it("parses the detailed source list format", () => {
    const output = `Registered Sources:
  1.  nuget.org [Enabled]
      https://api.nuget.org/v3/index.json
  2.  company-feed [Disabled]
      https://pkgs.example.com/v3/index.json
`;
    expect(parseSourceListOutput(output)).toEqual([
      { name: "nuget.org", url: "https://api.nuget.org/v3/index.json", enabled: true },
      { name: "company-feed", url: "https://pkgs.example.com/v3/index.json", enabled: false }
    ]);
  });
});

describe("dotnet package search parsing", () => {
  it("parses search json output", () => {
    const output = JSON.stringify({
      version: 2,
      problems: [],
      searchResult: [
        {
          sourceName: "nuget.org",
          packages: [{ id: "Newtonsoft.Json", latestVersion: "13.0.3", totalDownloads: 5000000000, owners: "jamesnk" }]
        }
      ]
    });
    const results = parseSearchJson(output);
    expect(results).toHaveLength(1);
    expect(results![0]).toMatchObject({ id: "Newtonsoft.Json", version: "13.0.3", source: "nuget.org" });
  });
});

describe("sdk version parsing", () => {
  it("parses dotnet --version output", () => {
    expect(parseSdkVersion("8.0.401\n")).toBe("8.0.401");
    expect(parseSdkVersion("command not found")).toBeUndefined();
  });
});

describe("secret masking", () => {
  it("masks key/value style secrets in free text", () => {
    const masked = maskSecrets("password=SuperSecret123 apiKey: abc123 token = xyz");
    expect(masked).not.toContain("SuperSecret123");
    expect(masked).not.toContain("abc123");
    expect(masked).not.toContain("xyz");
    expect(masked).toContain(MASK);
  });

  it("masks credentials embedded in URLs", () => {
    const masked = maskSecrets("restoring from https://user:hunter2@feed.example.com/v3/index.json");
    expect(masked).not.toContain("hunter2");
    expect(masked).toContain(`user:${MASK}@`);
  });

  it("masks bearer tokens", () => {
    expect(maskSecrets("Authorization: Bearer eyJhbGciOi")).not.toContain("eyJhbGciOi");
  });

  it("masks values following sensitive CLI flags", () => {
    const masked = maskArgs(["nuget", "add", "source", "https://x", "--password", "hunter2", "--name", "feed"]);
    expect(masked).toEqual(["nuget", "add", "source", "https://x", "--password", MASK, "--name", "feed"]);
  });

  it("leaves normal args untouched", () => {
    expect(maskArgs(["add", "p.csproj", "package", "Serilog", "--version", "4.0.0"])).toEqual([
      "add",
      "p.csproj",
      "package",
      "Serilog",
      "--version",
      "4.0.0"
    ]);
  });
});
