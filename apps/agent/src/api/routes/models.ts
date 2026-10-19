import { Hono } from "hono";
import type { AppEnv } from "../app";
import { FREE_LLM_PROVIDERS } from "@talorys/shared";

export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  provider: string;
  context_length?: number;
  tags?: string[];
  recommended?: boolean;
}

const DEFAULT_CLOUDFLARE_MODELS: ModelInfo[] = [
  {
    id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    name: "Llama 3.3 70B Instruct (FP8 Fast)",
    description: "Meta's flagship 70B model optimized for fast inference with tool calling support.",
    provider: "cloudflare",
    tags: ["recommended", "tool-calling", "fast", "general"],
    recommended: true,
  },
  {
    id: "@cf/meta/llama-3.1-70b-instruct",
    name: "Llama 3.1 70B Instruct",
    description: "High-capability open model with 128k context and function calling.",
    provider: "cloudflare",
    tags: ["tool-calling", "general"],
  },
  {
    id: "@cf/meta/llama-3.1-8b-instruct",
    name: "Llama 3.1 8B Instruct",
    description: "Fast, efficient 8B model suitable for daily assistance and rapid responses.",
    provider: "cloudflare",
    tags: ["fast", "tool-calling"],
  },
  {
    id: "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
    name: "DeepSeek R1 Distill Qwen 32B",
    description: "Advanced reasoning model with chain-of-thought capabilities.",
    provider: "cloudflare",
    tags: ["reasoning", "coding", "math"],
  },
  {
    id: "@cf/meta/llama-3.2-3b-instruct",
    name: "Llama 3.2 3B Instruct",
    description: "Compact and ultra-low latency model for simple tasks.",
    provider: "cloudflare",
    tags: ["fast", "lightweight"],
  },
  {
    id: "@cf/meta/llama-3.2-11b-vision-instruct",
    name: "Llama 3.2 11B Vision Instruct",
    description: "Multimodal text and image understanding model.",
    provider: "cloudflare",
    tags: ["vision", "multimodal"],
  },
  {
    id: "@cf/qwen/qwen2.5-7b-instruct",
    name: "Qwen 2.5 7B Instruct",
    description: "Excellent multilingual and coding capabilities from Alibaba Cloud.",
    provider: "cloudflare",
    tags: ["coding", "multilingual"],
  },
  {
    id: "@cf/mistral/mistral-7b-instruct-v0.2",
    name: "Mistral 7B Instruct v0.2",
    description: "Balanced general-purpose 7B model.",
    provider: "cloudflare",
    tags: ["general"],
  },
  {
    id: "@cf/google/gemma-7b-it",
    name: "Google Gemma 7B IT",
    description: "Lightweight open model trained on Google technology.",
    provider: "cloudflare",
    tags: ["general"],
  },
];

