import * as vscode from "vscode";

export interface StoredCredential {
  type: "pat" | "basic";
  username?: string;
  password: string;
}

export class CredentialStorageService {
  private static readonly PREFIX = "nuget-ll:cred:";

  constructor(private readonly secrets: vscode.SecretStorage) {}

  async get(sourceName: string): Promise<StoredCredential | null> {
    const raw = await this.secrets.get(this.key(sourceName));
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as StoredCredential;
    } catch {
      return null;
    }
  }

  async set(sourceName: string, cred: StoredCredential): Promise<void> {
    await this.secrets.store(this.key(sourceName), JSON.stringify(cred));
  }

  async delete(sourceName: string): Promise<void> {
    await this.secrets.delete(this.key(sourceName));
  }

  async has(sourceName: string): Promise<boolean> {
    return (await this.secrets.get(this.key(sourceName))) !== undefined;
  }

  toAuthHeader(cred: StoredCredential): string {
    const user = cred.username?.trim() || (cred.type === "pat" ? "pat" : "user");
    return `Basic ${Buffer.from(`${user}:${cred.password}`).toString("base64")}`;
  }

  private key(sourceName: string): string {
    return `${CredentialStorageService.PREFIX}${sourceName}`;
  }
}
