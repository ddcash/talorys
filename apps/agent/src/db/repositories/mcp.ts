import type { McpServer, McpToolSummary } from "@talorys/shared";
import { type Database, newId, now } from "../database";
import { NotFoundError } from "../../api/errors";

interface McpServerRow {
  id: string;
  name: string;
  url: string;
  auth_token: string | null;
  enabled: number;
  is_memory_provider: number;
  memory_mode: "optimized" | "all_tools";
  cached_tools: string;
  tools_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

function rowToEntity(r: McpServerRow): McpServer {
  let cached_tools: McpToolSummary[] = [];
  try {
    const parsed = JSON.parse(r.cached_tools);
    if (Array.isArray(parsed)) cached_tools = parsed;
  } catch {
    cached_tools = [];
  }
  return {
    id: r.id,
    name: r.name,
    url: r.url,
    auth_token: r.auth_token,
    enabled: Boolean(r.enabled),
    is_memory_provider: Boolean(r.is_memory_provider),
    memory_mode: r.memory_mode === "all_tools" ? "all_tools" : "optimized",
    cached_tools,
    tools_updated_at: r.tools_updated_at,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export class McpRepository {
  constructor(private readonly db: Database) {}

  list(): McpServer[] {
    const rows = this.db.all<McpServerRow>("SELECT * FROM tal_mcp_servers ORDER BY created_at ASC");
    return rows.map(rowToEntity);
  }

  listEnabled(): McpServer[] {
    const rows = this.db.all<McpServerRow>("SELECT * FROM tal_mcp_servers WHERE enabled = 1 ORDER BY created_at ASC");
    return rows.map(rowToEntity);
  }

  get(id: string): McpServer | null {
    const row = this.db.one<McpServerRow>("SELECT * FROM tal_mcp_servers WHERE id = ?", id);
    return row ? rowToEntity(row) : null;
  }

  getMemoryProvider(): McpServer | null {
    const row = this.db.one<McpServerRow>(
      "SELECT * FROM tal_mcp_servers WHERE enabled = 1 AND is_memory_provider = 1 LIMIT 1",
    );
    return row ? rowToEntity(row) : null;
  }

  create(input: {
    name: string;
    url: string;
    auth_token?: string | null;
    enabled?: boolean;
    is_memory_provider?: boolean;
    memory_mode?: "optimized" | "all_tools";
    cached_tools?: McpToolSummary[];
  }): McpServer {
    const id = newId();
    const timestamp = now();
    const cached = input.cached_tools ? JSON.stringify(input.cached_tools) : "[]";
    const toolsUpdatedAt = input.cached_tools ? timestamp : null;

    // If setting as memory provider, unset any existing memory providers
    if (input.is_memory_provider) {
      this.db.run("UPDATE tal_mcp_servers SET is_memory_provider = 0");
    }

    this.db.run(
      `INSERT INTO tal_mcp_servers (
        id, name, url, auth_token, enabled, is_memory_provider, memory_mode, cached_tools, tools_updated_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      input.name,
      input.url,
      input.auth_token ?? null,
      input.enabled !== false ? 1 : 0,
      input.is_memory_provider ? 1 : 0,
      input.memory_mode === "all_tools" ? "all_tools" : "optimized",
      cached,
      toolsUpdatedAt,
      timestamp,
      timestamp,
    );

    return this.get(id)!;
  }

  update(
    id: string,
    patch: Partial<{
      name: string;
      url: string;
      auth_token: string | null;
      enabled: boolean;
      is_memory_provider: boolean;
      memory_mode: "optimized" | "all_tools";
      cached_tools: McpToolSummary[];
    }>,
  ): McpServer {
    const existing = this.get(id);
    if (!existing) throw new NotFoundError("MCP server not found");

    if (patch.is_memory_provider) {
      this.db.run("UPDATE tal_mcp_servers SET is_memory_provider = 0 WHERE id != ?", id);
    }

    const sets: string[] = ["updated_at = ?"];
    const params: unknown[] = [now()];

    if (patch.name !== undefined) {
      sets.push("name = ?");
      params.push(patch.name);
    }
    if (patch.url !== undefined) {
      sets.push("url = ?");
      params.push(patch.url);
    }
    if (patch.auth_token !== undefined) {
      sets.push("auth_token = ?");
      params.push(patch.auth_token);
    }
    if (patch.enabled !== undefined) {
      sets.push("enabled = ?");
      params.push(patch.enabled ? 1 : 0);
    }
    if (patch.is_memory_provider !== undefined) {
      sets.push("is_memory_provider = ?");
      params.push(patch.is_memory_provider ? 1 : 0);
    }
    if (patch.memory_mode !== undefined) {
      sets.push("memory_mode = ?");
      params.push(patch.memory_mode);
    }
    if (patch.cached_tools !== undefined) {
      sets.push("cached_tools = ?");
      sets.push("tools_updated_at = ?");
      params.push(JSON.stringify(patch.cached_tools));
      params.push(now());
    }

    params.push(id);
    this.db.run(`UPDATE tal_mcp_servers SET ${sets.join(", ")} WHERE id = ?`, ...params);
    return this.get(id)!;
  }

  updateCachedTools(id: string, tools: McpToolSummary[]): void {
    this.db.run(
      "UPDATE tal_mcp_servers SET cached_tools = ?, tools_updated_at = ?, updated_at = ? WHERE id = ?",
      JSON.stringify(tools),
      now(),
      now(),
      id,
    );
  }

  delete(id: string): void {
    const existing = this.get(id);
    if (!existing) throw new NotFoundError("MCP server not found");
    this.db.run("DELETE FROM tal_mcp_servers WHERE id = ?", id);
  }
}
