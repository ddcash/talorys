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

## 10. Claude & Antigravity / Google OAuth Authentication & Interactive Setup Flows
- **Status**: Active
- **Description**: Authenticate Anthropic Claude and Google / Antigravity using OAuth Bearer tokens directly instead of raw API keys, with full guided setup flows.
- **Key Capabilities**:
  - **Interactive OAuth Setup Wizard (`OAuthConnectModal`)**:
    - **Google / Antigravity Web OAuth Flow**: Auto-generates authorization URL with required scopes (`generative-language`, `cloud-platform`, `userinfo.email`), opens Google consent screen, and automatically exchanges the authorization code on return for access & refresh tokens.
    - **Instant CLI Token Importer (No Web App Credentials Required)**: Direct one-line command (`gcloud auth print-access-token` / `antigravity auth token`) with real-time validation via Google tokeninfo API, auto-retrieving user email and expiration countdown.
    - **Automatic Google Refresh Token Handling**: Supports storing `googleRefreshToken`, `googleClientId`, and `googleClientSecret` so tokens can be refreshed automatically without expiring after 1 hour.
    - **Claude Pro Subscription (No API Fees)**: Full support for using your existing **Claude Pro / Team / Max subscription** ($20/mo flat) instead of purchasing pay-per-token API credits. Talorys authenticates via Claude Code OAuth tokens (`sk-ant-oat01-...` generated via `npx @anthropic-ai/claude-code setup-token`), stripping conflicting `x-api-key` headers and injecting required `User-Agent: claude-code/0.2.29` and `anthropic-client: claude-code` headers so Anthropic bills requests to your Claude Pro subscription quota.
    - **Claude Web OAuth & Bearer Token Validator**: Set up custom Anthropic OAuth app with authorized redirect URI, or paste Claude OAuth token with instant verification ping against Anthropic API.
  - **Automatic Browser Callback Handling**: `SettingsPage.tsx` automatically intercepts `?code=...` on redirect, triggers `/api/oauth/google/exchange` or `/api/oauth/claude/exchange`, saves tokens to SQLite settings, shows a success toast, and cleans the browser URL.
  - **OAuth REST Endpoints**:
    - `/api/oauth/status`: Real-time status of connected Google and Claude accounts, token expiry, and refresh capability.
    - `/api/oauth/google/auth-url`: Generates consent URL.
    - `/api/oauth/google/exchange`: Authorization code exchange.
    - `/api/oauth/google/validate-token`: Google tokeninfo validation.
    - `/api/oauth/claude/auth-url`, `/exchange`, `/validate-token`: Claude OAuth flow endpoints with Claude Code validation headers.
    - `/api/oauth/disconnect`: Revokes and clears tokens.
- **Files Touched**:
  - `packages/shared/src/schemas.ts`: Added `anthropicOAuthToken`, `anthropicOAuthRefreshToken`, `anthropicClientId`, `anthropicClientSecret`, `googleOAuthToken`, `googleRefreshToken`, `googleClientId`, `googleClientSecret`, `googleTokenExpiry`, `googleUserEmail`.
  - `apps/agent/src/agent/talorys-agent.ts`: Dynamic AI provider factory integration in `runner()`.
  - `apps/agent/src/ai/external-ai.ts`: Native `authToken` authentication with `anthropic-client: claude-code` and `User-Agent: claude-code/0.2.29` headers.
  - `apps/agent/src/ai/factory.ts`: Automatically initializes OAuth mode when OAuth tokens are present.
  - `apps/agent/src/api/routes/oauth.ts`: Full OAuth flow endpoints.
  - `apps/web/src/hooks/queries.ts`: `keys.oauthStatus`, `useOAuthStatus()`.
  - `apps/web/src/components/OAuthConnectModal.tsx`: Complete tabbed interactive modal wizard for Google/Antigravity and Claude with 1-click Claude Pro token generation instructions and copyable CLI command.
  - `apps/web/src/components/AiSettingsCard.tsx`: Dedicated "Launch OAuth Setup Flow" buttons and connected status displays.
  - `apps/web/src/pages/SettingsPage.tsx`: Automatic OAuth code exchange callback listener.

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

---

