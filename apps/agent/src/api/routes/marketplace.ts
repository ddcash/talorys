import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app";
import { body } from "../middleware";
import type { MarketplaceMcp, MarketplaceSkill, MarketplaceRule } from "@talorys/shared";

export const MARKETPLACE_MCPS: MarketplaceMcp[] = [
  {
    id: "inkstone",
    name: "Inkstone Knowledge Base",
    author: "Cloudflare",
    description: "Serverless long-term memory and knowledge base running on Cloudflare Workers and Vectorize.",
    category: "memory",
    default_url: "https://inkstone-cf.r-cash88.workers.dev/mcp",
    needs_auth: false,
    tags: ["memory", "knowledge", "cloudflare", "vectorize"],
    documentation_url: "https://github.com/ddcash/inkstone",
  },
  {
    id: "github",
    name: "GitHub Official MCP",
    author: "Model Context Protocol",
    description: "Search repositories, read code, view issues, inspect pull requests, and commit changes.",
    category: "developer",
    default_url: "https://api.githubcopilot.com/mcp",
    needs_auth: true,
    auth_hint: "Personal Access Token (classic or fine-grained with repo scope)",
    tags: ["git", "code", "github", "issues", "pr"],
    documentation_url: "https://github.com/modelcontextprotocol/servers/tree/main/src/github",
  },
  {
    id: "brave-search",
    name: "Brave Search",
    author: "Brave Software",
    description: "Real-time web search and local business queries via the Brave Search API.",
    category: "search",
    default_url: "https://api.search.brave.com/mcp",
    needs_auth: true,
    auth_hint: "Brave Search API Key from api.search.brave.com",
    tags: ["search", "web", "news"],
    documentation_url: "https://github.com/modelcontextprotocol/servers/tree/main/src/brave-search",
  },
  {
    id: "fetch",
    name: "Fetch Web Scraper",
    author: "Model Context Protocol",
    description: "Converts any public web page into clean markdown for reading and analysis.",
    category: "search",
    default_url: "https://fetch.mcp.run",
    needs_auth: false,
    tags: ["web", "scrape", "markdown", "reader"],
    documentation_url: "https://github.com/modelcontextprotocol/servers/tree/main/src/fetch",
  },
  {
    id: "postgres",
    name: "PostgreSQL Inspector",
    author: "Model Context Protocol",
    description: "Read-only database querying, schema introspection, and performance analysis.",
    category: "database",
    default_url: "http://localhost:5433/mcp",
    needs_auth: true,
    auth_hint: "Postgres connection string or server bearer token",
    tags: ["sql", "postgres", "database"],
    documentation_url: "https://github.com/modelcontextprotocol/servers/tree/main/src/postgres",
  },
  {
    id: "memory",
    name: "Knowledge Graph Memory",
    author: "Model Context Protocol",
    description: "Graph-based persistent memory organizing entities, relations, and observations.",
    category: "memory",
    default_url: "https://memory.mcp.run",
    needs_auth: false,
    tags: ["memory", "graph", "relations"],
    documentation_url: "https://github.com/modelcontextprotocol/servers/tree/main/src/memory",
  },
  {
    id: "cloudflare-bindings",
    name: "Cloudflare Developer Platform",
    author: "Cloudflare",
    description: "Inspect Workers, KV namespaces, D1 databases, R2 buckets, and Hyperdrive configs.",
    category: "developer",
    default_url: "https://api.cloudflare.com/client/v4/mcp",
    needs_auth: true,
    auth_hint: "Cloudflare API Token with Workers & Storage read permissions",
    tags: ["cloudflare", "workers", "d1", "r2", "kv"],
    documentation_url: "https://developers.cloudflare.com/workers-ai/",
  },
  {
    id: "slack",
    name: "Slack Workspace Connector",
    author: "Model Context Protocol",
    description: "Search Slack workspace history, read public channels, and view user threads.",
    category: "productivity",
    default_url: "https://slack.mcp.run",
    needs_auth: true,
    auth_hint: "Slack Bot User OAuth Token (xoxb-...)",
    tags: ["chat", "slack", "team", "collaboration"],
    documentation_url: "https://github.com/modelcontextprotocol/servers/tree/main/src/slack",
  },
];

