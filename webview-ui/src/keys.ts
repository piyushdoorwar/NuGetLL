/** Stable key for an outdated row (a package in a specific project). */
export const outdatedKey = (packageId: string, projectPath: string) =>
  `${packageId.toLowerCase()} ${projectPath}`;