## 12. Zero-Cost AI Usage Budgets & Automated Budget Failover
- **Status**: Active
- **Description**: Configurable usage budget guards that intercept outgoing AI requests before any paid usage occurs. If daily request limits, daily token ceilings, or monthly cost budgets are reached, Talorys automatically fails over to configured free backup models without breaking conversation continuity, guaranteeing 100% free usage.
- **Key Capabilities**:
  - **Zero-Cost Budget Guard**: Set `maxMonthlyCostUsd: 0.00` to guarantee that paid model API calls are never made once budget thresholds are approached.
  - **Daily Limits Enforcement**: Enforce custom thresholds on daily requests (`maxDailyRequests`) and daily tokens (`maxDailyTokens`).
  - **Free-Tier Only Mode**: Option (`freeTierOnly: true`) that restricts execution solely to zero-cost free-tier models (Workers AI free tier, FreeLLMAPI pool, Groq LPU free tier, Cerebras Wafer-Scale free tier, Mistral free tier).
  - **Pre-Execution Budget Interceptor**: Evaluates today's usage from `UsageService` before dispatching to any provider. If a threshold is reached, seamlessly streams an alert notification (`*[Budget Notice: Daily budget reached. Failing over to free backup <model>...]*`) and invokes the next free fallback candidate.
  - **Workers AI Daily Limit Detection**: Catches Workers AI daily quota limits and automatically pivots to backup free providers rather than throwing an error.
  - **UI Budget Management**: Visual card in Settings with toggle switches, limit inputs, real-time feedback, and a "Zero-Cost Guarantee: $0.00 / month" indicator badge.
- **Files Touched**:
  - `packages/shared/src/schemas.ts`: Added `aiBudgetSchema`, `AiBudget`, updated `settingsSchema` and `settingsUpdateSchema`.
  - `apps/agent/src/services/settings.ts`: Added default `budget` configuration, persistence in `get()` and `update()`.
  - `apps/agent/src/agent/runner.ts`: Injected pre-execution budget evaluator and seamless failover mechanism.
  - `apps/web/src/components/AiSettingsCard.tsx`: Added "Zero-Cost AI Usage Budgets & Failover Guards" interface with switches and inputs.

---

## 13. FreeLLMAPI Aggregator & 54 Ecosystem Free Providers
- **Status**: Active
- **Description**: Comprehensive integration with FreeLLMAPI (aggregating 34 free providers and 635 models) and native support for all 54 ecosystem AI providers and free tiers, operating with automated failover and unified persistent memory.
- **Key Capabilities**:
  - **All 54 Ecosystem Providers Supported**:
    - **Zero-Key Instant Free (No API Key Required)**: Pollinations, Kilo Gateway, OVH AI Endpoints, LLM7, AI Horde.
    - **High-Performance Free Tiers**: Groq LPUs (250–800 t/s), Cerebras Wafer-Scale (2,100+ t/s), NVIDIA NIM, Mistral Free Tier, Google AI Studio, GitHub Models, Cohere, Cloudflare Workers AI.
    - **Credit & Community Free Routers**: FreeLLMAPI Unified Router (7.4B tokens/mo), OpenRouter (:free models), ACLIDE, Sail Research, ElectronHub, Experiential Labs, Router9, Septor Labs, CLōD, Speechify, BlazeAPI, Lucidity Composite, Api.Airforce, DreamPrompting, Waterfall, Logfare, B.AI, AMD Radeon Cloud.
    - **Developer Free-Key Gateways**: HuggingFace Router, OpenCode Zen, Agnes AI, Reka, SiliconFlow, Routeway, BazaarLink, AINative Studio, Aion Labs, Requesty, NavyAI, NaraRouter, OrcaRouter, UnoRouter, xKiro, AnyAPI, Ollama.
    - **Regional & International Free Tiers**: SEA-LION, Zhipu AI (GLM-4 Flash free tier), ModelScope, Baidu Qianfan, Volcengine Ark, LongCat, iFlytek Spark.
  - **Free Providers Directory UI**: Visual interactive catalog in Settings with category filter tabs (Zero-Key, High-Speed, Credit Routers, Dev Free-Key, Regional), instant "Use as Primary", "+ Fallback", and inline custom API Key / endpoint URL editors.
  - **Zero-Key Instant Free Execution**: Providers with `requiresKey: false` automatically use anonymous bearer authentication so you can chat immediately with zero configuration.
  - **Extensible Fallback & Failover Chaining**: Any of the 54 providers can be added to the automatic failover execution chain with priority drag-and-drop ordering.
  - **Unified Persistent Memory & Persona Continuity**: Regardless of which model or provider executes a turn (Workers AI, FreeLLMAPI, Groq, Cerebras, Pollinations, NVIDIA NIM, Claude, Gemini):
    - Long-term memory notes from Cloudflare Inkstone MCP
    - Durable Object SQLite facts and activity logs
    - Custom rules and skills from the marketplace
    - Complete conversation history
    - Enforced unified persona prompt clause ensuring seamless continuity across all interactions.
  - **Per-Conversation Model Selection**: Freely switch conversations between FreeLLMAPI, Groq, Cerebras, Mistral, Pollinations, Cloudflare, and major providers using the chat model switcher.
