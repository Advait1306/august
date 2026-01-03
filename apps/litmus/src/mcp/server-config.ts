import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type TransportType = "stdio" | "streamable-http" | "sse";

export interface StdioTransportConfig {
  type: "stdio";
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface StreamableHTTPTransportConfig {
  type: "streamable-http";
  url: string;
  headers?: Record<string, string>;
  requiresAuth?: boolean;
  authType?: "oauth2" | "bearer";
  clientId?: string;
  clientSecret?: string;
}

export interface SSETransportConfig {
  type: "sse";
  url: string;
  headers?: Record<string, string>;
  requiresAuth?: boolean;
  authType?: "oauth2" | "bearer";
  clientId?: string;
  clientSecret?: string;
}

export type TransportConfig =
  | StdioTransportConfig
  | StreamableHTTPTransportConfig
  | SSETransportConfig;

export interface ServerConfig {
  id: string;
  name: string;
  description?: string;
  transport: TransportConfig;
  createdAt: number;
  lastUsed?: number;
}

const CONFIG_FILE = path.join(__dirname, "..", "..", "mcp-servers.json");

export class ServerConfigManager {
  private servers: Map<string, ServerConfig> = new Map();

  async load(): Promise<void> {
    try {
      const data = await fs.readFile(CONFIG_FILE, "utf-8");
      const configs: ServerConfig[] = JSON.parse(data);
      this.servers = new Map(configs.map((config) => [config.id, config]));
    } catch {
      this.servers = new Map();
    }
  }

  async save(): Promise<void> {
    const configs = Array.from(this.servers.values());
    await fs.writeFile(CONFIG_FILE, JSON.stringify(configs, null, 2), "utf-8");
  }

  async addServer(
    config: Omit<ServerConfig, "id" | "createdAt">
  ): Promise<ServerConfig> {
    const id = this.generateId();
    const serverConfig: ServerConfig = {
      ...config,
      id,
      createdAt: Date.now(),
    };
    this.servers.set(id, serverConfig);
    await this.save();
    return serverConfig;
  }

  async updateServer(
    id: string,
    updates: Partial<ServerConfig>
  ): Promise<ServerConfig | null> {
    const server = this.servers.get(id);
    if (!server) {
      return null;
    }
    const updated = { ...server, ...updates, id };
    this.servers.set(id, updated);
    await this.save();
    return updated;
  }

  async removeServer(id: string): Promise<boolean> {
    const deleted = this.servers.delete(id);
    if (deleted) {
      await this.save();
    }
    return deleted;
  }

  getServer(id: string): ServerConfig | null {
    return this.servers.get(id) || null;
  }

  getAllServers(): ServerConfig[] {
    return Array.from(this.servers.values()).sort((a, b) => {
      if (a.lastUsed && b.lastUsed) {
        return b.lastUsed - a.lastUsed;
      }
      if (a.lastUsed) return -1;
      if (b.lastUsed) return 1;
      return b.createdAt - a.createdAt;
    });
  }

  async markAsUsed(id: string): Promise<void> {
    const server = this.servers.get(id);
    if (server) {
      server.lastUsed = Date.now();
      await this.save();
    }
  }

  private generateId(): string {
    return `srv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
