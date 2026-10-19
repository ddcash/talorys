import { z } from "zod";
import type { McpServer, McpToolSummary } from "@talorys/shared";
import { defineTool, type ToolDefinition } from "../tools/registry";
import { McpClient } from "./client";

/**
 * Sanitizes tool names to conform to AI tool calling standards [a-zA-Z0-9_-].
 */
function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
}

/**
 * Core Inkstone tools prioritized for free-tier memory optimization.
 */
const INKSTONE_OPTIMIZED_TOOLS = new Set([
  "search",
  "fetch",
  "read_note",
  "create_note",
  "edit_note",
]);

/**
 * Converts MCP tools from configured servers into Talorys ToolDefinitions.
 */
export function buildMcpTools(server: McpServer): ToolDefinition[] {
  const tools: ToolDefinition[] = [];
  const sourceTools: McpToolSummary[] = server.cached_tools ?? [];

  const isInkstone = sourceTools.some((t) => t.name === "search" || t.name === "create_note");

  for (const tool of sourceTools) {
    // If optimized memory mode is enabled, only expose key memory tools to prevent token bloat
    if (server.memory_mode === "optimized" && isInkstone && !INKSTONE_OPTIMIZED_TOOLS.has(tool.name)) {
      continue;
    }

    const toolPrefix = isInkstone ? "inkstone" : `mcp_${sanitizeName(server.name)}`;
    const registeredName = `${toolPrefix}_${sanitizeName(tool.name)}`;

    const def = defineTool({
      name: registeredName,
      description: `[${server.name}] ${tool.description || `Tool ${tool.name}`}`,
      input: z.record(z.string(), z.unknown()).passthrough(),
      permission: "write",
      label: () => `Running ${server.name} tool "${tool.name}"`,
      execute: async (input) => {
        // Automatically inject operation_id for idempotent Inkstone writes if not supplied
        const args: Record<string, unknown> = { ...(input as Record<string, unknown>) };
        if (isInkstone && (tool.name === "create_note" || tool.name === "edit_note") && !args.operation_id) {
          args.operation_id = crypto.randomUUID();
        }

        return McpClient.callTool(server, tool.name, args);
      },
    });

    tools.push(def);
  }

  return tools;
}

/**
 * Gathers all tools from all enabled MCP servers.
 */
export function getAllMcpTools(servers: McpServer[]): ToolDefinition[] {
  return servers.filter((s) => s.enabled).flatMap(buildMcpTools);
}