export const MARKETPLACE_SKILLS: MarketplaceSkill[] = [
  {
    id: "appsec-auditor",
    name: "Application Security & Vulnerability Auditor",
    author: "Agency Security",
    category: "coding",
    description: "Hunts hardcoded secrets, injection sinks, broken access controls, and unsafe dependencies.",
    instructions:
      "When reviewing code or investigating systems:\n1. Threat Model: Map trust boundaries and user-controlled inputs.\n2. Vulnerability Hunt: Check for OWASP Top 10, CWE-79 (XSS), CWE-89 (SQLi), CWE-94 (Code Injection).\n3. Row-Level & Secret Checks: Verify no secrets or credentials appear in repo files.\n4. Deliver findings mapped to CWEs with remediation diffs.",
    tools_json: JSON.stringify(["code_review", "security_scan"]),
    tags: ["security", "audit", "owasp", "cwe"],
  },
  {
    id: "cloud-architect",
    name: "Cloud Security & Zero-Trust Architect",
    author: "Agency Cloud",
    category: "coding",
    description: "Designs resilient, least-privilege cloud architectures on Cloudflare, AWS, and GCP.",
    instructions:
      "When designing or reviewing cloud architectures:\n1. Apply Zero-Trust principles: verify explicitly, least-privilege access, assume breach.\n2. Infrastructure as Code: prefer declarative configs and immutable deployments.\n3. Data Protection: encrypt in transit and at rest, manage key rotation, isolate databases.",
    tools_json: JSON.stringify(["cloud_audit"]),
    tags: ["cloud", "architecture", "zero-trust", "cloudflare"],
  },
  {
    id: "deep-researcher",
    name: "Deep Intelligence & Knowledge Synthesizer",
    author: "Research Labs",
    category: "research",
    description: "Exhaustively queries internal knowledge bases, memories, notes, and external MCP tools.",
    instructions:
      "When researching an inquiry:\n1. Query all connected knowledge sources and memories first.\n2. Cross-reference facts across notes and search tools.\n3. Synthesize structured findings with citations and confidence levels.\n4. Propose durable insights to store in memory.",
    tools_json: JSON.stringify(["semantic_search", "notes_search", "mcp:*"]),
    tags: ["research", "synthesis", "memory", "facts"],
  },
  {
    id: "product-manager",
    name: "Product Strategist & Roadmapper",
    author: "Product Guild",
    category: "productivity",
    description: "Transforms user goals into crisp PRDs, user stories, milestone roadmaps, and acceptance criteria.",
    instructions:
      "When helping plan product features:\n1. Define user problem, hypothesis, and expected outcome.\n2. Write user stories with Given/When/Then acceptance criteria.\n3. Prioritize by impact vs effort (MoSCoW or RICE).\n4. Convert action items into tasks with projects and due dates.",
    tools_json: JSON.stringify(["tasks_create", "projects_create"]),
    tags: ["product", "strategy", "roadmap", "user-stories"],
  },
  {
    id: "incident-responder",
    name: "Incident Response & Forensics Specialist",
    author: "SecOps",
    category: "coding",
    description: "Coordinates breach response, identifies IOCs, preserves evidence, and authors post-mortems.",
    instructions:
      "When handling an operational or security incident:\n1. Establish timeline: identify first indicator of compromise (IOC).\n2. Containment: isolate affected services or revoked tokens.\n3. Root Cause Analysis: trace how access was gained.\n4. Author clear post-mortem with preventative actions.",
    tools_json: JSON.stringify(["audit_log"]),
    tags: ["secops", "incident", "forensics", "postmortem"],
  },
  {
    id: "technical-writer",
    name: "Technical Documentation Specialist",
    author: "DocOps",
    category: "writing",
    description: "Writes world-class API references, architecture decision records (ADRs), and developer guides.",
    instructions:
      "When authoring documentation:\n1. Structure with executive overview, prerequisite diagram, and runnable code samples.\n2. Keep prose active, precise, and unambiguous.\n3. Format tables for options/parameters and callouts for critical warnings.",
    tools_json: JSON.stringify(["notes_create"]),
    tags: ["documentation", "writing", "adr", "api"],
  },
];

