import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface StoredCredentials {
  clientId: string;
  clientSecret?: string;
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresAt?: number;
  registrationResponse?: Record<string, unknown>;
}

type CredentialsMap = Record<string, StoredCredentials>;

const CREDENTIALS_FILE = path.join(__dirname, "..", "..", "auth-credentials.json");

export class CredentialStorage {
  private async loadAllCredentials(): Promise<CredentialsMap> {
    try {
      const data = await fs.readFile(CREDENTIALS_FILE, "utf-8");
      return JSON.parse(data);
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return {};
      }
      console.error("Failed to load credentials:", error);
      throw error;
    }
  }

  private async saveAllCredentials(credentials: CredentialsMap): Promise<void> {
    try {
      await fs.writeFile(
        CREDENTIALS_FILE,
        JSON.stringify(credentials, null, 2),
        "utf-8"
      );
    } catch (error) {
      console.error("Failed to save credentials:", error);
      throw error;
    }
  }

  async saveCredentials(
    serverId: string,
    credentials: StoredCredentials
  ): Promise<void> {
    const allCredentials = await this.loadAllCredentials();
    allCredentials[serverId] = credentials;
    await this.saveAllCredentials(allCredentials);
  }

  async loadCredentials(serverId: string): Promise<StoredCredentials | null> {
    const allCredentials = await this.loadAllCredentials();
    return allCredentials[serverId] || null;
  }

  async clearCredentials(serverId: string): Promise<void> {
    const allCredentials = await this.loadAllCredentials();
    delete allCredentials[serverId];
    await this.saveAllCredentials(allCredentials);
  }

  async hasValidCredentials(serverId: string): Promise<boolean> {
    const credentials = await this.loadCredentials(serverId);
    if (!credentials) return false;

    // Check if token is expired
    if (credentials.expiresAt && credentials.expiresAt < Date.now()) {
      return false;
    }

    return true;
  }
}
