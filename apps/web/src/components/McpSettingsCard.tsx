import { useState } from "react";
import type { McpServer, McpToolSummary } from "@talorys/shared";
import { CheckCircle2, ChevronDown, ChevronRight, Database, ExternalLink, HelpCircle, Layers, Plus, RefreshCw, Trash2, Zap } from "lucide-react";
import { Badge, Button, Card, ConfirmDialog, ErrorNotice, Input, Label, Spinner, Switch } from "./ui";
import { MarketplaceDialog } from "./MarketplaceDialog";
import { keys, useApiMutation, useMcpServers } from "../hooks/queries";
import { useToast } from "../hooks/toast";
import { api } from "../lib/api";

const DESCRIPTION =
  "Connect remote Model Context Protocol (MCP) servers to give Talorys external capabilities, or link your Cloudflare Inkstone worker as a persistent, free-tier optimized memory system.";

export function McpSettingsCard() {
  const toast = useToast();
  const { data: servers = [], isLoading, error } = useMcpServers();

  const [showMarketplace, setShowMarketplace] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showInkstonePreset, setShowInkstonePreset] = useState(false);
  const [expandedServerId, setExpandedServerId] = useState<string | null>(null);
  const [deletingServer, setDeletingServer] = useState<McpServer | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [isMemoryProvider, setIsMemoryProvider] = useState(false);
  const [memoryMode, setMemoryMode] = useState<"optimized" | "all_tools">("optimized");

  // Test state
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; count: number; error?: string } | null>(null);

  const createServer = useApiMutation(
    (input: {
      name: string;
      url: string;
      auth_token?: string | null;
      is_memory_provider: boolean;
      memory_mode: "optimized" | "all_tools";
    }) => api<{ server: McpServer }>("/mcp/servers", { method: "POST", body: input }),
    {
      invalidate: [keys.mcpServers],
      success: (r) => `Connected MCP server "${r.server.name}"`,
      onSuccess: () => {
        resetForm();
      },
    },
  );

  const updateServer = useApiMutation(
    (input: { id: string; patch: Partial<McpServer> }) =>
      api<{ server: McpServer }>(`/mcp/servers/${input.id}`, { method: "PATCH", body: input.patch }),
    {
      invalidate: [keys.mcpServers],
      success: "MCP server updated",
    },
  );

  const refreshTools = useApiMutation(
    (id: string) => api<{ server: McpServer }>(`/mcp/servers/${id}/refresh`, { method: "POST" }),
    {
      invalidate: [keys.mcpServers],
      success: (r) => `Refreshed ${r.server.cached_tools.length} tools for "${r.server.name}"`,
    },
  );

  const deleteServer = useApiMutation(
    (id: string) => api(`/mcp/servers/${id}`, { method: "DELETE" }),
    {
      invalidate: [keys.mcpServers],
      success: "MCP server removed",
      onSuccess: () => setDeletingServer(null),
    },
  );

  function resetForm() {
    setName("");
    setUrl("");
    setToken("");
    setIsMemoryProvider(false);
    setMemoryMode("optimized");
    setShowAddForm(false);
    setShowInkstonePreset(false);
    setTestResult(null);
  }

  function applyInkstonePreset() {
    setName("Inkstone Knowledge Base");
    setUrl("https://inkstone-cf.r-cash88.workers.dev/mcp");
    setIsMemoryProvider(true);
    setMemoryMode("optimized");
    setShowInkstonePreset(true);
    setShowAddForm(true);
  }

  async function handleTestConnection() {
    if (!url.trim()) {
      toast("Please enter an endpoint URL first", "error");
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api<{ ok: boolean; toolsCount: number; error?: string }>("/mcp/test", {
        method: "POST",
        body: { url, auth_token: token || null },
      });
      if (res.ok) {
        setTestResult({ ok: true, count: res.toolsCount });
        toast(`Success! Discovered ${res.toolsCount} MCP tools.`);
      } else {
        setTestResult({ ok: false, count: 0, error: res.error });
        toast(res.error || "Connection test failed", "error");
      }
    } catch (err) {
      setTestResult({ ok: false, count: 0, error: err instanceof Error ? err.message : String(err) });
    } finally {
      setTesting(false);
    }
  }

  function handleSave() {
    if (!name.trim()) return toast("Server name is required", "error");
    if (!url.trim()) return toast("Server URL is required", "error");
    try {
      new URL(url);
    } catch {
      return toast("Invalid URL format (e.g. https://domain.com/mcp)", "error");
    }

    createServer.mutate({
      name: name.trim(),
      url: url.trim(),
      auth_token: token.trim() || null,
      is_memory_provider: isMemoryProvider,
      memory_mode: memoryMode,
    });
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-1">
        <div>
          <h2 className="text-xs font-medium uppercase tracking-wider text-fg-subtle">
            Model Context Protocol (MCP) & Integrations
          </h2>
          <p className="mt-1 text-xs text-fg-subtle max-w-xl">{DESCRIPTION}</p>
        </div>
        <div className="flex items-center gap-2">
          {!showAddForm && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMarketplace(true)}
                className="gap-1.5 text-xs border-accent/30 text-accent hover:bg-accent/10"
              >
                <Layers className="h-3.5 w-3.5" />
                Marketplace
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={applyInkstonePreset}
                className="gap-1.5 text-xs text-accent border-accent/40 hover:bg-accent/10"
              >
                <Zap className="h-3.5 w-3.5" />
                Quick Connect Inkstone
              </Button>
              <Button size="sm" onClick={() => setShowAddForm(true)} className="gap-1 text-xs">
                <Plus className="h-3.5 w-3.5" />
                Add MCP Server
              </Button>
            </>
          )}
        </div>
      </div>

      {error && <ErrorNotice error={error} />}

      {/* Add / Connect Form */}
      {showAddForm && (
        <Card className="border-accent/30 bg-accent/5 p-5 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-accent" />
              <h3 className="text-sm font-semibold">
                {showInkstonePreset ? "Connect Cloudflare Inkstone" : "Add MCP Server"}
              </h3>
            </div>
            <Button variant="ghost" size="sm" onClick={resetForm} className="text-xs">
              Cancel
            </Button>
          </div>

          {showInkstonePreset && (
            <div className="rounded-lg bg-bg-subtle p-3 text-xs leading-relaxed text-fg-muted space-y-1.5 border border-border">
              <div className="flex items-center gap-1.5 font-medium text-fg">
                <Zap className="h-3.5 w-3.5 text-accent" />
                Free-Tier Memory Optimization Active
              </div>
              <p>
                Talorys connects directly to your <strong>inkstone-cf</strong> worker at its <code>/mcp</code> route.
                When configured as the Memory Provider in <strong>Optimized mode</strong>, Talorys queries notes efficiently
                and exposes only high-value note tools, preventing context token bloat and keeping execution well within free daily quotas.
              </p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="mcp-name">
                Server Name
              </Label>
              <Input
                id="mcp-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Inkstone Knowledge Base"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="mcp-url">
                MCP Endpoint URL
              </Label>
              <Input
                id="mcp-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://inkstone-cf.<subdomain>.workers.dev/mcp"
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="mcp-token">
              Bearer Token / API Key (Optional)
            </Label>
            <Input
              id="mcp-token"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Leave blank if unauthenticated or uses internal access"
              className="mt-1"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 pt-1 border-t border-border">
            <div className="flex items-center justify-between rounded-lg bg-bg p-3 border border-border">
              <div className="space-y-0.5 pr-2">
                <p className="text-xs font-medium text-fg">Set as Memory System</p>
                <p className="text-[11px] text-fg-subtle">
                  Injects relevant note context into conversation turns automatically.
                </p>
              </div>
              <Switch
                checked={isMemoryProvider}
                onChange={setIsMemoryProvider}
                label="Set as Memory System"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg bg-bg p-3 border border-border">
              <div className="space-y-0.5 pr-2">
                <p className="text-xs font-medium text-fg">Free-Tier Optimized Mode</p>
                <p className="text-[11px] text-fg-subtle">
                  Only exposes note search & creation tools to save model context tokens.
                </p>
              </div>
              <Switch
                checked={memoryMode === "optimized"}
                onChange={(val) => setMemoryMode(val ? "optimized" : "all_tools")}
                label="Free-Tier Optimized Mode"
              />
            </div>
          </div>

          {testResult && (
            <div
              className={`rounded-lg p-3 text-xs border ${
                testResult.ok
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : "bg-rose-500/10 border-rose-500/30 text-rose-400"
              }`}
            >
              {testResult.ok ? (
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  Connection verified! Discovered {testResult.count} MCP tools on this server.
                </div>
              ) : (
                <p>Connection failed: {testResult.error}</p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={testing || !url}
              className="gap-1.5 text-xs"
            >
              {testing ? <Spinner className="h-3 w-3" /> : <RefreshCw className="h-3 w-3" />}
              Test Connection
            </Button>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={resetForm} className="text-xs">
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                disabled={createServer.isPending || !name || !url}
                className="text-xs"
              >
                {createServer.isPending ? <Spinner className="h-3 w-3" /> : "Save & Enable"}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Configured Servers List */}
      {isLoading ? (
        <Card className="flex justify-center py-8">
          <Spinner />
        </Card>
      ) : servers.length === 0 ? (
        <Card className="p-8 text-center space-y-3">
          <Database className="mx-auto h-8 w-8 text-fg-subtle opacity-60" />
          <div className="space-y-1">
            <p className="text-sm font-medium">No MCP servers connected yet</p>
            <p className="text-xs text-fg-subtle max-w-md mx-auto">
              Link external services or your Cloudflare <strong>Inkstone</strong> knowledge base to expand what Talorys knows and can do.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={applyInkstonePreset} className="text-xs gap-1.5 mt-2">
            <Zap className="h-3.5 w-3.5 text-accent" />
            Quick Connect Inkstone
          </Button>
        </Card>
      ) : (
        <Card>
          <div className="divide-y divide-border">
            {servers.map((server) => {
              const isExpanded = expandedServerId === server.id;
              const tools = server.cached_tools ?? [];

              return (
                <div key={server.id} className="p-4 space-y-3 transition-colors hover:bg-bg-subtle/40">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-fg">{server.name}</span>
                        {server.is_memory_provider && (
                          <Badge tone="accent" className="text-[10px] uppercase font-bold tracking-wider">
                            Memory Provider
                          </Badge>
                        )}
                        <Badge tone={server.enabled ? "success" : "neutral"} className="text-[10px]">
                          {server.enabled ? "Active" : "Disabled"}
                        </Badge>
                        {server.memory_mode === "optimized" && (
                          <Badge tone="accent" className="text-[10px] text-emerald-400 border-emerald-500/30">
                            Free Tier Safe
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-fg-subtle font-mono truncate max-w-md">{server.url}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Switch
                        checked={server.enabled}
                        onChange={(enabled) => updateServer.mutate({ id: server.id, patch: { enabled } })}
                        label={`Toggle ${server.name}`}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Refresh tools from server"
                        onClick={() => refreshTools.mutate(server.id)}
                        disabled={refreshTools.isPending}
                        className="h-8 w-8 p-0"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${refreshTools.isPending ? "animate-spin" : ""}`} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Delete server"
                        onClick={() => setDeletingServer(server)}
                        className="h-8 w-8 p-0 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Actions & Toggles */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/60 text-xs">
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-1.5 cursor-pointer text-fg-muted hover:text-fg">
                        <input
                          type="checkbox"
                          className="rounded border-border accent-accent"
                          checked={server.is_memory_provider}
                          onChange={(e) =>
                            updateServer.mutate({ id: server.id, patch: { is_memory_provider: e.target.checked } })
                          }
                        />
                        Use as Active Memory System
                      </label>

                      <label className="flex items-center gap-1.5 cursor-pointer text-fg-muted hover:text-fg">
                        <input
                          type="checkbox"
                          className="rounded border-border accent-accent"
                          checked={server.memory_mode === "optimized"}
                          onChange={(e) =>
                            updateServer.mutate({
                              id: server.id,
                              patch: { memory_mode: e.target.checked ? "optimized" : "all_tools" },
                            })
                          }
                        />
                        Free-tier Optimized
                      </label>
                    </div>

                    <button
                      type="button"
                      onClick={() => setExpandedServerId(isExpanded ? null : server.id)}
                      className="flex items-center gap-1 text-fg-subtle hover:text-fg"
                    >
                      <span>{tools.length} Tools available</span>
                      {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    </button>
                  </div>

                  {/* Tools preview panel */}
                  {isExpanded && (
                    <div className="rounded-lg bg-bg p-3 border border-border space-y-2 mt-2 animate-fade-in text-xs">
                      <div className="font-medium text-fg-muted pb-1 border-b border-border flex justify-between">
                        <span>Discovered Tools</span>
                        <span className="text-fg-subtle">Updated {server.tools_updated_at ? new Date(server.tools_updated_at).toLocaleDateString() : "recently"}</span>
                      </div>
                      {tools.length === 0 ? (
                        <p className="text-fg-subtle py-2">No tools cached yet. Click the refresh button to discover tools.</p>
                      ) : (
                        <div className="grid gap-2 max-h-48 overflow-y-auto pr-1">
                          {tools.map((tool) => (
                            <div key={tool.name} className="p-2 rounded bg-bg-subtle/50 border border-border/40">
                              <span className="font-mono font-medium text-accent">{tool.name}</span>
                              {tool.description && <p className="text-fg-subtle mt-0.5 line-clamp-2">{tool.description}</p>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Delete Confirmation */}
      {deletingServer && (
        <ConfirmDialog
          open={true}
          title="Remove MCP Server?"
          message={`Are you sure you want to remove "${deletingServer.name}"? Talorys will no longer have access to its tools.`}
          confirmLabel="Remove"
          onConfirm={() => deleteServer.mutate(deletingServer.id)}
          onCancel={() => setDeletingServer(null)}
          loading={deleteServer.isPending}
        />
      )}

      <MarketplaceDialog
        open={showMarketplace}
        onClose={() => setShowMarketplace(false)}
        initialTab="mcp"
      />
    </section>
  );
}
