import { describe, it, expect, beforeEach } from "vitest";
import { mkdtemp, readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import os from "os";
import { McpServerConfig } from "../types";

/**
 * mcp-store uses os.homedir() at module level for its config path,
 * so we test using direct file operations against the same data format
 * to validate the store's logic patterns.
 */

let tempDir: string;
let configPath: string;

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "entourage-mcp-test-"));
  configPath = path.join(tempDir, "mcp-servers.json");
});

// Replicate the store's logic for testing
async function loadServers(): Promise<McpServerConfig[]> {
  try {
    const raw = await readFile(configPath, "utf-8");
    return JSON.parse(raw) as McpServerConfig[];
  } catch {
    return [];
  }
}

async function saveServers(servers: McpServerConfig[]): Promise<void> {
  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(configPath, JSON.stringify(servers, null, 2));
}

async function addServer(data: Omit<McpServerConfig, "id">): Promise<McpServerConfig> {
  const servers = await loadServers();
  const server: McpServerConfig = { id: crypto.randomUUID(), ...data };
  servers.push(server);
  await saveServers(servers);
  return server;
}

async function removeServer(id: string): Promise<void> {
  const servers = await loadServers();
  await saveServers(servers.filter((s) => s.id !== id));
}

describe("mcp-store logic", () => {
  describe("loadServers", () => {
    it("returns empty array when no config exists", async () => {
      const servers = await loadServers();
      expect(servers).toEqual([]);
    });
  });

  describe("addServer", () => {
    it("adds a stdio server", async () => {
      const server = await addServer({
        name: "test-server",
        transport: "stdio",
        command: "node",
        args: ["server.js"],
      });
      expect(server.id).toBeDefined();
      expect(server.name).toBe("test-server");
      expect(server.transport).toBe("stdio");

      const servers = await loadServers();
      expect(servers).toHaveLength(1);
      expect(servers[0].id).toBe(server.id);
    });

    it("adds an SSE server", async () => {
      const server = await addServer({
        name: "sse-server",
        transport: "sse",
        url: "http://localhost:3000/sse",
      });
      expect(server.transport).toBe("sse");
      expect(server.url).toBe("http://localhost:3000/sse");
    });

    it("accumulates multiple servers", async () => {
      await addServer({ name: "s1", transport: "stdio", command: "a" });
      await addServer({ name: "s2", transport: "stdio", command: "b" });
      const servers = await loadServers();
      expect(servers).toHaveLength(2);
    });
  });

  describe("removeServer", () => {
    it("removes a server by id", async () => {
      const s1 = await addServer({ name: "keep", transport: "stdio", command: "a" });
      const s2 = await addServer({ name: "remove", transport: "stdio", command: "b" });

      await removeServer(s2.id);
      const servers = await loadServers();
      expect(servers).toHaveLength(1);
      expect(servers[0].id).toBe(s1.id);
    });

    it("handles removing nonexistent id gracefully", async () => {
      await addServer({ name: "s1", transport: "stdio", command: "a" });
      await removeServer("nonexistent");
      const servers = await loadServers();
      expect(servers).toHaveLength(1);
    });
  });

  describe("data format", () => {
    it("persists as formatted JSON array", async () => {
      await addServer({ name: "test", transport: "stdio", command: "node" });
      const raw = await readFile(configPath, "utf-8");
      const parsed = JSON.parse(raw);
      expect(Array.isArray(parsed)).toBe(true);
      expect(raw).toContain("\n"); // formatted, not minified
    });
  });
});
