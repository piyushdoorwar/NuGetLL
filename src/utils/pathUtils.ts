import * as path from "path";

/** True when `child` is strictly inside `parent`. */
export function isInside(parent: string, child: string): boolean {
  const rel = path.relative(path.resolve(parent), path.resolve(child));
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

/** True when `target` is inside (or equal to) any of the given roots. */
export function isInsideAny(roots: string[], target: string): boolean {
  const resolved = path.resolve(target);
  return roots.some((root) => {
    const r = path.resolve(root);
    return resolved === r || isInside(r, resolved);
  });
}

/** Returns ancestor directories of `filePath` up to and including `stopDir`. Nearest first. */
export function ancestorDirs(filePath: string, stopDir: string): string[] {
  const stop = path.resolve(stopDir);
  const dirs: string[] = [];
  let dir = path.dirname(path.resolve(filePath));
  while (true) {
    dirs.push(dir);
    if (dir === stop) {
      break;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  return dirs;
}

export function fileNameWithoutExtension(filePath: string): string {
  const base = path.basename(filePath);
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(0, dot) : base;
}
