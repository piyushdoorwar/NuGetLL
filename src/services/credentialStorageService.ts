import * as vscode from "vscode";

/** PAT credential: email identifies the user, token is the secret. */
export interface StoredCredential {
  email: string;
  token: string;
}

export function toAuthHeader(cred: StoredCredential): string {
  // NuGet PAT auth: Basic base64(email:token)
  return `Basic ${Buffer.from(`${cred.email}:${cred.token}`).toString("base64")}`;
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

  private key(sourceName: string): string {
    return `${CredentialStorageService.PREFIX}${sourceName}`;
  }
}
