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

  const externalKey = settings.externalKeys?.[providerId as keyof typeof settings.externalKeys];
  if (!externalKey) {
    throw new Error(
      `API key for "${providerId}" is not configured. Add your API key in Settings -> AI & Models to use this provider.`,
    );
  }

  return new ExternalAIProvider(providerId as SupportedExternalProvider, model, externalKey);
}