const PRESET_MODELS: Record<string, ModelInfo[]> = {
  cloudflare: DEFAULT_CLOUDFLARE_MODELS,
  anthropic: [
    {
      id: "claude-3-7-sonnet-20250219",
      name: "Claude 3.7 Sonnet",
      description: "Hybrid reasoning model capable of standard chat and extended thinking.",
      provider: "anthropic",
      tags: ["recommended", "reasoning", "coding", "tool-calling"],
      recommended: true,
    },
    {
      id: "claude-3-5-sonnet-20241022",
      name: "Claude 3.5 Sonnet",
      description: "Industry-leading intelligence for coding, analysis, and nuance.",
      provider: "anthropic",
      tags: ["coding", "analysis", "tool-calling"],
    },
    {
      id: "claude-3-5-haiku-20241022",
      name: "Claude 3.5 Haiku",
      description: "Lightning-fast model with near Sonnet-level speed and responsiveness.",
      provider: "anthropic",
      tags: ["fast", "tool-calling"],
    },
  ],
  openai: [
    {
      id: "gpt-4o",
      name: "GPT-4o",
      description: "OpenAI flagship omni model for multimodal understanding and complex tasks.",
      provider: "openai",
      tags: ["recommended", "tool-calling", "general"],
      recommended: true,
    },
    {
      id: "gpt-4o-mini",
      name: "GPT-4o Mini",
      description: "Fast, cost-efficient model for lightweight daily tasks.",
      provider: "openai",
      tags: ["fast", "tool-calling"],
    },
    {
      id: "o3-mini",
      name: "o3-mini",
      description: "High-speed reasoning model specialized in STEM, coding, and math.",
      provider: "openai",
      tags: ["reasoning", "coding", "math"],
    },
  ],
  openrouter: [
    {
      id: "anthropic/claude-3.7-sonnet",
      name: "Claude 3.7 Sonnet (via OpenRouter)",
      description: "Access Anthropic Claude 3.7 Sonnet via OpenRouter gateway.",
      provider: "openrouter",
      tags: ["recommended", "reasoning", "coding"],
      recommended: true,
    },
    {
      id: "openai/gpt-4o",
      name: "GPT-4o (via OpenRouter)",
      description: "Access OpenAI GPT-4o via OpenRouter gateway.",
      provider: "openrouter",
      tags: ["general", "tool-calling"],
    },
    {
      id: "deepseek/deepseek-r1",
      name: "DeepSeek R1 (via OpenRouter)",
      description: "Open reasoning model with chain-of-thought capabilities.",
      provider: "openrouter",
      tags: ["reasoning", "math", "coding"],
    },
    {
      id: "google/gemini-2.0-flash-001",
      name: "Gemini 2.0 Flash (via OpenRouter)",
      description: "Next-gen low-latency multimodal model.",
      provider: "openrouter",
      tags: ["fast", "multimodal"],
    },
    {
      id: "meta-llama/llama-3.3-70b-instruct",
      name: "Llama 3.3 70B (via OpenRouter)",
      description: "Meta open-weights flagship via high-throughput providers.",
      provider: "openrouter",
      tags: ["general"],
    },
  ],
  google: [
    {
      id: "gemini-2.0-flash",
      name: "Gemini 2.0 Flash",
      description: "Ultra-fast multimodal model with comprehensive tool support.",
      provider: "google",
      tags: ["recommended", "fast", "multimodal", "tool-calling"],
      recommended: true,
    },
    {
      id: "gemini-2.5-pro",
      name: "Gemini 2.5 Pro",
      description: "State-of-the-art model for complex logic, coding, and deep reasoning.",
      provider: "google",
      tags: ["reasoning", "coding", "tool-calling"],
    },
    {
      id: "gemini-1.5-pro",
      name: "Gemini 1.5 Pro",
      description: "Massive 2M token context window model for deep document analysis.",
      provider: "google",
      tags: ["large-context", "analysis"],
    },
    {
      id: "gemini-1.5-flash",
      name: "Gemini 1.5 Flash",
      description: "Lightweight, highly capable everyday model.",
      provider: "google",
      tags: ["fast", "general"],
    },
  ],
  freellmapi: [
    {
      id: "freellmapi/auto",
      name: "FreeLLMAPI Auto Router (Best Free Model)",
      description: "Automatically routes requests across 34 free providers and 635 models based on capability and speed.",
      provider: "freellmapi",
      tags: ["recommended", "free", "router", "auto-failover"],
      recommended: true,
    },
    {
      id: "freellmapi/fusion",
      name: "FreeLLMAPI Virtual Fusion (Multi-Model Consensus)",
      description: "Fans out prompts to multiple free models in parallel and synthesizes a single consensus answer.",
      provider: "freellmapi",
      tags: ["free", "fusion", "reasoning"],
    },
    {
      id: "gemini-2.0-flash",
      name: "Gemini 2.0 Flash (FreeLLMAPI Free Tier)",
      description: "Google Gemini 2.0 Flash via FreeLLMAPI free pool.",
      provider: "freellmapi",
      tags: ["free", "fast", "multimodal"],
    },
    {
      id: "llama-3.3-70b-versatile",
      name: "Llama 3.3 70B (FreeLLMAPI)",
      description: "Meta 70B high-reasoning model via FreeLLMAPI free allocation.",
      provider: "freellmapi",
      tags: ["free", "general", "tool-calling"],
    },
    {
      id: "deepseek-chat",
      name: "DeepSeek V3 (FreeLLMAPI)",
      description: "DeepSeek general and coding model via FreeLLMAPI.",
      provider: "freellmapi",
      tags: ["free", "coding"],
    },
  ],
  groq: [
    {
      id: "llama-3.3-70b-versatile",
      name: "Llama 3.3 70B Versatile",
      description: "Free high-speed 70B model running at ~250 tokens/sec on Groq LPUs.",
      provider: "groq",
      tags: ["recommended", "free", "fast", "tool-calling"],
      recommended: true,
    },
    {
      id: "llama-3.1-8b-instant",
      name: "Llama 3.1 8B Instant",
      description: "Ultra-low latency 8B model running at ~800 tokens/sec on Groq.",
      provider: "groq",
      tags: ["free", "ultra-fast"],
    },
    {
      id: "mixtral-8x7b-32768",
      name: "Mixtral 8x7B (32k context)",
      description: "Mistral MoE architecture model with 32k context on Groq free tier.",
      provider: "groq",
      tags: ["free", "moe"],
    },
  ],
  cerebras: [
    {
      id: "llama-3.3-70b",
      name: "Llama 3.3 70B",
      description: "World-record 2,100+ tokens/sec inference speed on Cerebras Wafer-Scale Engine.",
      provider: "cerebras",
      tags: ["recommended", "free", "ultra-fast"],
      recommended: true,
    },
    {
      id: "llama-3.1-8b",
      name: "Llama 3.1 8B",
      description: "2,800+ tokens/sec instantaneous inference speed on Cerebras free tier.",
      provider: "cerebras",
      tags: ["free", "ultra-fast"],
    },
  ],
  mistral: [
    {
      id: "mistral-small-latest",
      name: "Mistral Small Latest",
      description: "Mistral's cost-effective general intelligence model on free tier.",
      provider: "mistral",
      tags: ["recommended", "free", "general"],
      recommended: true,
    },
    {
      id: "codestral-latest",
      name: "Codestral 22B",
      description: "Mistral's specialized coding model for software engineering.",
      provider: "mistral",
      tags: ["free", "coding"],
    },
  ],
  pollinations: [
    {
      id: "openai",
      name: "Pollinations OpenAI (Zero Key)",
      description: "Instant 100% free AI model, requires no API key or account.",
      provider: "pollinations",
      tags: ["recommended", "free", "zero-key"],
      recommended: true,
    },
    {
      id: "mistral",
      name: "Pollinations Mistral (Zero Key)",
      description: "Fast free Mistral model with zero authentication required.",
      provider: "pollinations",
      tags: ["free", "zero-key"],
    },
    {
      id: "deepseek",
      name: "Pollinations DeepSeek (Zero Key)",
      description: "DeepSeek reasoning model accessible with zero credentials.",
      provider: "pollinations",
      tags: ["free", "reasoning", "zero-key"],
    },
  ],
  nvidia: [
    {
      id: "meta/llama-3.3-70b-instruct",
      name: "NVIDIA NIM Llama 3.3 70B",
      description: "High-performance inference microservice with free developer credits.",
      provider: "nvidia",
      tags: ["recommended", "free", "fast"],
      recommended: true,
    },
    {
      id: "nvidia/llama-3.1-nemotron-70b-instruct",
      name: "Nemotron 70B Instruct",
      description: "NVIDIA's customized high-reasoning model optimized for alignment.",
      provider: "nvidia",
      tags: ["free", "reasoning"],
    },
  ],
  "github-models": [
    {
      id: "gpt-4o",
      name: "GitHub Models GPT-4o",
      description: "Free developer playground access to GPT-4o via GitHub Personal Access Token.",
      provider: "github-models",
      tags: ["recommended", "free", "multimodal"],
      recommended: true,
    },
    {
      id: "gpt-4o-mini",
      name: "GitHub Models GPT-4o-mini",
      description: "Fast and lightweight GPT-4o model via GitHub Models.",
      provider: "github-models",
      tags: ["free", "fast"],
    },
  ],
  siliconflow: [
    {
      id: "deepseek-ai/DeepSeek-V3",
      name: "DeepSeek V3 (SiliconFlow)",
      description: "Free SiliconCloud tier for DeepSeek V3 general intelligence.",
      provider: "siliconflow",
      tags: ["recommended", "free", "coding"],
      recommended: true,
    },
    {
      id: "deepseek-ai/DeepSeek-R1",
      name: "DeepSeek R1 (SiliconFlow)",
      description: "Full chain-of-thought open reasoning model on SiliconCloud.",
      provider: "siliconflow",
      tags: ["free", "reasoning"],
    },
  ],
  zhipu: [
    {
      id: "glm-4-flash",
      name: "GLM-4 Flash (Z.ai)",
      description: "Completely free ultra-fast Chinese/English bilingual foundation model.",
      provider: "zhipu",
      tags: ["recommended", "free", "fast"],
      recommended: true,
    },
  ],
};

