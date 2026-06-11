import { PackageReference } from "../models/packageModel";
import { PackageSource } from "../models/sourceModel";
import { attr, ensureArray, parseXml } from "../utils/xmlUtils";

export interface ParsedProjectFile {
  sdkStyle: boolean;
  targetFrameworks: string[];
  packages: PackageReference[];
  /** True when the project explicitly enables/disables CPM in a PropertyGroup. */
  managePackageVersionsCentrally?: boolean;
}

export interface ParsedCentralPackages {
  managementEnabled: boolean;
  packageVersions: Record<string, string>;
}

type XmlNode = Record<string, unknown>;

function propertyGroups(project: XmlNode): XmlNode[] {
  return ensureArray(project["PropertyGroup"] as XmlNode | XmlNode[] | undefined);
}

function itemGroups(project: XmlNode): XmlNode[] {
  return ensureArray(project["ItemGroup"] as XmlNode | XmlNode[] | undefined);
}

function readProperty(project: XmlNode, name: string): string | undefined {
  for (const group of propertyGroups(project)) {
    const value = group[name];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return undefined;
}

/** Parses a .csproj/.fsproj/.vbproj file. Returns null for invalid XML. */
export function parseProjectFile(content: string): ParsedProjectFile | null {
  const doc = parseXml(content);
  if (!doc || typeof doc["Project"] !== "object" || doc["Project"] === null) {
    return null;
  }
  const project = doc["Project"] as XmlNode;

  const sdkStyle = attr(project, "Sdk") !== undefined || project["Sdk"] !== undefined;

  const single = readProperty(project, "TargetFramework");
  const multi = readProperty(project, "TargetFrameworks");
  const targetFrameworks = (multi ? multi.split(";") : single ? [single] : [])
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  const packages: PackageReference[] = [];
  for (const group of itemGroups(project)) {
    for (const ref of ensureArray(group["PackageReference"] as XmlNode | XmlNode[] | undefined)) {
      const id = attr(ref, "Include") ?? attr(ref, "Update");
      if (!id) {
        continue;
      }
      let version = attr(ref, "Version");
      if (!version && ref && typeof ref === "object") {
        const child = (ref as XmlNode)["Version"];
        if (typeof child === "string") {
          version = child;
        }
      }
      packages.push(version ? { id, version } : { id });
    }
  }

  const cpmRaw = readProperty(project, "ManagePackageVersionsCentrally");
  const managePackageVersionsCentrally =
    cpmRaw === undefined ? undefined : cpmRaw.toLowerCase() === "true";

  return { sdkStyle, targetFrameworks, packages, managePackageVersionsCentrally };
}

/** Parses Directory.Packages.props. Returns null for invalid XML. */
export function parseCentralPackagesProps(content: string): ParsedCentralPackages | null {
  const doc = parseXml(content);
  if (!doc || typeof doc["Project"] !== "object" || doc["Project"] === null) {
    return null;
  }
  const project = doc["Project"] as XmlNode;

  const enabledRaw = readProperty(project, "ManagePackageVersionsCentrally");
  const packageVersions: Record<string, string> = {};
  for (const group of itemGroups(project)) {
    for (const entry of ensureArray(group["PackageVersion"] as XmlNode | XmlNode[] | undefined)) {
      const id = attr(entry, "Include") ?? attr(entry, "Update");
      const version = attr(entry, "Version");
      if (id && version) {
        packageVersions[id] = version;
      }
    }
  }

  const managementEnabled =
    enabledRaw !== undefined
      ? enabledRaw.toLowerCase() === "true"
      : Object.keys(packageVersions).length > 0;

  return { managementEnabled, packageVersions };
}

/** Parses a NuGet.Config and returns the sources it defines. Returns null for invalid XML. */
export function parseNugetConfig(content: string, configPath?: string): PackageSource[] | null {
  const doc = parseXml(content);
  if (!doc || typeof doc["configuration"] !== "object" || doc["configuration"] === null) {
    return null;
  }
  const configuration = doc["configuration"] as XmlNode;
  const packageSources = configuration["packageSources"] as XmlNode | undefined;
  const disabledSources = configuration["disabledPackageSources"] as XmlNode | undefined;

  const disabled = new Set<string>();
  if (disabledSources && typeof disabledSources === "object") {
    for (const entry of ensureArray(disabledSources["add"] as XmlNode | XmlNode[] | undefined)) {
      const key = attr(entry, "key");
      const value = attr(entry, "value");
      if (key && value?.toLowerCase() === "true") {
        disabled.add(key.toLowerCase());
      }
    }
  }

  const sources: PackageSource[] = [];
  if (packageSources && typeof packageSources === "object") {
    for (const entry of ensureArray(packageSources["add"] as XmlNode | XmlNode[] | undefined)) {
      const key = attr(entry, "key");
      const value = attr(entry, "value");
      if (key && value) {
        sources.push({
          name: key,
          url: value,
          enabled: !disabled.has(key.toLowerCase()),
          configPath
        });
      }
    }
  }
  return sources;
}

/** Parses a legacy packages.config. Returns null for invalid XML. */
export function parsePackagesConfig(content: string): PackageReference[] | null {
  const doc = parseXml(content);
  if (!doc || typeof doc["packages"] !== "object" || doc["packages"] === null) {
    return null;
  }
  const packagesNode = doc["packages"] as XmlNode;
  const result: PackageReference[] = [];
  for (const entry of ensureArray(packagesNode["package"] as XmlNode | XmlNode[] | undefined)) {
    const id = attr(entry, "id");
    const version = attr(entry, "version");
    if (id) {
      result.push(version ? { id, version } : { id });
    }
  }
  return result;
}
