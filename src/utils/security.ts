/**
 * Helpers to keep secrets out of logs and UI output.
 * These are intentionally aggressive: a false-positive mask is preferable
 * to leaking a token in the NuGet LL output channel.
 */

const KEY_VALUE_PATTERN =
  /\b(password|pwd|passwd|token|apikey|api[-_]?key|pat|secret|authorization|clearTextPassword)\b(\s*[:=]\s*|\s+)(["']?)([^"'\s;,&<>]+)\3/gi;

const URL_CREDENTIALS_PATTERN = /(https?:\/\/)([^/\s:@]+):([^/\s@]+)@/gi;

const BEARER_PATTERN = /\b(bearer)\s+([A-Za-z0-9\-._~+/]+=*)/gi;

/** CLI flags whose following argument must never be logged. */
const SENSITIVE_FLAGS = new Set([
  "--password",
  "--api-key",
  "--apikey",
  "-p"
]);

export const MASK = "********";

/** Replaces likely secrets (passwords, tokens, keys, URL credentials) in free text. */
export function maskSecrets(text: string): string {
  if (!text) {
    return text;
  }
  // Bearer first: the key/value pattern would otherwise consume "Bearer" as
  // the value of "Authorization:" and leave the token itself exposed.
  return text
    .replace(BEARER_PATTERN, (_m, bearer: string) => `${bearer} ${MASK}`)
    .replace(KEY_VALUE_PATTERN, (_m, key: string, sep: string, quote: string) => `${key}${sep}${quote}${MASK}${quote}`)
    .replace(URL_CREDENTIALS_PATTERN, (_m, proto: string, user: string) => `${proto}${user}:${MASK}@`);
}

/** Masks values following sensitive CLI flags so argument arrays can be logged safely. */
export function maskArgs(args: string[]): string[] {
  const out: string[] = [];
  let maskNext = false;
  for (const arg of args) {
    if (maskNext) {
      out.push(MASK);
      maskNext = false;
      continue;
    }
    const lower = arg.toLowerCase();
    if (SENSITIVE_FLAGS.has(lower)) {
      out.push(arg);
      maskNext = true;
      continue;
    }
    const eq = lower.indexOf("=");
    if (eq > 0 && SENSITIVE_FLAGS.has(lower.slice(0, eq))) {
      out.push(`${arg.slice(0, eq + 1)}${MASK}`);
      continue;
    }
    out.push(maskSecrets(arg));
  }
  return out;
}

/** Basic sanity check for values interpolated into XML attributes. */
export function isSafeXmlAttributeValue(value: string): boolean {
  return !/[<>"&]/.test(value);
}

/** Validates that a package id looks like a real NuGet id (defense-in-depth for file edits). */
export function isValidPackageId(id: string): boolean {
  return /^[A-Za-z0-9_.-]+$/.test(id) && id.length <= 100;
}

/** Validates a NuGet version string (semver-ish, allows ranges used by NuGet). */
export function isValidVersionText(version: string): boolean {
  return /^[A-Za-z0-9_.+*()\[\],-]+$/.test(version) && version.length <= 64;
}