export const modelsRoutes = new Hono<AppEnv>();

/**
 * Dynamically queries Cloudflare Workers AI models if Cloudflare API credentials are configured,
 * falling back to the curated catalog if not configured or on network error.
 */
modelsRoutes.get("/models/cloudflare", async (c) => {
  const settings = c.env.agent.services.settings.get();
  const cfToken = settings.externalKeys?.cloudflareToken;
  const cfAccount = settings.externalKeys?.cloudflareAccountId;

  if (cfToken && cfAccount) {
    try {
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${cfAccount}/ai/models/search?task=Text%20Generation&per_page=100`,
        {
          headers: {
            Authorization: `Bearer ${cfToken}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (res.ok) {
        const data = (await res.json()) as {
          result?: Array<{ id: string; name: string; description?: string }>;
        };
        if (data.result && Array.isArray(data.result) && data.result.length > 0) {
          const dynamicModels: ModelInfo[] = data.result.map((m) => {
            const isRec = m.id.includes("llama-3.3-70b-instruct-fp8-fast");
            const tags: string[] = [];
            if (isRec) tags.push("recommended");
            if (m.id.includes("fast")) tags.push("fast");
            if (m.id.includes("r1") || m.id.includes("reasoning")) tags.push("reasoning");
            if (m.id.includes("vision")) tags.push("vision");
            if (m.id.includes("llama-3.1") || m.id.includes("llama-3.3")) tags.push("tool-calling");

            return {
              id: m.id,
              name: m.name || m.id,
              description: m.description,
              provider: "cloudflare",
              tags,
              recommended: isRec,
            };
          });
          return c.json({ models: dynamicModels, source: "cloudflare-live" });
        }
      }
    } catch {
      // Fallback below
    }
  }

  return c.json({ models: DEFAULT_CLOUDFLARE_MODELS, source: "curated" });
});

/**
 * Returns available preset models across all supported providers.
 */
modelsRoutes.get("/models/presets", (c) => {
  return c.json({ presets: PRESET_MODELS });
});

/**
 * Returns the full catalog of 54 supported free AI providers from FreeLLMAPI.
 */
modelsRoutes.get("/models/providers", (c) => {
  return c.json({ providers: FREE_LLM_PROVIDERS });
});

