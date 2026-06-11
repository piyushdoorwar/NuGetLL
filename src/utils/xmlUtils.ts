import { XMLParser, XMLValidator } from "fast-xml-parser";

/**
 * Parses XML into a plain object, or returns null for invalid XML.
 * Attributes are exposed with the `@_` prefix; tag values are kept as strings.
 */
export function parseXml(content: string): Record<string, unknown> | null {
  if (typeof content !== "string" || content.trim().length === 0) {
    return null;
  }
  const valid = XMLValidator.validate(content);
  if (valid !== true) {
    return null;
  }
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      parseTagValue: false,
      parseAttributeValue: false,
      trimValues: true
    });
    return parser.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Normalizes a value that may be a single item or an array into an array. */
export function ensureArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

/** Reads a string attribute (e.g. "@_Include") from a parsed XML node. */
export function attr(node: unknown, name: string): string | undefined {
  if (node && typeof node === "object") {
    const value = (node as Record<string, unknown>)[`@_${name}`];
    if (typeof value === "string") {
      return value;
    }
  }
  return undefined;
}
