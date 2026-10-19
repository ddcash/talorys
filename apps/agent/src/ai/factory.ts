import type { Env } from "../env";
import type { AIProvider } from "./provider";
import { CloudflareWorkersAIProvider } from "./workers-ai";
import { ExternalAIProvider, type SupportedExternalProvider } from "./external-ai";
import type { Settings } from "@talorys/shared";

export function createAIProvider(
  env: Env,
  settings: Settings,
  override?: { provider?: string | null; model?: string | null },
): AIProvider | null {
  const providerId = (override?.provider || settings.provider || "workers-ai").toLowerCase();
  const model = override?.model || settings.model;

  if (providerId === "workers-ai") {
    if (!env.AI) return null;
    return new CloudflareWorkersAIProvider(env.AI, model);
  }

  let credential = settings.externalKeys?.[providerId as keyof typeof settings.externalKeys];
  let isOAuth = false;
  let options: { endpoint?: string } | undefined = undefined;

  if (providerId === "anthropic") {
    if (settings.externalKeys?.anthropicOAuthToken) {
      credential = settings.externalKeys.anthropicOAuthToken;
      isOAuth = true;
    }
  } else if (providerId === "gemini") {
    if (settings.externalKeys?.googleOAuthToken) {
      credential = settings.externalKeys.googleOAuthToken;
      isOAuth = true;
    }
  } else if (providerId === "freellmapi") {
    credential = settings.externalKeys?.freellmapiKey || "freellmapi-local";
    options = { endpoint: settings.externalKeys?.freellmapiEndpoint || "http://localhost:3001/v1" };
  } else if (providerId === "groq") {
    credential = settings.externalKeys?.groqKey || settings.externalKeys?.openai;
  } else if (providerId === "cerebras") {
    credential = settings.externalKeys?.cerebrasKey;
  } else if (providerId === "mistral") {
    credential = settings.externalKeys?.mistralKey;
  }

  if (!credential) {
    throw new Error(
      `Credential for "${providerId}" is not configured. Configure it in Settings -> AI & Models to use this provider.`,
    );
  }

  return new ExternalAIProvider(providerId as SupportedExternalProvider, model, credential, isOAuth, options);
}