- **Files Touched**:
  - `packages/shared/src/providers-catalog.ts`: Complete structured metadata for all 54 ecosystem providers.
  - `packages/shared/src/schemas.ts`: Updated `llmProviderSchema` and `externalKeysSchema` with `providerKeys` and `providerEndpoints` maps.
  - `apps/agent/src/ai/external-ai.ts`: Dynamic OpenAI-compatible resolution for any provider in the 54-provider catalog.
  - `apps/agent/src/ai/factory.ts`: Automatic credential resolution with anonymous fallback for zero-key providers.
  - `apps/agent/src/api/routes/models.ts`: Added `/models/providers` endpoint and presets for zero-key, NVIDIA, GitHub Models, and SiliconFlow.
  - `apps/web/src/components/AiSettingsCard.tsx`: Complete Free AI Providers Directory with search, filters, inline config, and fallback optgroups.
  - `apps/web/src/pages/ChatPage.tsx`: Grouped provider options in conversation model switcher.

---

## 14. Per-Chat AI Model Selection & Instant Model Switching
- **Status**: Active
- **Description**: Full ability to choose and switch the AI model and provider for each chat independently — both when starting a new conversation and dynamically mid-conversation in existing chats.
- **Key Capabilities**:
  - **New Chat Model Pre-Selection**: Pick which model will answer before typing your first message. Starting a new chat (`/chat`) displays the active model switcher; any selected model is automatically saved as the conversation's model override on turn 1.
  - **Dynamic Mid-Conversation Switching**: Change models on the fly in any existing conversation (e.g., start on Llama 3.3 for quick chatting, switch to Claude 3.7 Sonnet for complex coding, or switch to DeepSeek R1 for reasoning). Changes save immediately via `PATCH /conversations/:id` and apply to subsequent messages.
  - **Dual-Access UI (Header & Composer Toolbar)**:
    - **Header Pill Button**: Clickable model selector pill next to chat usage in the header (`ChatHeader`).
    - **Composer Toolbar Button**: Clickable model badge directly inside the message input box container next to the send button (`Composer`), so you always see exactly which model is answering you.
  - **1-Click Quick-Select Presets**: Grid of top popular models with instant 1-click selection:
    - 🟣 **Claude 3.7 Sonnet** (`anthropic: claude-3-7-sonnet-20250219`)
    - 🟣 **Claude 3.5 Sonnet** (`anthropic: claude-3-5-sonnet-20241022`)
    - 🔵 **Gemini 2.0 Flash** (`gemini: gemini-2.0-flash`)
    - 🔵 **Gemini 2.5 Pro** (`gemini: gemini-2.5-pro`)
    - 🟠 **Workers AI Llama 3.3 70B** (`workers-ai: @cf/meta/llama-3.3-70b-instruct-fp8-fast`)
    - 🟢 **DeepSeek R1 Distill** (`workers-ai: @cf/deepseek-ai/deepseek-r1-distill-qwen-32b`)
    - 🟣 **Groq Llama 3.3 70B** (`groq: llama-3.3-70b-versatile`)
    - 🌐 **FreeLLMAPI Auto Router** (`freellmapi: freellmapi/auto`)
  - **Comprehensive 54-Provider Dropdown & Custom Model Input**: Switch between any of the 54 ecosystem providers or type custom model identifiers.
  - **Reset to Default**: Easily revert any conversation override back to the global inherited default settings with one click.
- **Files Touched**:
  - `packages/shared/src/schemas.ts`: Updated `conversationCreateSchema` and `chatRequestSchema` with `provider` and `model` overrides.
  - `apps/agent/src/db/repositories/conversations.ts`: Added overrides support in `create(title, overrides)`.
  - `apps/agent/src/agent/runner.ts`: `TurnInput` supports `provider` and `model`, applying overrides during conversation creation and turn execution.
  - `apps/agent/src/api/routes/chat.ts`: Passed `provider` and `model` in `POST /conversations` and `POST /chat`.
  - `apps/web/src/lib/api.ts`: `streamChat` payload supports optional `provider` and `model`.
  - `apps/web/src/pages/ChatPage.tsx`: Enhanced `ConversationModelSwitcher`, updated `ChatHeader` and `Composer` with per-chat model selection.

