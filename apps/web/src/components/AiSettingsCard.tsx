import { useState } from "react";
import type { FallbackProvider, LLMProviderId, Limits, Settings } from "@talorys/shared";
import { LIMIT_CEILINGS } from "@talorys/shared";
import {
  ArrowDown,
  ArrowUp,
  Brain,
  Check,
  ChevronDown,
  Cloud,
  ExternalLink,
  Eye,
  EyeOff,
  Key,
  Lock,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";
import { Badge, Button, Card, Input, Spinner, Switch } from "./ui";
import {
  useCloudflareModels,
  useModelPresets,
  type ModelOption,
} from "../hooks/queries";
import { cn } from "../lib/utils";
import { OAuthConnectModal } from "./OAuthConnectModal";

interface ProviderDef {
  id: LLMProviderId;
  name: string;
  badge: string;
  description: string;
  keyName?: "anthropic" | "openai" | "openrouter" | "gemini";
  keyLabel?: string;
  keyPlaceholder?: string;
  docsUrl?: string;
  supportsOAuth?: boolean;
  oauthLabel?: string;
  oauthHint?: string;
}

const DEFAULT_PROVIDER_INFO: ProviderDef = {
  id: "workers-ai",
  name: "Cloudflare Workers AI",
  badge: "Native / Free-tier",
  description: "Built-in serverless inference running directly on Cloudflare's global GPU network.",
};

const PROVIDERS: ProviderDef[] = [
  DEFAULT_PROVIDER_INFO,
  {
    id: "anthropic",
    name: "Anthropic Claude",
    badge: "Direct API & OAuth",
    description: "Industry-leading reasoning with Claude 3.7 Sonnet, 3.5 Sonnet, and 3.5 Haiku.",
    keyName: "anthropic",
    keyLabel: "Anthropic API Key",
    keyPlaceholder: "sk-ant-...",
    docsUrl: "https://console.anthropic.com/settings/keys",
    supportsOAuth: true,
    oauthLabel: "Claude OAuth Bearer Token",
    oauthHint: "Authenticate Claude using an OAuth token without an API key (Authorization: Bearer <token>).",
  },
  {
    id: "gemini",
    name: "Google / Antigravity",
    badge: "Direct API & OAuth",
    description: "High-speed multimodal intelligence with Gemini 2.0 Flash, Gemini 2.5 Pro, and Antigravity.",
    keyName: "gemini",
    keyLabel: "Google Gemini API Key",
    keyPlaceholder: "AIzaSy...",
    docsUrl: "https://aistudio.google.com/app/apikey",
    supportsOAuth: true,
    oauthLabel: "Antigravity / Google OAuth Token",
    oauthHint: "Authenticate Antigravity or Google Cloud via OAuth token (ya29... or access token) without an API key.",
  },
  {
    id: "openai",
    name: "OpenAI",
    badge: "Direct API",
    description: "Advanced intelligence with GPT-4o, GPT-4o Mini, and o3-mini reasoning models.",
    keyName: "openai",
    keyLabel: "OpenAI API Key",
    keyPlaceholder: "sk-proj-...",
    docsUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    badge: "Unified Gateway",
    description: "Access any model across Anthropic, OpenAI, Meta, DeepSeek, and Mistral through a single key.",
    keyName: "openrouter",
    keyLabel: "OpenRouter API Key",
    keyPlaceholder: "sk-or-v1-...",
    docsUrl: "https://openrouter.ai/keys",
  },
];

const LIMIT_FIELDS: { key: keyof Limits; label: string; hint: string }[] = [
  { key: "maxOutputTokens", label: "Max output tokens", hint: "Upper bound for each AI reply." },
  { key: "maxContextTokens", label: "Max context tokens", hint: "Recent history sent to the model." },
  { key: "maxToolCalls", label: "Max tool calls per request", hint: "0 disables tools entirely." },
  { key: "maxAgentIterations", label: "Max reasoning steps", hint: "Model round-trips per request." },
  { key: "maxAiRequestsPerDay", label: "Max AI requests per day", hint: "Daily cap enforced by Talorys." },
  { key: "maxScheduledAiRunsPerDay", label: "Max scheduled AI runs per day", hint: "Budget for scheduled routines." },
];

export function AiSettingsCard({
  settings,
  onSave,
  isPending,
}: {
  settings: Settings;
  onSave: (patch: Partial<Settings>) => void;
  isPending: boolean;
}) {
  const currentProvider: LLMProviderId = settings.provider ?? "workers-ai";
  const [provider, setProvider] = useState<LLMProviderId>(currentProvider);
  const [model, setModel] = useState(settings.model);
  const [temperature, setTemperature] = useState(settings.temperature);
  const [limits, setLimits] = useState<Limits>(settings.limits);
  const [externalKeys, setExternalKeys] = useState(settings.externalKeys ?? {});
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});

  // Auth Mode Toggles (API Key vs OAuth)
  const [anthropicAuthMode, setAnthropicAuthMode] = useState<"apikey" | "oauth">(
    settings.externalKeys?.anthropicOAuthToken ? "oauth" : "apikey"
  );
  const [geminiAuthMode, setGeminiAuthMode] = useState<"apikey" | "oauth">(
    settings.externalKeys?.googleOAuthToken ? "oauth" : "apikey"
  );

  // OAuth Modal State
  const [oauthModalOpen, setOauthModalOpen] = useState(false);
  const [oauthModalProvider, setOauthModalProvider] = useState<"gemini" | "anthropic">("gemini");

  // Multi-Provider Failover State
  const [fallbacks, setFallbacks] = useState<FallbackProvider[]>(settings.fallbacks ?? []);
  const [autoFailover, setAutoFailover] = useState<boolean>(settings.autoFailover ?? true);
  const [newFallbackProvider, setNewFallbackProvider] = useState<LLMProviderId>("workers-ai");
  const [newFallbackModel, setNewFallbackModel] = useState<string>("@cf/meta/llama-3.3-70b-instruct-fp8-fast");

  // Dynamic Models queries
  const cfModels = useCloudflareModels();
  const presets = useModelPresets();
  const [cfSearch, setCfSearch] = useState("");
  const [showCfDropdown, setShowCfDropdown] = useState(false);

  const activeProviderInfo: ProviderDef = PROVIDERS.find((p) => p.id === provider) ?? DEFAULT_PROVIDER_INFO;

  const handleProviderSelect = (newProvider: LLMProviderId) => {
    setProvider(newProvider);
    if (newProvider === "workers-ai") {
      if (!model.startsWith("@cf/")) setModel("@cf/meta/llama-3.3-70b-instruct-fp8-fast");
    } else if (newProvider === "anthropic") {
      if (!model.startsWith("claude-")) setModel("claude-3-7-sonnet-20250219");
    } else if (newProvider === "openai") {
      if (!model.startsWith("gpt-") && !model.startsWith("o")) setModel("gpt-4o");
    } else if (newProvider === "openrouter") {
      if (!model.includes("/")) setModel("anthropic/claude-3.7-sonnet");
    } else if (newProvider === "gemini") {
      if (!model.startsWith("gemini-")) setModel("gemini-2.0-flash");
    }
  };

  const handleAddFallback = () => {
    if (!newFallbackModel.trim()) return;
    setFallbacks((prev) => [
      ...prev,
      { provider: newFallbackProvider, model: newFallbackModel.trim() },
    ]);
  };

  const handleRemoveFallback = (index: number) => {
    setFallbacks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMoveFallback = (index: number, direction: "up" | "down") => {
    setFallbacks((prev) => {
      const copy = [...prev];
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= copy.length) return prev;
      const current = copy[index];
      const target = copy[targetIndex];
      if (!current || !target) return prev;
      copy[index] = target;
      copy[targetIndex] = current;
      return copy;
    });
  };

  const handleSaveAll = () => {
    onSave({
      provider,
      model: model.trim(),
      temperature,
      limits,
      externalKeys,
      fallbacks,
      autoFailover,
    });
  };

  const isDirty =
    provider !== currentProvider ||
    model !== settings.model ||
    temperature !== settings.temperature ||
    JSON.stringify(limits) !== JSON.stringify(settings.limits) ||
    JSON.stringify(externalKeys) !== JSON.stringify(settings.externalKeys ?? {}) ||
    JSON.stringify(fallbacks) !== JSON.stringify(settings.fallbacks ?? []) ||
    autoFailover !== (settings.autoFailover ?? true);

  const availableCfModels = cfModels.data?.models ?? [];
  const filteredCfModels = availableCfModels.filter((m) => {
    if (!cfSearch) return true;
    const q = cfSearch.toLowerCase();
    return m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q);
  });

  const presetKey = provider === "workers-ai" ? "cloudflare" : provider === "gemini" ? "google" : provider;
  const availablePresets = presets.data?.[presetKey] ?? [];

  return (
    <div className="space-y-6">
      {/* Provider Selector Tabs */}
      <section className="space-y-2">
        <h2 className="px-1 text-xs font-medium uppercase tracking-wider text-fg-subtle">
          Primary AI Provider & Engine
        </h2>
        <Card className="p-4">
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            {PROVIDERS.map((p) => {
              const selected = provider === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleProviderSelect(p.id)}
                  className={cn(
                    "flex flex-col items-start p-3 rounded-xl border text-left transition-all",
                    selected
                      ? "border-accent bg-accent/10 shadow-sm"
                      : "border-border bg-surface hover:border-border-strong hover:bg-subtle"
                  )}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="text-xs font-semibold text-fg">{p.name}</span>
                    {selected && <Check className="h-4 w-4 text-accent" />}
                  </div>
                  <span className="text-[10px] text-accent font-medium mt-0.5">{p.badge}</span>
                  <p className="mt-1 text-[11px] text-fg-muted line-clamp-2">{p.description}</p>
                </button>
              );
            })}
          </div>
        </Card>
      </section>

      {/* Model Selection Card */}
      <section className="space-y-2">
        <h2 className="px-1 text-xs font-medium uppercase tracking-wider text-fg-subtle">
          Model Configuration: {activeProviderInfo.name}
        </h2>
        <Card className="p-5 space-y-4">
          {/* Provider is Workers AI */}
          {provider === "workers-ai" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-fg">Cloudflare Workers AI Model</label>
                  <p className="text-xs text-fg-subtle">
                    Dynamic model selector tracking Cloudflare's live catalog.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => cfModels.refetch()}
                  loading={cfModels.isFetching}
                  className="h-7 text-xs"
                >
                  <RefreshCw className="h-3 w-3 mr-1" /> Refresh CF Catalog
                </Button>
              </div>

              {/* Dynamic CF Model Selector Dropdown */}
              <div className="relative">
                <div className="flex gap-2">
                  <Input
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="@cf/meta/llama-3.3-70b-instruct-fp8-fast"
                    className="font-mono text-xs flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCfDropdown(!showCfDropdown)}
                    className="shrink-0"
                  >
                    Select Model <ChevronDown className="h-4 w-4 ml-1" />
                  </Button>
                </div>

                {showCfDropdown && (
                  <div className="absolute left-0 right-0 top-11 z-20 rounded-xl border border-border bg-surface shadow-xl p-3 max-h-80 overflow-y-auto animate-fade-in">
                    <div className="relative mb-2">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-subtle" />
                      <Input
                        value={cfSearch}
                        onChange={(e) => setCfSearch(e.target.value)}
                        placeholder="Filter Cloudflare models…"
                        className="h-8 pl-8 text-xs"
                        autoFocus
                      />
                    </div>
                    <div className="space-y-1">
                      {filteredCfModels.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setModel(m.id);
                            setShowCfDropdown(false);
                          }}
                          className={cn(
                            "w-full text-left p-2 rounded-lg text-xs transition-colors flex flex-col gap-0.5",
                            model === m.id ? "bg-accent/15 text-fg font-medium" : "hover:bg-muted text-fg-muted"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-fg">{m.name}</span>
                            <div className="flex items-center gap-1">
                              {m.tags?.map((t) => (
                                <Badge
                                  key={t}
                                  tone={t === "recommended" ? "accent" : "neutral"}
                                  className="text-[9px] px-1 py-0"
                                >
                                  {t}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <span className="font-mono text-[10px] text-fg-subtle">{m.id}</span>
                          {m.description && <span className="text-[11px] text-fg-subtle">{m.description}</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Optional Cloudflare Live Account Fetching Keys */}
              <div className="mt-4 pt-3 border-t border-border">
                <details className="text-xs group">
                  <summary className="font-medium text-fg-subtle cursor-pointer hover:text-fg flex items-center gap-1">
                    <Cloud className="h-3.5 w-3.5 text-accent" />
                    Optional: Connect Cloudflare Account API Token (for private models / real-time search)
                  </summary>
                  <div className="mt-3 space-y-3 pl-4 border-l-2 border-accent/20">
                    <div>
                      <label className="text-[11px] font-medium text-fg-subtle">
                        Cloudflare Account ID
                      </label>
                      <Input
                        value={externalKeys.cloudflareAccountId ?? ""}
                        onChange={(e) =>
                          setExternalKeys({ ...externalKeys, cloudflareAccountId: e.target.value })
                        }
                        placeholder="e2247df71d93bb..."
                        className="mt-1 font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-fg-subtle">
                        Cloudflare API Token (Workers AI Read scope)
                      </label>
                      <Input
                        type="password"
                        value={externalKeys.cloudflareToken ?? ""}
                        onChange={(e) =>
                          setExternalKeys({ ...externalKeys, cloudflareToken: e.target.value })
                        }
                        placeholder="CF API Token with Workers AI Read permission"
                        className="mt-1 font-mono text-xs"
                      />
                    </div>
                  </div>
                </details>
              </div>
            </div>
          )}

          {/* External Provider (Anthropic, OpenAI, OpenRouter, Gemini) */}
          {provider !== "workers-ai" && (
            <div className="space-y-4">
              {/* Anthropic OAuth vs API Key Switch */}
              {provider === "anthropic" && (
                <div className="rounded-xl border border-border bg-subtle p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-fg flex items-center gap-1.5">
                      <Lock className="h-4 w-4 text-accent" />
                      Claude Authentication Method
                    </span>
                    <div className="flex items-center rounded-lg border border-border bg-surface p-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => setAnthropicAuthMode("oauth")}
                        className={cn(
                          "px-2.5 py-1 rounded-md font-medium transition-all",
                          anthropicAuthMode === "oauth" ? "bg-accent text-white" : "text-fg-muted hover:text-fg"
                        )}
                      >
                        OAuth Token (Recommended)
                      </button>
                      <button
                        type="button"
                        onClick={() => setAnthropicAuthMode("apikey")}
                        className={cn(
                          "px-2.5 py-1 rounded-md font-medium transition-all",
                          anthropicAuthMode === "apikey" ? "bg-accent text-white" : "text-fg-muted hover:text-fg"
                        )}
                      >
                        API Key
                      </button>
                    </div>
                  </div>

                  {anthropicAuthMode === "oauth" ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-fg flex items-center gap-1.5">
                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                          Claude OAuth Bearer Token
                        </label>
                        {externalKeys.anthropicOAuthToken ? (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-500">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              OAuth Connected
                            </span>
                            <button
                              type="button"
                              onClick={() => setExternalKeys({ ...externalKeys, anthropicOAuthToken: "" })}
                              className="text-[11px] text-danger hover:underline"
                            >
                              Disconnect
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-fg-subtle">No token saved</span>
                        )}
                      </div>
                      <div className="relative flex items-center">
                        <Input
                          type={showKey.anthropicOAuth ? "text" : "password"}
                          value={externalKeys.anthropicOAuthToken ?? ""}
                          onChange={(e) =>
                            setExternalKeys({ ...externalKeys, anthropicOAuthToken: e.target.value })
                          }
                          placeholder="Paste Claude OAuth Bearer Token..."
                          className="font-mono text-xs pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowKey({ ...showKey, anthropicOAuth: !showKey.anthropicOAuth })}
                          className="absolute right-3 text-fg-subtle hover:text-fg"
                        >
                          {showKey.anthropicOAuth ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <p className="text-[11px] text-fg-subtle">
                        Authenticates Anthropic Claude with OAuth Bearer tokens without requiring raw API keys.
                      </p>
                      <div className="pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          type="button"
                          onClick={() => {
                            setOauthModalProvider("anthropic");
                            setOauthModalOpen(true);
                          }}
                          className="border-accent/40 text-accent hover:bg-accent/10 text-xs w-full"
                        >
                          <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
                          Launch Claude OAuth Setup Flow
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-fg flex items-center gap-1.5">
                          <Key className="h-3.5 w-3.5 text-accent" />
                          Anthropic API Key
                        </label>
                        <a
                          href="https://console.anthropic.com/settings/keys"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-accent hover:underline flex items-center gap-1"
                        >
                          Get API Key <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <div className="relative flex items-center">
                        <Input
                          type={showKey.anthropic ? "text" : "password"}
                          value={externalKeys.anthropic ?? ""}
                          onChange={(e) => setExternalKeys({ ...externalKeys, anthropic: e.target.value })}
                          placeholder="sk-ant-..."
                          className="font-mono text-xs pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowKey({ ...showKey, anthropic: !showKey.anthropic })}
                          className="absolute right-3 text-fg-subtle hover:text-fg"
                        >
                          {showKey.anthropic ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Gemini / Antigravity OAuth vs API Key Switch */}
              {provider === "gemini" && (
                <div className="rounded-xl border border-border bg-subtle p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-fg flex items-center gap-1.5">
                      <Lock className="h-4 w-4 text-accent" />
                      Antigravity / Google Authentication
                    </span>
                    <div className="flex items-center rounded-lg border border-border bg-surface p-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => setGeminiAuthMode("oauth")}
                        className={cn(
                          "px-2.5 py-1 rounded-md font-medium transition-all",
                          geminiAuthMode === "oauth" ? "bg-accent text-white" : "text-fg-muted hover:text-fg"
                        )}
                      >
                        OAuth Token (Antigravity)
                      </button>
                      <button
                        type="button"
                        onClick={() => setGeminiAuthMode("apikey")}
                        className={cn(
                          "px-2.5 py-1 rounded-md font-medium transition-all",
                          geminiAuthMode === "apikey" ? "bg-accent text-white" : "text-fg-muted hover:text-fg"
                        )}
                      >
                        Gemini API Key
                      </button>
                    </div>
                  </div>

                  {geminiAuthMode === "oauth" ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-fg flex items-center gap-1.5">
                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                          Antigravity / Google Cloud OAuth Access Token
                        </label>
                        {externalKeys.googleOAuthToken ? (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-500">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              OAuth Connected
                            </span>
                            <button
                              type="button"
                              onClick={() => setExternalKeys({ ...externalKeys, googleOAuthToken: "" })}
                              className="text-[11px] text-danger hover:underline"
                            >
                              Disconnect
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-fg-subtle">No token saved</span>
                        )}
                      </div>
                      <div className="relative flex items-center">
                        <Input
                          type={showKey.googleOAuth ? "text" : "password"}
                          value={externalKeys.googleOAuthToken ?? ""}
                          onChange={(e) =>
                            setExternalKeys({ ...externalKeys, googleOAuthToken: e.target.value })
                          }
                          placeholder="Paste Antigravity OAuth Token (ya29...)..."
                          className="font-mono text-xs pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowKey({ ...showKey, googleOAuth: !showKey.googleOAuth })}
                          className="absolute right-3 text-fg-subtle hover:text-fg"
                        >
                          {showKey.googleOAuth ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <p className="text-[11px] text-fg-subtle">
                        Enables Antigravity / Google authentication via OAuth Bearer token without requiring an API key.
                      </p>
                      <div className="pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          type="button"
                          onClick={() => {
                            setOauthModalProvider("gemini");
                            setOauthModalOpen(true);
                          }}
                          className="border-accent/40 text-accent hover:bg-accent/10 text-xs w-full"
                        >
                          <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
                          Launch Google / Antigravity OAuth Flow
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-fg flex items-center gap-1.5">
                          <Key className="h-3.5 w-3.5 text-accent" />
                          Google Gemini API Key
                        </label>
                        <a
                          href="https://aistudio.google.com/app/apikey"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-accent hover:underline flex items-center gap-1"
                        >
                          Get API Key <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <div className="relative flex items-center">
                        <Input
                          type={showKey.gemini ? "text" : "password"}
                          value={externalKeys.gemini ?? ""}
                          onChange={(e) => setExternalKeys({ ...externalKeys, gemini: e.target.value })}
                          placeholder="AIzaSy..."
                          className="font-mono text-xs pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowKey({ ...showKey, gemini: !showKey.gemini })}
                          className="absolute right-3 text-fg-subtle hover:text-fg"
                        >
                          {showKey.gemini ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Standard Key Input for OpenAI and OpenRouter */}
              {provider !== "anthropic" && provider !== "gemini" && activeProviderInfo.keyName && (
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-fg flex items-center gap-1.5">
                      <Key className="h-4 w-4 text-accent" />
                      {activeProviderInfo.keyLabel}
                    </label>
                    {activeProviderInfo.docsUrl && (
                      <a
                        href={activeProviderInfo.docsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-accent hover:underline flex items-center gap-1"
                      >
                        Get API Key <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <div className="mt-1.5 relative flex items-center">
                    <Input
                      type={showKey[provider] ? "text" : "password"}
                      value={externalKeys[activeProviderInfo.keyName] ?? ""}
                      onChange={(e) =>
                        setExternalKeys({
                          ...externalKeys,
                          [activeProviderInfo.keyName!]: e.target.value,
                        })
                      }
                      placeholder={activeProviderInfo.keyPlaceholder}
                      className="font-mono text-xs pr-10"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowKey({ ...showKey, [provider]: !showKey[provider] })
                      }
                      className="absolute right-3 text-fg-subtle hover:text-fg"
                      aria-label="Toggle password visibility"
                    >
                      {showKey[provider] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Model Selector & Presets */}
              <div>
                <label className="text-sm font-medium text-fg">Model Identifier</label>
                <div className="mt-1.5 flex gap-2">
                  <Input
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="Enter model string..."
                    className="font-mono text-xs flex-1"
                  />
                </div>

                {/* Preset suggestions */}
                {availablePresets.length > 0 && (
                  <div className="mt-3">
                    <span className="text-[11px] font-medium text-fg-subtle">
                      Recommended Presets:
                    </span>
                    <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
                      {availablePresets.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setModel(opt.id)}
                          className={cn(
                            "flex flex-col text-left p-2 rounded-lg border text-xs transition-colors",
                            model === opt.id
                              ? "border-accent bg-accent/10"
                              : "border-border bg-surface hover:bg-subtle"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-fg">{opt.name}</span>
                            {opt.recommended && <Badge tone="accent" className="text-[9px]">Recommended</Badge>}
                          </div>
                          <span className="font-mono text-[10px] text-fg-subtle">{opt.id}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Learn & Demo switches */}
          <div className="pt-3 border-t border-border flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-fg">Learn from conversations</p>
              <p className="text-xs text-fg-subtle">
                Automatically extract durable preferences and save to memory.
              </p>
            </div>
            <Switch
              checked={settings.autoMemory}
              onChange={(v) => onSave({ autoMemory: v })}
              label="Learn from conversations"
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-fg">Demo mode</p>
              <p className="text-xs text-fg-subtle">
                Replaces AI provider with a fast deterministic offline responder.
              </p>
            </div>
            <Switch
              checked={settings.demoMode}
              onChange={(v) => onSave({ demoMode: v })}
              label="Demo mode"
            />
          </div>
        </Card>
      </section>

      {/* Multi-Provider Auto-Failover Section */}
      <section className="space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-1">
          <div>
            <h2 className="text-xs font-medium uppercase tracking-wider text-fg-subtle flex items-center gap-1.5">
              <Zap className="h-4 w-4 text-accent" />
              Multi-Provider Auto-Failover
            </h2>
            <p className="text-xs text-fg-subtle mt-0.5">
              Automatically switch models when your active provider runs out of quota, hits rate limits (429), or errors.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-fg">Auto-Failover</span>
            <Switch
              checked={autoFailover}
              onChange={setAutoFailover}
              label="Auto-failover enabled"
            />
          </div>
        </div>

        <Card className="p-5 space-y-4">
          {/* Active Chain Overview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-fg">Failover Execution Chain</span>
              <span className="text-[11px] text-fg-subtle">
                {fallbacks.length === 0 ? "No backup models" : `${fallbacks.length} backup model(s)`}
              </span>
            </div>

            {/* Step 0: Primary */}
            <div className="flex items-center justify-between rounded-lg border border-accent/40 bg-accent/5 p-3">
              <div className="flex items-center gap-2.5">
                <Badge tone="accent" className="font-semibold text-[10px] px-2">Primary</Badge>
                <div>
                  <span className="text-xs font-semibold text-fg">
                    {PROVIDERS.find((p) => p.id === provider)?.name ?? provider}
                  </span>
                  <p className="font-mono text-[10px] text-fg-subtle">{model}</p>
                </div>
              </div>
              <Badge tone="neutral" className="text-[10px]">Active</Badge>
            </div>

            {/* Fallbacks */}
            {fallbacks.map((fb, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between rounded-lg border border-border bg-surface p-3 transition-colors hover:border-border-strong"
              >
                <div className="flex items-center gap-2.5">
                  <Badge tone="neutral" className="font-medium text-[10px] px-2">
                    Fallback #{idx + 1}
                  </Badge>
                  <div>
                    <span className="text-xs font-semibold text-fg">
                      {PROVIDERS.find((p) => p.id === fb.provider)?.name ?? fb.provider}
                    </span>
                    <p className="font-mono text-[10px] text-fg-subtle">{fb.model}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={idx === 0}
                    onClick={() => handleMoveFallback(idx, "up")}
                    className="h-7 w-7 p-0"
                    title="Move up"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={idx === fallbacks.length - 1}
                    onClick={() => handleMoveFallback(idx, "down")}
                    className="h-7 w-7 p-0"
                    title="Move down"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRemoveFallback(idx)}
                    className="h-7 w-7 p-0 text-danger hover:bg-danger/10"
                    title="Remove fallback"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Add Fallback Form */}
          <div className="rounded-xl border border-dashed border-border p-3.5 bg-subtle/50 space-y-3">
            <span className="text-xs font-semibold text-fg flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5 text-accent" />
              Add Backup Provider / Model
            </span>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <label className="text-[11px] font-medium text-fg-subtle">Provider</label>
                <select
                  value={newFallbackProvider}
                  onChange={(e) => {
                    const nextP = e.target.value as LLMProviderId;
                    setNewFallbackProvider(nextP);
                    if (nextP === "workers-ai") setNewFallbackModel("@cf/meta/llama-3.3-70b-instruct-fp8-fast");
                    else if (nextP === "anthropic") setNewFallbackModel("claude-3-5-haiku-20241022");
                    else if (nextP === "openai") setNewFallbackModel("gpt-4o-mini");
                    else if (nextP === "openrouter") setNewFallbackModel("anthropic/claude-3.7-sonnet");
                    else if (nextP === "gemini") setNewFallbackModel("gemini-2.0-flash");
                  }}
                  className="mt-1 block w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-fg focus:border-accent focus:outline-none"
                >
                  {PROVIDERS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-medium text-fg-subtle">Model Identifier</label>
                <div className="mt-1 flex gap-2">
                  <Input
                    value={newFallbackModel}
                    onChange={(e) => setNewFallbackModel(e.target.value)}
                    placeholder="Enter model string..."
                    className="font-mono text-xs flex-1"
                  />
                  <Button
                    size="sm"
                    onClick={handleAddFallback}
                    disabled={!newFallbackModel.trim()}
                    className="shrink-0 text-xs"
                  >
                    Add
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* Generation & Limits Section */}
      <section className="space-y-2">
        <h2 className="px-1 text-xs font-medium uppercase tracking-wider text-fg-subtle">
          Generation & Limits
        </h2>
        <Card className="p-5 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-fg">Temperature: {temperature.toFixed(1)}</label>
              <span className="text-xs text-fg-subtle">0.0 = deterministic, 1.0+ = creative</span>
            </div>
            <input
              type="range"
              min={0}
              max={1.5}
              step={0.1}
              value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
              className="w-full accent-[var(--accent)]"
              aria-label="Temperature"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {LIMIT_FIELDS.map((f) => (
              <div key={f.key} className="space-y-1">
                <label className="text-xs font-medium text-fg">{f.label}</label>
                <Input
                  type="number"
                  min={0}
                  max={LIMIT_CEILINGS[f.key]}
                  value={limits[f.key]}
                  onChange={(e) => setLimits({ ...limits, [f.key]: Number(e.target.value) })}
                  className="text-xs"
                />
                <p className="text-[10px] text-fg-subtle">{f.hint}</p>
              </div>
            ))}
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <Button
              variant="ghost"
              disabled={!isDirty}
              onClick={() => {
                setProvider(currentProvider);
                setModel(settings.model);
                setTemperature(settings.temperature);
                setLimits(settings.limits);
                setExternalKeys(settings.externalKeys ?? {});
                setFallbacks(settings.fallbacks ?? []);
                setAutoFailover(settings.autoFailover ?? true);
              }}
            >
              Reset
            </Button>
            <Button disabled={!isDirty} loading={isPending} onClick={handleSaveAll}>
              Save AI Settings
            </Button>
          </div>
        </Card>
      </section>

      {/* OAuth Connection Modal */}
      <OAuthConnectModal
        open={oauthModalOpen}
        onClose={() => setOauthModalOpen(false)}
        initialProvider={oauthModalProvider}
      />
    </div>
  );
}
