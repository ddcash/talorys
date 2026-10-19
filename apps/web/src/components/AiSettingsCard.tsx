import { useState } from "react";
import type { LLMProviderId, Limits, Settings } from "@talorys/shared";
import { LIMIT_CEILINGS } from "@talorys/shared";
import {
  Brain,
  Check,
  ChevronDown,
  Cloud,
  ExternalLink,
  Eye,
  EyeOff,
  Key,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-react";
import { Badge, Button, Card, Input, Spinner, Switch } from "./ui";
import {
  useCloudflareModels,
  useModelPresets,
  type ModelOption,
} from "../hooks/queries";
import { cn } from "../lib/utils";

interface ProviderDef {
  id: LLMProviderId;
  name: string;
  badge: string;
  description: string;
  keyName?: "anthropic" | "openai" | "openrouter" | "gemini";
  keyLabel?: string;
  keyPlaceholder?: string;
  docsUrl?: string;
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
    badge: "Direct API",
    description: "Industry-leading reasoning with Claude 3.7 Sonnet, 3.5 Sonnet, and 3.5 Haiku.",
    keyName: "anthropic",
    keyLabel: "Anthropic API Key",
    keyPlaceholder: "sk-ant-...",
    docsUrl: "https://console.anthropic.com/settings/keys",
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
  {
    id: "gemini",
    name: "Google Gemini",
    badge: "Direct API",
    description: "High-speed multimodal intelligence with Gemini 2.0 Flash, Gemini 2.5 Pro, and 1.5 Pro.",
    keyName: "gemini",
    keyLabel: "Google Gemini API Key",
    keyPlaceholder: "AIzaSy...",
    docsUrl: "https://aistudio.google.com/app/apikey",
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

  const handleSaveAll = () => {
    onSave({
      provider,
      model: model.trim(),
      temperature,
      limits,
      externalKeys,
    });
  };

  const isDirty =
    provider !== currentProvider ||
    model !== settings.model ||
    temperature !== settings.temperature ||
    JSON.stringify(limits) !== JSON.stringify(settings.limits) ||
    JSON.stringify(externalKeys) !== JSON.stringify(settings.externalKeys ?? {});

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
          AI Provider & Engine
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
              {/* API Key Input */}
              {activeProviderInfo.keyName && (
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
    </div>
  );
}
