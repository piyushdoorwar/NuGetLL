import {
  PackageDependencyGroup,
  PackageDetails,
  PackageSearchResult,
  PackageVersionInfo
} from "../models/packageModel";

const FETCH_TIMEOUT_MS = 15000;

interface ServiceIndexResource {
  "@id": string;
  "@type": string;
}

interface ServiceIndex {
  resources: ServiceIndexResource[];
}

interface SearchResultItem {
  id: string;
  version: string;
  description?: string;
  iconUrl?: string;
  totalDownloads?: number;
  verified?: boolean;
  authors?: string | string[];
  owners?: string | string[];
  tags?: string | string[];
  projectUrl?: string;
  versions?: { version: string; downloads?: number }[];
}

interface RegistrationCatalogEntry {
  id: string;
  version: string;
  description?: string;
  iconUrl?: string;
  authors?: string | string[];
  tags?: string | string[];
  projectUrl?: string;
  licenseExpression?: string;
  licenseUrl?: string;
  listed?: boolean;
  deprecation?: {
    reasons?: string[];
    message?: string;
    alternatePackage?: { id?: string; range?: string };
  };
  vulnerabilities?: { severity?: string; advisoryUrl?: string }[];
  dependencyGroups?: {
    targetFramework?: string;
    dependencies?: { id: string; range?: string }[];
  }[];
}

interface RegistrationLeaf {
  catalogEntry?: RegistrationCatalogEntry | string;
}

interface RegistrationPage {
  "@id": string;
  items?: RegistrationLeaf[];
}

interface RegistrationIndex {
  items?: RegistrationPage[];
}

function toArray(value: string | string[] | undefined): string[] {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }
  return value.split(",").map((v) => v.trim()).filter(Boolean);
}

