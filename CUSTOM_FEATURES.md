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

---

## 9. Curated Marketplaces: MCP Servers, Skills, & Rules
- **Status**: Active
- **Description**: Integrated one-click installation marketplaces pulling from reputable sources across the ecosystem (Anthropic/official MCP servers, Cloudflare, Agency security playbooks, OWASP guidelines, and modern coding standards).
- **Key Capabilities**:
  - **Reputable MCP Marketplace**:
    - **Cloudflare Inkstone**: Native long-term memory worker for notes & retrieval.
    - **GitHub Official MCP**: Repository exploration, PR reviews, issues, and git search.
    - **Brave Search**: Real-time web index queries with privacy preservation.
    - **Fetch Web Scraper**: Converts web pages directly into clean Markdown.
    - **PostgreSQL Inspector**: Read-only schema introspection and query analysis.
    - **Knowledge Graph Memory**: Graph-structured persistent entity and relation memory.
    - **Cloudflare Developer Platform**: Worker deployments, D1 databases, and KV access.
    - **Slack Workspace Connector**: Public channel queries and team thread search.
  - **Verified Skills Marketplace**:
    - **Application Security & Vulnerability Auditor**: Hunts injection sinks, hardcoded credentials, and CWE vulnerabilities.
    - **Cloud Security & Zero-Trust Architect**: Least-privilege architectures, IaC validation, and boundary reviews.
    - **Deep Intelligence & Knowledge Synthesizer**: Cross-references notes, memories, and MCP queries.
    - **Product Strategist & Roadmapper**: Transforms goals into PRDs, user stories, and actionable tasks.
    - **Incident Response & Forensics Specialist**: IOC containment, audit log review, and post-mortems.
    - **Technical Documentation Specialist**: ADRs, architecture diagrams, and developer documentation.
  - **Battle-Tested Rules Marketplace**:
    - **Concise & High-Signal Persona**: Zero filler phrases or boilerplate pleasantries.
    - **Strict Modern TypeScript & Clean Code**: Strictly-typed patterns without `any`.
    - **Defensive Coding & OWASP Guidelines**: Strict input sanitization and credential protection.
    - **Structured Markdown & Visual Output**: Clear hierarchy, tables, callouts, and code diffs.
    - **Proactive Contextual Memory Recall**: Proactively references habits and project context.
    - **Socratic Clarification & Discovery**: Clarifies ambiguous goals before broad executions.
  - **One-Click Installation**: Full UI modal with instant installation directly into Durable Object SQLite storage (`tal_mcp_servers`, `tal_skills`, `tal_rules`).
- **Files Touched**:
  - `packages/shared/src/schemas.ts`: `MarketplaceMcp`, `MarketplaceSkill`, `MarketplaceRule`.
  - `apps/agent/src/api/routes/marketplace.ts`: Catalog endpoints (`/api/marketplace/mcp`, `/skills`, `/rules`) and 1-click install (`/install/mcp`, `/install/skill`, `/install/rule`).
  - `apps/agent/src/api/app.ts`: Mounted `/api/marketplace`.
  - `apps/web/src/hooks/queries.ts`: `useMarketplaceMcp()`, `useMarketplaceSkills()`, `useMarketplaceRules()`.
  - `apps/web/src/components/MarketplaceDialog.tsx`: Full-featured tabbed modal dialog with category badges and one-click install buttons.
  - `apps/web/src/components/McpSettingsCard.tsx`, `SkillsSettingsCard.tsx`, `RulesSettingsCard.tsx`: Integrated Marketplace launch buttons.

---

## 10. Claude & Antigravity / Google OAuth Authentication (No API Key Required)
- **Status**: Active
- **Description**: Authenticate Anthropic Claude and Google / Antigravity using OAuth Bearer tokens directly instead of raw API keys.
- **Key Capabilities**:
  - **Claude OAuth Authentication**: Passes OAuth bearer token in `Authorization: Bearer <token>` with `anthropic-version: 2023-06-01` headers without requiring raw API keys.
  - **Antigravity / Google Cloud OAuth**: Passes OAuth access token (`ya29...` or bearer token) in `Authorization: Bearer <token>` to Google's generative AI models without an AI Studio API key.
  - **UI Auth Mode Switcher**: Easily toggle between "API Key" and "OAuth Token" modes for Claude and Antigravity, with live "OAuth Connected" status badges and Disconnect buttons.
  - **OAuth REST Endpoints**: `/api/oauth/token` and `/api/oauth/disconnect` for programmatic token management.
- **Files Touched**:
  - `packages/shared/src/schemas.ts`: Added `anthropicOAuthToken`, `googleOAuthToken`, and `googleRefreshToken` to `externalKeysSchema`.
  - `apps/agent/src/ai/external-ai.ts`: `isOAuth` mode setting `Authorization: Bearer <token>` headers.
  - `apps/agent/src/ai/factory.ts`: Automatically initializes OAuth mode when OAuth tokens are present.
  - `apps/agent/src/api/routes/oauth.ts`: OAuth token validation, storage, and revocation endpoints.
  - `apps/agent/src/api/app.ts`: Mounted `/api/oauth`.
  - `apps/web/src/components/AiSettingsCard.tsx`: Dedicated OAuth toggle cards with connection status indicators and token management.

---

## 11. Multi-AI Provider Automatic Failover & Redundancy Chain
- **Status**: Active
- **Description**: Configure multiple backup AI models and providers. When your primary model runs out of usage, hits rate limits (HTTP 429), or faces provider downtime, Talorys automatically switches seamlessly to your next configured provider in the fallback chain without dropping your conversation.
- **Key Capabilities**:
  - **Execution Fallback Chain**: Define an ordered sequence of backup providers (e.g. Primary: Anthropic Claude 3.7 Sonnet -> Fallback 1: Cloudflare Llama 3.3 70B -> Fallback 2: Google Gemini 2.0 Flash).
  - **Automatic Rate Limit & Quota Recovery**: Detects rate limits (`429`), quota exhaustion (`insufficient_quota`), network errors, or provider outages, seamlessly streaming a brief notice (`*[Notice: <provider> quota/rate limit reached. Failing over to <fallback>...]*`) before delivering the response using the fallback model.
  - **Auto-Failover Toggle**: Enable or disable automatic failover globally in Settings (`autoFailover`).
  - **UI Chain Manager**: Drag/move fallbacks up or down, delete backups, or add new providers with instant preset selection in `AiSettingsCard.tsx`.
- **Files Touched**:
  - `packages/shared/src/schemas.ts`: `fallbackProviderSchema`, `FallbackProvider`, updated `settingsSchema` and `settingsUpdateSchema`.
  - `apps/agent/src/services/settings.ts`: Default settings (`fallbacks: []`, `autoFailover: true`), get and update handlers.
  - `apps/agent/src/agent/runner.ts`: Automatic fallback failover loop with live transition yield and candidate chaining.
  - `apps/web/src/components/AiSettingsCard.tsx`: Complete failover chain UI manager with priority ordering, move controls, and fallback creation.
