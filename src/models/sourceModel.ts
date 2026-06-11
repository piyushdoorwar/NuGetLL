export interface PackageSource {
  name: string;
  /** URL or local path of the feed. */
  url: string;
  enabled: boolean;
  /** Path of the NuGet.Config defining this source, when known. */
  configPath?: string;
}