export const MARKETPLACE_RULES: MarketplaceRule[] = [
  {
    id: "concise-high-signal",
    title: "Concise & High-Signal Persona",
    author: "Talorys Core",
    category: "persona",
    description: "Get straight to the answer with zero pleasantries, preamble, or boilerplate.",
    content: "Be direct, concise, and focused. Do not start replies with filler phrases, pleasantries, or apologies. Deliver the solution immediately with high signal density.",
    tags: ["persona", "concise", "direct"],
  },
  {
    id: "strict-modern-typescript",
    title: "Strict Modern TypeScript & Clean Code",
    author: "TypeScript Standards",
    category: "coding",
    description: "Clean, strictly-typed modern code with zero `any` and minimal boilerplate.",
    content: "Always write strictly-typed modern TypeScript. Never use `any` unless strictly unavoidable; prefer explicit unions, generics, or `unknown` with type guards. Follow single-responsibility principles and minimize unnecessary dependencies.",
    tags: ["coding", "typescript", "clean-code"],
  },
  {
    id: "owasp-secure-coding",
    title: "Defensive Coding & OWASP Guidelines",
    author: "AppSec Guidelines",
    category: "safety",
    description: "Prevents injection, validates all input boundaries, and secures credentials.",
    content: "Always apply defensive coding practices: sanitize and validate all external inputs with strict schemas (e.g. Zod). Use parameterized queries for databases. Never hardcode credentials, secrets, or API keys in code.",
    tags: ["safety", "security", "owasp"],
  },
  {
    id: "structured-markdown-formatting",
    title: "Structured Markdown & Data Tables",
    author: "Design Systems",
    category: "writing",
    description: "Formats complex responses with clean headers, bullet points, and comparison tables.",
    content: "Format complex or multi-faceted replies using GitHub-flavored markdown. Use clear section headers (`##`, `###`), concise bullet lists, and tables when comparing options, specifications, or benchmarks.",
    tags: ["writing", "markdown", "tables"],
  },
  {
    id: "proactive-memory-habits",
    title: "Proactive Preference & Memory Tracking",
    author: "Agentic Memory",
    category: "memory",
    description: "Remembers firm preferences and active project goals without having to be asked.",
    content: "Pay attention to user workflow preferences, favorite tools, and coding style habits. Whenever a firm preference or ongoing project goal is stated, remember it or incorporate it into future recommendations.",
    tags: ["memory", "preferences", "context"],
  },
  {
    id: "socratic-problem-solving",
    title: "Socratic First-Principles Discovery",
    author: "System Thinking",
    category: "general",
    description: "Asks clarifying questions to expose assumptions and uncover root causes.",
    content: "When analyzing complex design decisions or ambiguous requirements, briefly articulate key tradeoffs and ask 1-2 targeted questions to clarify the user's primary constraints before proposing deep solutions.",
    tags: ["general", "socratic", "discovery"],
  },
];

export const marketplaceRoutes = new Hono<AppEnv>();

marketplaceRoutes.get("/marketplace/mcp", (c) => {
  return c.json({ servers: MARKETPLACE_MCPS });
});

marketplaceRoutes.get("/marketplace/skills", (c) => {
  return c.json({ skills: MARKETPLACE_SKILLS });
});

marketplaceRoutes.get("/marketplace/rules", (c) => {
  return c.json({ rules: MARKETPLACE_RULES });
});

/** 1-Click Install an MCP from the marketplace */
marketplaceRoutes.post("/marketplace/install/mcp", async (c) => {
  const { id, auth_token, url_override } = await body(
    c,
    z.object({
      id: z.string().min(1),
      auth_token: z.string().nullable().optional(),
      url_override: z.string().url().optional(),
    }),
  );

  const template = MARKETPLACE_MCPS.find((m) => m.id === id);
  if (!template) return c.json({ error: "Marketplace item not found" }, 404);

  const server = c.env.agent.services.mcp.create({
    name: template.name,
    url: url_override || template.default_url,
    auth_token: auth_token ?? null,
    enabled: true,
    is_memory_provider: template.category === "memory",
    memory_mode: template.category === "memory" ? "optimized" : "all_tools",
  });

  return c.json({ installed: true, server }, 201);
});

/** 1-Click Install a Skill from the marketplace */
marketplaceRoutes.post("/marketplace/install/skill", async (c) => {
  const { id } = await body(c, z.object({ id: z.string().min(1) }));
  const template = MARKETPLACE_SKILLS.find((s) => s.id === id);
  if (!template) return c.json({ error: "Marketplace item not found" }, 404);

  const skill = c.env.agent.services.skills.create({
    name: template.name,
    description: template.description,
    instructions: template.instructions,
    tools_json: template.tools_json,
    category: template.category,
    enabled: true,
  });

  return c.json({ installed: true, skill }, 201);
});

/** 1-Click Install a Rule from the marketplace */
marketplaceRoutes.post("/marketplace/install/rule", async (c) => {
  const { id } = await body(c, z.object({ id: z.string().min(1) }));
  const template = MARKETPLACE_RULES.find((r) => r.id === id);
  if (!template) return c.json({ error: "Marketplace item not found" }, 404);

  const rule = c.env.agent.services.rules.create({
    title: template.title,
    content: template.content,
    category: template.category,
    enabled: true,
  });

  return c.json({ installed: true, rule }, 201);
});
