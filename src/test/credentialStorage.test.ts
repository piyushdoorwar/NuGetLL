import { describe, expect, it, vi } from "vitest";
import { CredentialStorageService, StoredCredential, toAuthHeader } from "../services/credentialStorageService";
import type * as vscode from "vscode";

// ---------------------------------------------------------------------------
// toAuthHeader unit tests
// ---------------------------------------------------------------------------

describe("toAuthHeader", () => {
  it("encodes email and token as Basic auth", () => {
    const cred: StoredCredential = { email: "user@example.com", token: "mytoken" };
    const header = toAuthHeader(cred);
    expect(header).toBe(`Basic ${Buffer.from("user@example.com:mytoken").toString("base64")}`);
  });

  it("produces a header starting with 'Basic '", () => {
    expect(toAuthHeader({ email: "a@b.com", token: "t" })).toMatch(/^Basic /);
  });

  it("handles special characters in token", () => {
    const cred: StoredCredential = { email: "x@y.com", token: "abc/def+ghi==" };
    const header = toAuthHeader(cred);
    const decoded = Buffer.from(header.replace("Basic ", ""), "base64").toString();
    expect(decoded).toBe("x@y.com:abc/def+ghi==");
  });
});

// ---------------------------------------------------------------------------
// CredentialStorageService unit tests (mocked SecretStorage)
// ---------------------------------------------------------------------------

function makeSecrets(store: Map<string, string> = new Map()): vscode.SecretStorage {
  return {
    get: vi.fn(async (key: string) => store.get(key)),
    store: vi.fn(async (key: string, value: string) => { store.set(key, value); }),
    delete: vi.fn(async (key: string) => { store.delete(key); }),
    onDidChange: { event: vi.fn() }
  } as unknown as vscode.SecretStorage;
}

describe("CredentialStorageService", () => {
  it("returns null when no credential is stored", async () => {
    const svc = new CredentialStorageService(makeSecrets());
    expect(await svc.get("my-feed")).toBeNull();
  });

  it("stores and retrieves a credential", async () => {
    const svc = new CredentialStorageService(makeSecrets());
    const cred: StoredCredential = { email: "dev@corp.com", token: "pat-abc123" };
    await svc.set("my-feed", cred);
    expect(await svc.get("my-feed")).toEqual(cred);
  });

  it("has() returns false before storing", async () => {
    const svc = new CredentialStorageService(makeSecrets());
    expect(await svc.has("my-feed")).toBe(false);
  });

  it("has() returns true after storing", async () => {
    const svc = new CredentialStorageService(makeSecrets());
    await svc.set("my-feed", { email: "a@b.com", token: "t" });
    expect(await svc.has("my-feed")).toBe(true);
  });

  it("delete() removes the credential", async () => {
    const svc = new CredentialStorageService(makeSecrets());
    await svc.set("my-feed", { email: "a@b.com", token: "t" });
    await svc.delete("my-feed");
    expect(await svc.get("my-feed")).toBeNull();
    expect(await svc.has("my-feed")).toBe(false);
  });

  it("namespaces keys to avoid collisions", async () => {
    const store = new Map<string, string>();
    const svc = new CredentialStorageService(makeSecrets(store));
    await svc.set("feed-a", { email: "a@a.com", token: "t1" });
    await svc.set("feed-b", { email: "b@b.com", token: "t2" });
    expect(store.has("nuget-ll:cred:feed-a")).toBe(true);
    expect(store.has("nuget-ll:cred:feed-b")).toBe(true);
    expect(await svc.get("feed-a")).not.toEqual(await svc.get("feed-b"));
  });

  it("returns null for corrupted JSON", async () => {
    const store = new Map<string, string>([["nuget-ll:cred:bad", "not-json{{{"]]);
    const svc = new CredentialStorageService(makeSecrets(store));
    expect(await svc.get("bad")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// NugetApiService auth header integration tests (mocked fetch)
// ---------------------------------------------------------------------------

import { NugetApiService } from "../services/nugetApiService";

const SEARCH_URL = "https://private.feed/v3/index.json";

function makeServiceIndex(searchBase: string) {
  return {
    resources: [
      { "@id": searchBase + "/", "@type": "SearchQueryService/3.5.0" },
      { "@id": "https://private.feed/flat/", "@type": "PackageBaseAddress/3.0.0" },
      { "@id": "https://private.feed/reg/", "@type": "RegistrationsBaseUrl/3.6.0" }
    ]
  };
}

describe("NugetApiService private feed auth", () => {
  it("injects Authorization header when credential exists", async () => {
    const cred: StoredCredential = { email: "user@corp.com", token: "secret-pat" };
    const expectedAuth = toAuthHeader(cred);

    const capturedHeaders: Record<string, string>[] = [];
    const mockFetch = vi.fn(async (url: string, init?: RequestInit) => {
      capturedHeaders.push((init?.headers ?? {}) as Record<string, string>);
      if (url === SEARCH_URL) {
        return { ok: true, json: async () => makeServiceIndex("https://private.feed/search") } as Response;
      }
      return { ok: true, json: async () => ({ data: [] }) } as Response;
    });

    vi.stubGlobal("fetch", mockFetch);

    const api = new NugetApiService(
      () => SEARCH_URL,
      async () => cred
    );

    await api.searchPackages("Serilog", { serviceIndexUrl: SEARCH_URL, sourceName: "my-feed" });

    const authHeaders = capturedHeaders.filter((h) => h["Authorization"]);
    expect(authHeaders.length).toBeGreaterThan(0);
    expect(authHeaders[0]["Authorization"]).toBe(expectedAuth);

    vi.unstubAllGlobals();
  });

  it("makes unauthenticated requests when no credential exists", async () => {
    const capturedHeaders: Record<string, string>[] = [];
    const mockFetch = vi.fn(async (url: string, init?: RequestInit) => {
      capturedHeaders.push((init?.headers ?? {}) as Record<string, string>);
      if (url === SEARCH_URL) {
        return { ok: true, json: async () => makeServiceIndex("https://private.feed/search") } as Response;
      }
      return { ok: true, json: async () => ({ data: [] }) } as Response;
    });

    vi.stubGlobal("fetch", mockFetch);

    const api = new NugetApiService(() => SEARCH_URL, async () => null);
    await api.searchPackages("Newtonsoft", { serviceIndexUrl: SEARCH_URL, sourceName: "no-creds-feed" });

    const authHeaders = capturedHeaders.filter((h) => h["Authorization"]);
    expect(authHeaders.length).toBe(0);

    vi.unstubAllGlobals();
  });

  it("throws a meaningful error on 401 from private feed", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 401 }) as Response));

    const api = new NugetApiService(() => SEARCH_URL, async () => null);
    await expect(
      api.searchPackages("Pkg", { serviceIndexUrl: SEARCH_URL, sourceName: "locked-feed" })
    ).rejects.toThrow("401");

    vi.unstubAllGlobals();
  });

  it("throws a meaningful error on 404 from private feed", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404 }) as Response));

    const api = new NugetApiService(() => SEARCH_URL, async () => null);
    await expect(
      api.searchPackages("Pkg", { serviceIndexUrl: SEARCH_URL })
    ).rejects.toThrow("404");

    vi.unstubAllGlobals();
  });
});