function isPrerelease(version: string): boolean {
  return version.includes("-");
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { Accept: "application/json" }
  });
  if (!response.ok) {
    throw new Error(`Request to ${url} failed with HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

/**
 * Talks to a NuGet v3 HTTP feed (nuget.org by default). All methods throw on
 * network failure; callers decide whether to fall back to the dotnet CLI.
 */
export class NugetApiService {
  private serviceIndexCache = new Map<string, ServiceIndex>();

  constructor(private readonly getServiceIndexUrl: () => string) {}

  private async resolveResource(types: string[], serviceIndexUrl?: string): Promise<string> {
    const indexUrl = serviceIndexUrl ?? this.getServiceIndexUrl();
    let index = this.serviceIndexCache.get(indexUrl);
    if (!index) {
      index = await fetchJson<ServiceIndex>(indexUrl);
      this.serviceIndexCache.set(indexUrl, index);
    }
    for (const type of types) {
      const resource = index.resources.find((r) => r["@type"] === type);
      if (resource) {
        return resource["@id"].replace(/\/$/, "");
      }
    }
    throw new Error(`NuGet feed does not provide any of: ${types.join(", ")}`);
  }

  async searchPackages(
    query: string,
    options: { includePrerelease?: boolean; take?: number; skip?: number; serviceIndexUrl?: string; sourceName?: string } = {}
  ): Promise<PackageSearchResult[]> {
    const base = await this.resolveResource(
      ["SearchQueryService/3.5.0", "SearchQueryService/3.0.0-rc", "SearchQueryService"],
      options.serviceIndexUrl
    );
    const params = new URLSearchParams({
      q: query,
      prerelease: String(options.includePrerelease ?? false),
      take: String(options.take ?? 25),
      skip: String(options.skip ?? 0),
      semVerLevel: "2.0.0"
    });
    const data = await fetchJson<{ data: SearchResultItem[] }>(`${base}?${params}`);
    const sourceName = options.sourceName ?? "nuget.org";
    return (data.data ?? []).map((item) => ({
      id: item.id,
      version: item.version,
      description: item.description,
      iconUrl: item.iconUrl,
      totalDownloads: item.totalDownloads,
      verified: item.verified,
      authors: toArray(item.authors),
      owners: toArray(item.owners),
      tags: toArray(item.tags),
      projectUrl: item.projectUrl,
      source: sourceName
    }));
  }

  /** Lists all versions of a package via the flat-container resource. */
  async getVersions(packageId: string, serviceIndexUrl?: string): Promise<string[]> {
    const base = await this.resolveResource(["PackageBaseAddress/3.0.0"], serviceIndexUrl);
    const data = await fetchJson<{ versions: string[] }>(
      `${base}/${packageId.toLowerCase()}/index.json`
    );
    return data.versions ?? [];
  }

  private async getRegistrationEntries(
    packageId: string,
    serviceIndexUrl?: string
  ): Promise<RegistrationCatalogEntry[]> {
    const base = await this.resolveResource(
      [
        "RegistrationsBaseUrl/3.6.0",
        "RegistrationsBaseUrl/3.4.0",
        "RegistrationsBaseUrl"
      ],
      serviceIndexUrl
    );
    const index = await fetchJson<RegistrationIndex>(`${base}/${packageId.toLowerCase()}/index.json`);
    const entries: RegistrationCatalogEntry[] = [];
    for (const page of index.items ?? []) {
      let items = page.items;
      if (!items) {
        const fullPage = await fetchJson<RegistrationPage>(page["@id"]);
        items = fullPage.items ?? [];
      }
      for (const leaf of items) {
        if (leaf.catalogEntry && typeof leaf.catalogEntry === "object") {
          entries.push(leaf.catalogEntry);
        }
      }
    }
    return entries;
  }

  async getPackageDetails(
    packageId: string,
    options: { serviceIndexUrl?: string; sourceName?: string } = {}
  ): Promise<PackageDetails> {
    const [searchResults, entries] = await Promise.all([
      this.searchPackages(packageId, {
        includePrerelease: true,
        take: 1,
        serviceIndexUrl: options.serviceIndexUrl,
        sourceName: options.sourceName
      }).catch(() => [] as PackageSearchResult[]),
      this.getRegistrationEntries(packageId, options.serviceIndexUrl)
    ]);

    if (entries.length === 0) {
      throw new Error(`Package '${packageId}' was not found on the feed.`);
    }

    const fromSearch = searchResults.find((r) => r.id.toLowerCase() === packageId.toLowerCase());
    const versions: PackageVersionInfo[] = entries
      .filter((e) => e.listed !== false)
      .map((e) => ({ version: e.version, isPrerelease: isPrerelease(e.version) }))
      .reverse();

    const stable = versions.find((v) => !v.isPrerelease);
    const prerelease = versions.find((v) => v.isPrerelease);
    const latestEntry =
      entries.find((e) => e.version === (stable?.version ?? versions[0]?.version)) ??
      entries[entries.length - 1];

    const dependencyGroups: PackageDependencyGroup[] = (latestEntry.dependencyGroups ?? []).map(
      (group) => ({
        targetFramework: group.targetFramework ?? "Any",
        dependencies: (group.dependencies ?? []).map((dep) => ({
          id: dep.id,
          range: dep.range ?? "*"
        }))
      })
    );

    return {
      id: latestEntry.id ?? packageId,
      version: stable?.version ?? versions[0]?.version ?? latestEntry.version,
      description: latestEntry.description ?? fromSearch?.description,
      iconUrl: fromSearch?.iconUrl ?? latestEntry.iconUrl,
      totalDownloads: fromSearch?.totalDownloads,
      verified: fromSearch?.verified,
      authors: toArray(latestEntry.authors).length > 0 ? toArray(latestEntry.authors) : fromSearch?.authors ?? [],
      owners: fromSearch?.owners,
      tags: toArray(latestEntry.tags).length > 0 ? toArray(latestEntry.tags) : fromSearch?.tags ?? [],
      projectUrl: latestEntry.projectUrl ?? fromSearch?.projectUrl,
      source: options.sourceName ?? "nuget.org",
      licenseExpression: latestEntry.licenseExpression,
      licenseUrl: latestEntry.licenseUrl,
      repositoryUrl: undefined,
      latestStableVersion: stable?.version,
      latestPrereleaseVersion: prerelease?.version,
      versions,
      deprecation: latestEntry.deprecation
        ? {
            reasons: latestEntry.deprecation.reasons ?? [],
            message: latestEntry.deprecation.message,
            alternativePackageId: latestEntry.deprecation.alternatePackage?.id,
            alternativePackageRange: latestEntry.deprecation.alternatePackage?.range
          }
        : undefined,
      vulnerabilities: (latestEntry.vulnerabilities ?? []).map((v) => ({
        severity: v.severity ?? "Unknown",
        advisoryUrl: v.advisoryUrl ?? ""
      })),
      dependencyGroups,
      usedInProjects: []
    };
  }
}
