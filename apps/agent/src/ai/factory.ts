import type { Env } from "../env";
import type { AIProvider } from "./provider";
import { CloudflareWorkersAIProvider } from "./workers-ai";
import { ExternalAIProvider, type SupportedExternalProvider } from "./external-ai";
import { type Settings, FREE_LLM_PROVIDERS } from "@talorys/shared";

export function createAIProvider(
  env: Env,
  settings: Settings,
  override?: { provider?: string | null; model?: string | null },
): AIProvider | null {
  const providerId = (override?.provider || settings.provider || "workers-ai").toLowerCase();
  const catalogEntry = FREE_LLM_PROVIDERS.find((p) => p.id.toLowerCase() === providerId);
  const model = override?.model || settings.model || catalogEntry?.defaultModel || "auto";

  if (providerId === "workers-ai") {
    if (!env.AI) return null;
    const finalModel = (!model || model === "auto") ? "@cf/zai-org/glm-4.7-flash" : model;
    return new CloudflareWorkersAIProvider(env.AI, finalModel);
  }

  let credential: string | undefined = undefined;
  let isOAuth = false;
  let options: { endpoint?: string } | undefined = undefined;

  // Custom endpoint resolution: settings map -> freellmapiEndpoint -> catalog default
  const customEndpoint = settings.externalKeys?.providerEndpoints?.[providerId];
  if (customEndpoint) {
    options = { endpoint: customEndpoint };
  }

  // Named credential checks
  if (providerId === "anthropic") {
    const authMode = settings.externalKeys?.anthropicAuthMode;
    if (authMode === "apikey" && settings.externalKeys?.anthropic) {
      credential = settings.externalKeys.anthropic;
      isOAuth = false;
    } else if (authMode === "oauth" && settings.externalKeys?.anthropicOAuthToken) {
      credential = settings.externalKeys.anthropicOAuthToken;
      isOAuth = true;
    } else if (settings.externalKeys?.anthropic) {
      // Default to standard Anthropic API key if provided
      credential = settings.externalKeys.anthropic;
      isOAuth = false;
    } else if (settings.externalKeys?.anthropicOAuthToken) {
      credential = settings.externalKeys.anthropicOAuthToken;
      isOAuth = true;
    }
  } else if (providerId === "gemini") {
    const authMode = settings.externalKeys?.geminiAuthMode;
    if (authMode === "apikey" && settings.externalKeys?.gemini) {
      credential = settings.externalKeys.gemini;
      isOAuth = false;
    } else if (authMode === "oauth" && settings.externalKeys?.googleOAuthToken) {
      credential = settings.externalKeys.googleOAuthToken;
      isOAuth = true;
    } else if (settings.externalKeys?.gemini) {
      // Default to Google AI Studio API key if provided
      credential = settings.externalKeys.gemini;
      isOAuth = false;
    } else if (settings.externalKeys?.googleOAuthToken) {
      credential = settings.externalKeys.googleOAuthToken;
      isOAuth = true;
    }
  } else if (providerId === "freellmapi") {
    credential = settings.externalKeys?.freellmapiKey || "freellmapi-cloud";
    let ep = settings.externalKeys?.freellmapiEndpoint?.trim();
    if (ep?.startsWith("ttp://")) ep = "http://" + ep.slice(6);
    if (ep?.startsWith("ttps://")) ep = "https://" + ep.slice(7);
    if (ep && !ep.includes("localhost") && !ep.includes("127.0.0.1") && ep.startsWith("http")) {
      options = { endpoint: ep };
    } else {
      options = { endpoint: "https://text.pollinations.ai/openai" };
    }
  } else if (providerId === "pollinations") {
    credential = "anonymous";
    options = { endpoint: "https://text.pollinations.ai/openai" };
  } else if (providerId === "groq") {
    credential = settings.externalKeys?.groqKey || settings.externalKeys?.openai;
  } else if (providerId === "cerebras") {
    credential = settings.externalKeys?.cerebrasKey;
  } else if (providerId === "mistral") {
    credential = settings.externalKeys?.mistralKey;
  } else if (providerId === "openai") {
    credential = settings.externalKeys?.openai;
  } else if (providerId === "openrouter") {
    credential = settings.externalKeys?.openrouter;
  }

  // Check dynamic providerKeys dictionary
  if (!credential && settings.externalKeys?.providerKeys?.[providerId]) {
    credential = settings.externalKeys.providerKeys[providerId];
  }

  // Zero-key providers (Pollinations, Kilo, OVH, LLM7, AI Horde, etc.)
  if (!credential && catalogEntry && !catalogEntry.requiresKey) {
    credential = "anonymous";
  }

  // Default endpoint from catalog if not already set
  if (!options?.endpoint && catalogEntry?.defaultBaseUrl && !catalogEntry.defaultBaseUrl.startsWith("builtin:")) {
    options = { endpoint: catalogEntry.defaultBaseUrl };
  }

  if (!credential) {
    throw new Error(
      `Credential for "${catalogEntry?.name || providerId}" is not configured. Configure it in Settings -> AI & Models to use this provider.`,
    );
  }

  return new ExternalAIProvider(providerId as SupportedExternalProvider, model, credential, isOAuth, options);
}

