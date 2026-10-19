# Talorys Custom Features Inventory

This inventory tracks all custom capabilities, enhancements, and architectural extensions added to this fork beyond upstream (`https://github.com/rociiu/talorys`).

Whenever upstream changes are merged, refer to this document to audit, preserve, or re-apply custom capabilities.

---

## 1. Model Context Protocol (MCP) Integration
- **Status**: Active
- **Description**: Enables Talorys to connect to remote Model Context Protocol (MCP) servers over HTTP with JSON-RPC 2.0 and Server-Sent Events (SSE).
- **Files Touched**:
  - `packages/shared/src/schemas.ts`: Added `McpServer`, `McpToolSummary`, schemas (`mcpServerCreateSchema`, `mcpServerUpdateSchema`, `mcpTestSchema`).
  - `apps/agent/src/db/migrations.ts`: Migration 11 adding `tal_mcp_servers` table in Durable Object SQLite.
  - `apps/agent/src/db/repositories/mcp.ts`: `McpRepository` CRUD for MCP servers.
  - `apps/agent/src/services/container.ts`: Registered `mcp: McpRepository` in `Services`.
  - `apps/agent/src/mcp/client.ts`: Dual-transport MCP client (`Accept: application/json, text/event-stream`), tool invocation, SSE / JSON parser, and connection tester.
  - `apps/agent/src/mcp/tools.ts`: Dynamic MCP tool adapter converting MCP schemas to Talorys agent tools.
  - `apps/agent/src/api/routes/mcp.ts`: REST endpoints (`/api/mcp/servers`, `/api/mcp/test`, `/api/mcp/servers/:id/refresh`).
  - `apps/agent/src/api/app.ts`: Mounted `/api/mcp`.
  - `apps/agent/src/agent/runner.ts`: Registers dynamic MCP tools during turn execution.

---

## 2. Cloudflare Inkstone Long-Term Memory Integration
- **Status**: Active
- **Description**: Uses user's deployed Cloudflare worker (`inkstone-cf`) as a persistent knowledge and memory base.
- **Key Capabilities**:
  - Automatically queries Inkstone for relevant notes based on user prompts.
  - Injects top note excerpts into prompt context before model turn execution.
  - **Free-Tier Guardrails**:
    - Limits context injection to <= 1,000 characters (saving context tokens).
    - Exposes only core note search & creation tools in `optimized` mode (saving subrequests and prompt bloat).
- **Files Touched**:
  - `apps/agent/src/mcp/client.ts` (`recallFromInkstone`)
  - `apps/agent/src/mcp/tools.ts` (`buildMcpTools`)
  - `apps/agent/src/agent/runner.ts` (`runTurn`)

---

## 3. Web UI: Integrations Management Tab
- **Status**: Active
- **Description**: UI controls for managing external integrations and MCP servers.
- **Key Capabilities**:
  - "Quick Connect Inkstone" one-click preset configuration.
  - Test connection button with real-time tool discovery feedback.
  - Switches for "Set as Active Memory System" and "Free-Tier Optimized Mode".
  - Expandable tool preview list showing all cached tools and descriptions.
- **Files Touched**:
  - `apps/web/src/hooks/queries.ts`: `keys.mcpServers`, `useMcpServers`.
  - `apps/web/src/pages/SettingsPage.tsx`: Added "Integrations" tab.
  - `apps/web/src/components/McpSettingsCard.tsx`: Full settings card UI.

---

## 4. Web Content Security Policy (CSP) Customization
- **Status**: Active
- **Description**: Permits `'unsafe-eval'` and Cloudflare insights scripts needed for client-side queries and dashboard analytics without security violations.
- **Files Touched**:
  - `apps/web/public/_headers`
