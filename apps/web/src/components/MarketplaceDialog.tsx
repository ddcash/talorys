import { useState } from "react";
import type { MarketplaceMcp, MarketplaceSkill, MarketplaceRule } from "@talorys/shared";
import {
  BookOpen,
  Check,
  Cpu,
  Download,
  ExternalLink,
  Layers,
  Search,
  Server,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Badge, Button, Card, Dialog, Input, Spinner } from "./ui";
import {
  keys,
  useApiMutation,
  useMarketplaceMcp,
  useMarketplaceSkills,
  useMarketplaceRules,
} from "../hooks/queries";
import { api } from "../lib/api";
import { cn } from "../lib/utils";

type MarketplaceTab = "mcp" | "skills" | "rules";

export function MarketplaceDialog({
  open,
  onClose,
  initialTab = "mcp",
}: {
  open: boolean;
  onClose: () => void;
  initialTab?: MarketplaceTab;
}) {
  const [tab, setTab] = useState<MarketplaceTab>(initialTab);
  const [search, setSearch] = useState("");
  const [installingMcp, setInstallingMcp] = useState<MarketplaceMcp | null>(null);
  const [mcpToken, setMcpToken] = useState("");
  const [mcpUrl, setMcpUrl] = useState("");

  const mcps = useMarketplaceMcp();
  const skills = useMarketplaceSkills();
  const rules = useMarketplaceRules();

  const installMcp = useApiMutation(
    (input: { id: string; auth_token?: string; url_override?: string }) =>
      api("/marketplace/install/mcp", { method: "POST", body: input }),
    {
      invalidate: [keys.mcpServers],
      success: "MCP Server installed successfully",
      onSuccess: () => setInstallingMcp(null),
    },
  );

  const installSkill = useApiMutation(
    (id: string) => api("/marketplace/install/skill", { method: "POST", body: { id } }),
    {
      invalidate: [keys.skills],
      success: "Skill installed successfully",
    },
  );

  const installRule = useApiMutation(
    (id: string) => api("/marketplace/install/rule", { method: "POST", body: { id } }),
    {
      invalidate: [keys.rules],
      success: "Rule installed successfully",
    },
  );

  const filteredMcps = (mcps.data ?? []).filter((m) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      m.name.toLowerCase().includes(q) ||
      m.description.toLowerCase().includes(q) ||
      m.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  const filteredSkills = (skills.data ?? []).filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  const filteredRules = (rules.data ?? []).filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.title.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      r.content.toLowerCase().includes(q) ||
      r.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        title="Community Marketplace"
        wide
        footer={
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-fg-muted">
              Discover and 1-click install verified MCP servers, skills, and rules from reputable open source registries.
            </p>
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-subtle" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search marketplace…"
                className="h-8 pl-8 text-xs"
              />
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-1 border-b border-border pb-1">
            <button
              type="button"
              onClick={() => setTab("mcp")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
                tab === "mcp" ? "bg-accent text-white" : "text-fg-muted hover:text-fg hover:bg-muted"
              )}
            >
              <Server className="h-3.5 w-3.5" />
              MCP Servers ({mcps.data?.length ?? 0})
            </button>
            <button
              type="button"
              onClick={() => setTab("skills")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
                tab === "skills" ? "bg-accent text-white" : "text-fg-muted hover:text-fg hover:bg-muted"
              )}
            >
              <Cpu className="h-3.5 w-3.5" />
              Skills ({skills.data?.length ?? 0})
            </button>
            <button
              type="button"
              onClick={() => setTab("rules")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
                tab === "rules" ? "bg-accent text-white" : "text-fg-muted hover:text-fg hover:bg-muted"
              )}
            >
              <BookOpen className="h-3.5 w-3.5" />
              Rules ({rules.data?.length ?? 0})
            </button>
          </div>

          {/* Tab 1: MCP Servers */}
          {tab === "mcp" && (
            <div className="space-y-2.5 max-h-[55vh] overflow-y-auto pr-1">
              {mcps.isLoading ? (
                <div className="flex justify-center p-8">
                  <Spinner />
                </div>
              ) : filteredMcps.length === 0 ? (
                <p className="p-8 text-center text-xs text-fg-subtle">No MCP servers match your search.</p>
              ) : (
                filteredMcps.map((m) => (
                  <Card key={m.id} className="p-3.5 transition-colors hover:border-border-strong">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-fg">{m.name}</span>
                          <span className="text-[10px] text-fg-subtle">by {m.author}</span>
                          <Badge tone="accent" className="text-[9px] capitalize">{m.category}</Badge>
                          <span className="flex items-center gap-0.5 text-[10px] text-success">
                            <ShieldCheck className="h-3 w-3" /> Verified
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-fg-muted line-clamp-2">{m.description}</p>
                        <div className="mt-2 flex flex-wrap gap-1 items-center">
                          <span className="font-mono text-[10px] text-fg-subtle bg-muted px-1.5 py-0.5 rounded">
                            {m.default_url}
                          </span>
                          {m.tags.map((t) => (
                            <span key={t} className="text-[9px] text-fg-subtle bg-subtle px-1 rounded">
                              #{t}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <Button
                          size="sm"
                          onClick={() => {
                            setInstallingMcp(m);
                            setMcpUrl(m.default_url);
                            setMcpToken("");
                          }}
                        >
                          <Download className="h-3.5 w-3.5 mr-1" /> Install
                        </Button>
                        {m.documentation_url && (
                          <a
                            href={m.documentation_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-accent hover:underline flex items-center gap-0.5"
                          >
                            Docs <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}

          {/* Tab 2: Skills */}
          {tab === "skills" && (
            <div className="space-y-2.5 max-h-[55vh] overflow-y-auto pr-1">
              {skills.isLoading ? (
                <div className="flex justify-center p-8">
                  <Spinner />
                </div>
              ) : filteredSkills.length === 0 ? (
                <p className="p-8 text-center text-xs text-fg-subtle">No skills match your search.</p>
              ) : (
                filteredSkills.map((s) => (
                  <Card key={s.id} className="p-3.5 transition-colors hover:border-border-strong">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-fg">{s.name}</span>
                          <span className="text-[10px] text-fg-subtle">by {s.author}</span>
                          <Badge tone="accent" className="text-[9px] capitalize">{s.category}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-fg-muted line-clamp-2">{s.description}</p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {s.tags.map((t) => (
                            <span key={t} className="text-[9px] text-fg-subtle bg-subtle px-1 rounded">
                              #{t}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="shrink-0">
                        <Button
                          size="sm"
                          onClick={() => installSkill.mutate(s.id)}
                          loading={installSkill.isPending}
                        >
                          <Download className="h-3.5 w-3.5 mr-1" /> Install
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}

          {/* Tab 3: Rules */}
          {tab === "rules" && (
            <div className="space-y-2.5 max-h-[55vh] overflow-y-auto pr-1">
              {rules.isLoading ? (
                <div className="flex justify-center p-8">
                  <Spinner />
                </div>
              ) : filteredRules.length === 0 ? (
                <p className="p-8 text-center text-xs text-fg-subtle">No rules match your search.</p>
              ) : (
                filteredRules.map((r) => (
                  <Card key={r.id} className="p-3.5 transition-colors hover:border-border-strong">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-fg">{r.title}</span>
                          <span className="text-[10px] text-fg-subtle">by {r.author}</span>
                          <Badge tone="accent" className="text-[9px] capitalize">{r.category}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-fg-muted font-mono bg-subtle p-2 rounded line-clamp-3">
                          {r.content}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {r.tags.map((t) => (
                            <span key={t} className="text-[9px] text-fg-subtle bg-subtle px-1 rounded">
                              #{t}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="shrink-0">
                        <Button
                          size="sm"
                          onClick={() => installRule.mutate(r.id)}
                          loading={installRule.isPending}
                        >
                          <Download className="h-3.5 w-3.5 mr-1" /> Install
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}
        </div>
      </Dialog>

      {/* Mini Install MCP Dialog */}
      <Dialog
        open={!!installingMcp}
        onClose={() => setInstallingMcp(null)}
        title={`Install ${installingMcp?.name ?? "MCP Server"}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setInstallingMcp(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!installingMcp) return;
                installMcp.mutate({
                  id: installingMcp.id,
                  auth_token: mcpToken.trim() || undefined,
                  url_override: mcpUrl.trim() || undefined,
                });
              }}
              loading={installMcp.isPending}
            >
              Confirm Installation
            </Button>
          </>
        }
      >
        {installingMcp && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-fg-subtle">Server URL</label>
              <Input
                value={mcpUrl}
                onChange={(e) => setMcpUrl(e.target.value)}
                placeholder="https://..."
                className="mt-1 font-mono text-xs"
              />
            </div>
            {installingMcp.needs_auth && (
              <div>
                <label className="text-xs font-medium text-fg-subtle">Authentication Token</label>
                <Input
                  type="password"
                  value={mcpToken}
                  onChange={(e) => setMcpToken(e.target.value)}
                  placeholder="Bearer token or API key..."
                  className="mt-1 font-mono text-xs"
                />
                {installingMcp.auth_hint && (
                  <p className="mt-1 text-[11px] text-fg-subtle">{installingMcp.auth_hint}</p>
                )}
              </div>
            )}
            <p className="text-[11px] text-fg-muted">
              Installing this MCP will connect it to Talorys and register its tools for your assistant turns.
            </p>
          </div>
        )}
      </Dialog>
    </>
  );
}
