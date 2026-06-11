import * as fs from "fs/promises";
import { isSafeXmlAttributeValue, isValidPackageId, isValidVersionText } from "../utils/security";
import { parseCentralPackagesProps } from "./projectParser";

/**
 * Targeted, formatting-preserving edits for Directory.Packages.props and
 * project files used when a project is under Central Package Management.
 * String-level edits are used (instead of re-serializing the XML tree) so
 * user formatting and comments survive.
 */

function assertSafe(packageId: string, version?: string): void {
  if (!isValidPackageId(packageId) || !isSafeXmlAttributeValue(packageId)) {
    throw new Error(`Refusing to write suspicious package id: ${JSON.stringify(packageId)}`);
  }
  if (version !== undefined && (!isValidVersionText(version) || !isSafeXmlAttributeValue(version))) {
    throw new Error(`Refusing to write suspicious version: ${JSON.stringify(version)}`);
  }
}

function packageVersionRegex(packageId: string): RegExp {
  const escaped = packageId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `<PackageVersion\\s+Include="${escaped}"\\s+Version="[^"]*"\\s*/?>`,
    "i"
  );
}

/** Adds or updates a PackageVersion entry. Returns the new file content. */
export function setPackageVersion(propsContent: string, packageId: string, version: string): string {
  assertSafe(packageId, version);
  const existing = packageVersionRegex(packageId);
  if (existing.test(propsContent)) {
    return propsContent.replace(existing, `<PackageVersion Include="${packageId}" Version="${version}" />`);
  }

  const entry = `    <PackageVersion Include="${packageId}" Version="${version}" />`;
  // Prefer inserting next to existing PackageVersion entries.
  const lastEntry = /([ \t]*)<PackageVersion\s+[^>]*\/?>(?![\s\S]*<PackageVersion)/i.exec(propsContent);
  if (lastEntry) {
    const indent = lastEntry[1] || "    ";
    const insertAt = lastEntry.index + lastEntry[0].length;
    return `${propsContent.slice(0, insertAt)}\n${indent}<PackageVersion Include="${packageId}" Version="${version}" />${propsContent.slice(insertAt)}`;
  }
  // Otherwise create a new ItemGroup before </Project>.
  const closing = propsContent.lastIndexOf("</Project>");
  if (closing < 0) {
    throw new Error("Directory.Packages.props has no closing </Project> tag.");
  }
  const block = `  <ItemGroup>\n${entry}\n  </ItemGroup>\n`;
  return `${propsContent.slice(0, closing)}${block}${propsContent.slice(closing)}`;
}

/** Removes a PackageVersion entry (and its line) if present. */
export function removePackageVersion(propsContent: string, packageId: string): string {
  assertSafe(packageId);
  const escaped = packageId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const lineRegex = new RegExp(
    `[ \\t]*<PackageVersion\\s+Include="${escaped}"[^>]*/?>[ \\t]*\\r?\\n?`,
    "i"
  );
  return propsContent.replace(lineRegex, "");
}

/** True when the props file already declares a version for the package. */
export function hasPackageVersion(propsContent: string, packageId: string): boolean {
  const parsed = parseCentralPackagesProps(propsContent);
  if (!parsed) {
    return false;
  }
  return Object.keys(parsed.packageVersions).some((id) => id.toLowerCase() === packageId.toLowerCase());
}

/** Adds a version-less PackageReference to a project file (CPM style). */
export function addPackageReferenceWithoutVersion(projectContent: string, packageId: string): string {
  assertSafe(packageId);
  const escaped = packageId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp(`<PackageReference\\s+Include="${escaped}"`, "i").test(projectContent)) {
    return projectContent; // already referenced
  }
  const lastRef = /([ \t]*)<PackageReference\s+[^>]*\/?>(?![\s\S]*<PackageReference)/i.exec(projectContent);
  if (lastRef) {
    const indent = lastRef[1] || "    ";
    const insertAt = lastRef.index + lastRef[0].length;
    return `${projectContent.slice(0, insertAt)}\n${indent}<PackageReference Include="${packageId}" />${projectContent.slice(insertAt)}`;
  }
  const closing = projectContent.lastIndexOf("</Project>");
  if (closing < 0) {
    throw new Error("Project file has no closing </Project> tag.");
  }
  const block = `  <ItemGroup>\n    <PackageReference Include="${packageId}" />\n  </ItemGroup>\n`;
  return `${projectContent.slice(0, closing)}${block}${projectContent.slice(closing)}`;
}

/** Removes a PackageReference (self-closing or with children) from a project file. */
export function removePackageReference(projectContent: string, packageId: string): string {
  assertSafe(packageId);
  const escaped = packageId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const selfClosing = new RegExp(
    `[ \\t]*<PackageReference\\s+Include="${escaped}"[^>]*/>[ \\t]*\\r?\\n?`,
    "i"
  );
  if (selfClosing.test(projectContent)) {
    return projectContent.replace(selfClosing, "");
  }
  const withChildren = new RegExp(
    `[ \\t]*<PackageReference\\s+Include="${escaped}"[^>]*>[\\s\\S]*?</PackageReference>[ \\t]*\\r?\\n?`,
    "i"
  );
  return projectContent.replace(withChildren, "");
}

export class CentralPackageService {
  async setVersionInProps(propsPath: string, packageId: string, version: string): Promise<void> {
    const content = await fs.readFile(propsPath, "utf8");
    await fs.writeFile(propsPath, setPackageVersion(content, packageId, version), "utf8");
  }

  async removeVersionFromProps(propsPath: string, packageId: string): Promise<void> {
    const content = await fs.readFile(propsPath, "utf8");
    await fs.writeFile(propsPath, removePackageVersion(content, packageId), "utf8");
  }

  async hasVersionInProps(propsPath: string, packageId: string): Promise<boolean> {
    const content = await fs.readFile(propsPath, "utf8");
    return hasPackageVersion(content, packageId);
  }

  async addReferenceToProject(projectPath: string, packageId: string): Promise<void> {
    const content = await fs.readFile(projectPath, "utf8");
    await fs.writeFile(projectPath, addPackageReferenceWithoutVersion(content, packageId), "utf8");
  }

  async removeReferenceFromProject(projectPath: string, packageId: string): Promise<void> {
    const content = await fs.readFile(projectPath, "utf8");
    await fs.writeFile(projectPath, removePackageReference(content, packageId), "utf8");
  }
}
