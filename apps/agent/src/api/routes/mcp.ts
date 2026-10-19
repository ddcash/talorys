import { Hono } from "hono";
import { mcpServerCreateSchema, mcpServerUpdateSchema, mcpTestSchema } from "@talorys/shared";
import type { AppEnv } from "../app";
import { body } from "../middleware";
import { McpClient } from "../../mcp/client";

export const mcpRoutes = new Hono<AppEnv>();

/**
 * List all configured MCP servers.
 */
mcpRoutes.get("/servers", (c) => {
  const servers = c.env.agent.services.mcp.list();
  return c.json({ servers });
});

/**
 * Test an MCP connection without saving it first.
 */
mcpRoutes.post("/test", async (c) => {
  const payload = await body(c, mcpTestSchema);
  const result = await McpClient.testConnection(payload.url, payload.auth_token);
  return c.json(result);
});

/**
 * Add a new MCP server and auto-discover tools.
 */
mcpRoutes.post("/servers", async (c) => {
  const payload = await body(c, mcpServerCreateSchema);
  const s = c.env.agent.services;

  // Auto-discover tools if possible
  const testRes = await McpClient.testConnection(payload.url, payload.auth_token);
  const cachedTools = testRes.ok ? testRes.tools : [];

  const server = s.mcp.create({
    name: payload.name,
    url: payload.url,
    auth_token: payload.auth_token,
    enabled: payload.enabled,
    is_memory_provider: payload.is_memory_provider,
    memory_mode: payload.memory_mode,
    cached_tools: cachedTools,
  });

  s.activity.record(
    "mcp.server_added",
    `Added MCP server "${server.name}" (${cachedTools.length} tools discovered)`,
  );

  return c.json({ server }, 201);
});

/**
 * Update an existing MCP server.
 */
mcpRoutes.patch("/servers/:id", async (c) => {
  const id = c.req.param("id");
  const patch = await body(c, mcpServerUpdateSchema);
  const s = c.env.agent.services;

  const server = s.mcp.update(id, patch);
  s.activity.record("mcp.server_updated", `Updated MCP server "${server.name}"`);

  return c.json({ server });
});

/**
 * Refresh tool cache from the remote MCP server.
 */
mcpRoutes.post("/servers/:id/refresh", async (c) => {
  const id = c.req.param("id");
  const s = c.env.agent.services;
  const existing = s.mcp.get(id);
  if (!existing) return c.json({ error: { code: "NOT_FOUND", message: "Server not found" } }, 404);

  const tools = await McpClient.listTools(existing);
  s.mcp.updateCachedTools(id, tools);
  const updated = s.mcp.get(id)!;

  s.activity.record("mcp.tools_refreshed", `Refreshed ${tools.length} tools for "${existing.name}"`);

  return c.json({ server: updated });
});

/**
 * Remove an MCP server.
 */
mcpRoutes.delete("/servers/:id", (c) => {
  const id = c.req.param("id");
  const s = c.env.agent.services;
  const existing = s.mcp.get(id);

  if (existing) {
    s.mcp.delete(id);
    s.activity.record("mcp.server_deleted", `Removed MCP server "${existing.name}"`);
  }

  return c.json({ ok: true });
});
