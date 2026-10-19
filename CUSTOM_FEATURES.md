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
  - `apps/agent/src/mcp/tools.ts`: Dynamic MCP tool adapter converting MCP schemas to Talorys agent tools with full OpenAPI object compatibility.
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

---

## 5. Behavioral Rules Engine
- **Status**: Active
- **Description**: Categorized, toggleable behavioral rules that are dynamically injected into system prompts across conversations.
- **Key Capabilities**:
  - Categories: `general`, `persona`, `coding`, `writing`, `memory`, `safety`.
  - Individual on/off switches for each rule without having to delete and re-enter them.
  - Built-in starter rule presets ("Concise & Direct", "Code Quality & Modern Standards", "Structured Markdown Output", "Proactive Contextual Memory").
  - Form validation, inline editing, and deletion.
- **Files Touched**:
  - `packages/shared/src/schemas.ts`: `Rule`, `RuleCategory`, `ruleCategorySchema`, `ruleCreateSchema`, `ruleUpdateSchema`.
  - `apps/agent/src/db/migrations.ts`: Migration 12 creating `tal_rules` table.
  - `apps/agent/src/db/repositories/rules.ts`: `RulesRepository` (CRUD, `listActive()`).
  - `apps/agent/src/services/container.ts`: Registered `rules: RulesRepository`.
  - `apps/agent/src/api/routes/rules.ts`: REST CRUD endpoints (`/api/rules`).
  - `apps/agent/src/api/app.ts`: Mounted `/api/rules`.
  - `apps/agent/src/agent/prompt.ts`: Injects active rules into `buildSystemPrompt`.
  - `apps/web/src/components/RulesSettingsCard.tsx`: Full UI card with category filtering, search, toggles, edit modal, and starter presets.
  - `apps/web/src/pages/SettingsPage.tsx`: Added "Rules" settings tab.

---

## 6. Specialized Skills System
- **Status**: Active
- **Description**: Domain playbooks, workflows, and tool affiliations that elevate agent performance for specialized missions.
- **Key Capabilities**:
  - Categories: `general`, `productivity`, `coding`, `research`, `analysis`, `creativity`, `data`, `writing`, `automation`.
  - Multi-line instructions, step-by-step playbooks, and tool affiliation mappings (`tools_json`).
  - Quick-start starter skills ("Deep Research & Knowledge Synthesizer", "Architect & Code Reviewer", "Daily Execution Planner").
  - On/off activation toggles per skill.
- **Files Touched**:
  - `packages/shared/src/schemas.ts`: `Skill`, `SkillCategory`, `skillCategorySchema`, `skillCreateSchema`, `skillUpdateSchema`.
  - `apps/agent/src/db/migrations.ts`: Migration 12 creating `tal_skills` table.
  - `apps/agent/src/db/repositories/skills.ts`: `SkillsRepository` (CRUD, `listActive()`).
  - `apps/agent/src/services/container.ts`: Registered `skills: SkillsRepository`.
  - `apps/agent/src/api/routes/skills.ts`: REST CRUD endpoints (`/api/skills`).
  - `apps/agent/src/api/app.ts`: Mounted `/api/skills`.
  - `apps/agent/src/agent/prompt.ts`: Injects active skills and execution playbooks into `buildSystemPrompt`.
  - `apps/web/src/components/SkillsSettingsCard.tsx`: Full UI card with category filtering, search, instruction previews, tool tags, and edit dialogs.
  - `apps/web/src/pages/SettingsPage.tsx`: Added "Skills" settings tab.

---

## 7. Dynamic Cloudflare Model Selector
- **Status**: Active
- **Description**: Dynamic model discovery and selection tracking Cloudflare's Workers AI text generation model catalog.
- **Key Capabilities**:
  - Real-time model catalog queries via `/api/models/cloudflare`.
  - Optional integration with user's Cloudflare Account ID and API Token for live account model discovery.
  - Tagged model attributes (`recommended`, `tool-calling`, `fast`, `reasoning`, `vision`).
  - Fast filter search and dropdown picker with custom model entry fallback.
- **Files Touched**:
  - `apps/agent/src/api/routes/models.ts`: `/api/models/cloudflare` and `/api/models/presets`.
  - `apps/agent/src/api/app.ts`: Mounted `/api/models`.
  - `apps/web/src/hooks/queries.ts`: `useCloudflareModels()`, `useModelPresets()`.
  - `apps/web/src/components/AiSettingsCard.tsx`: Searchable model dropdown, live refresh button, and badges.

---

## 8. Multi-Provider LLM Engine & Per-Conversation Overrides
- **Status**: Active
- **Description**: Expand beyond Cloudflare Workers AI to use any model from Anthropic Claude, OpenAI, OpenRouter, and Google Gemini.
- **Key Capabilities**:
  - **External LLM Provider Adapter**: Uses official Vercel AI SDK provider packages (`@ai-sdk/anthropic`, `@ai-sdk/google`, `@ai-sdk/openai`) inside Cloudflare Workers with streaming and full tool calling support.
  - **Secure API Key Management**: Keys (`anthropic`, `openai`, `openrouter`, `gemini`, `cloudflareToken`) stored encrypted in durable settings (`externalKeys`). Password visibility toggles in UI.
  - **Global & Per-Conversation Switching**:
    - Global default provider & model configured in Settings.
    - Active conversation override badge in Chat Header (`ConversationModelSwitcher`) to switch models on-the-fly or reset to defaults.
- **Files Touched**:
  - `packages/shared/src/schemas.ts`: `LLMProviderId`, `externalKeysSchema`, `conversationUpdateSchema` with `provider_override` and `model_override`.
  - `apps/agent/package.json`: Added `@ai-sdk/anthropic`, `@ai-sdk/google`, `@ai-sdk/openai`.
  - `apps/agent/src/db/migrations.ts`: Migration 12 adding `provider_override` and `model_override` to `tal_conversations`.
  - `apps/agent/src/db/repositories/conversations.ts`: `updateOverrides()` method.
  - `apps/agent/src/ai/external-ai.ts`: `ExternalAIProvider` supporting Anthropic, OpenAI, OpenRouter, and Gemini with streaming and tool execution.
  - `apps/agent/src/ai/factory.ts`: `createAIProvider` resolver.
  - `apps/agent/src/agent/talorys-agent.ts`: Dynamic AI provider instantiation.
  - `apps/agent/src/agent/runner.ts`: Resolves conversation overrides dynamically per turn.
  - `apps/web/src/components/AiSettingsCard.tsx`: Provider switcher tabs, API key inputs with show/hide eye toggle, preset recommendations.
  - `apps/web/src/pages/ChatPage.tsx`: `ConversationModelSwitcher` in chat header.
