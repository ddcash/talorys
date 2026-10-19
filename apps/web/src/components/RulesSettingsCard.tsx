import { useState } from "react";
import type { Rule, RuleCategory } from "@talorys/shared";
import { BookOpen, Check, Edit2, Layers, Plus, Sparkles, Trash2, X } from "lucide-react";
import { Badge, Button, Card, ConfirmDialog, Dialog, Input, Spinner, Switch } from "./ui";
import { keys, useApiMutation, useRules } from "../hooks/queries";
import { api } from "../lib/api";
import { cn } from "../lib/utils";
import { MarketplaceDialog } from "./MarketplaceDialog";

const CATEGORIES: { id: RuleCategory; label: string }[] = [
  { id: "general", label: "General" },
  { id: "persona", label: "Persona" },
  { id: "coding", label: "Coding" },
  { id: "writing", label: "Writing" },
  { id: "memory", label: "Memory" },
  { id: "safety", label: "Safety" },
];

const PRESET_RULES: Array<{ title: string; category: RuleCategory; content: string }> = [
  {
    title: "Concise & Direct",
    category: "persona",
    content: "Be direct, concise, and avoid unnecessary filler phrases, pleasantries, or preamble. Get straight to the answer.",
  },
  {
    title: "Code Quality & Modern Standards",
    category: "coding",
    content: "When providing code, write clean, strictly-typed modern code with minimal boilerplate. Explain architectural choices briefly after the code block.",
  },
  {
    title: "Structured Markdown Output",
    category: "writing",
    content: "Organize complex responses using descriptive headers, bullet points, and tables where comparative data is discussed.",
  },
  {
    title: "Proactive Contextual Memory",
    category: "memory",
    content: "Reference past preferences and active projects when answering questions. When user expresses a firm workflow habit, remind them or store it.",
  },
];

export function RulesSettingsCard() {
  const rules = useRules();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [editingRule, setEditingRule] = useState<Partial<Rule> | null>(null);
  const [deletingRule, setDeletingRule] = useState<Rule | null>(null);
  const [showMarketplace, setShowMarketplace] = useState(false);

  const createRule = useApiMutation(
    (input: { title: string; content: string; category: RuleCategory; enabled?: boolean }) =>
      api<{ rule: Rule }>("/rules", { method: "POST", body: input }),
    {
      invalidate: [keys.rules],
      success: "Rule created",
      onSuccess: () => setEditingRule(null),
    },
  );

  const updateRule = useApiMutation(
    ({ id, patch }: { id: string; patch: Partial<Rule> }) =>
      api<{ rule: Rule }>(`/rules/${id}`, { method: "PATCH", body: patch }),
    {
      invalidate: [keys.rules],
      success: "Rule updated",
      onSuccess: () => setEditingRule(null),
    },
  );

  const toggleRule = useApiMutation(
    ({ id, enabled }: { id: string; enabled: boolean }) =>
      api<{ rule: Rule }>(`/rules/${id}`, { method: "PATCH", body: { enabled } }),
    {
      invalidate: [keys.rules],
      success: (r) => `${r.rule.title} ${r.rule.enabled ? "enabled" : "disabled"}`,
    },
  );

  const deleteRule = useApiMutation(
    (id: string) => api(`/rules/${id}`, { method: "DELETE" }),
    {
      invalidate: [keys.rules],
      success: "Rule deleted",
      onSuccess: () => setDeletingRule(null),
    },
  );

  const ruleList = rules.data ?? [];
  const filtered = ruleList.filter((r) => {
    const matchesCat = selectedCategory === "all" || r.category === selectedCategory;
    const matchesSearch =
      !search ||
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.content.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const activeCount = ruleList.filter((r) => r.enabled).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-fg flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-accent" />
            Behavioral Rules
            <Badge tone="accent">{activeCount} active</Badge>
          </h2>
          <p className="text-xs text-fg-subtle mt-0.5">
            Rules guide Talorys' persona, tone, coding style, and operating boundaries across all conversations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowMarketplace(true)}
            className="border-accent/40 hover:bg-accent/10 text-accent font-medium"
          >
            <Layers className="h-4 w-4 mr-1.5" /> Marketplace
          </Button>
          <Button
            size="sm"
            onClick={() =>
              setEditingRule({
                title: "",
                content: "",
                category: "general",
                enabled: true,
              })
            }
          >
            <Plus className="h-4 w-4 mr-1" /> Add Rule
          </Button>
        </div>
      </div>

      {/* Category Pills & Search */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setSelectedCategory("all")}
            className={cn(
              "px-2.5 py-1 text-xs font-medium rounded-lg transition-colors",
              selectedCategory === "all" ? "bg-accent text-white" : "bg-muted text-fg-muted hover:text-fg"
            )}
          >
            All ({ruleList.length})
          </button>
          {CATEGORIES.map((c) => {
            const count = ruleList.filter((r) => r.category === c.id).length;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCategory(c.id)}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium rounded-lg transition-colors",
                  selectedCategory === c.id ? "bg-accent text-white" : "bg-muted text-fg-muted hover:text-fg"
                )}
              >
                {c.label} ({count})
              </button>
            );
          })}
        </div>
        <div className="w-full sm:w-48">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rules…"
            className="h-8 text-xs"
          />
        </div>
      </div>

      {/* Preset Starter Suggestions if rules are few */}
      {ruleList.length === 0 && (
        <Card className="p-4 border-dashed border-accent/40 bg-accent/5">
          <div className="flex items-center gap-2 text-sm font-medium text-accent mb-2">
            <Sparkles className="h-4 w-4" /> Recommended Starter Rules
          </div>
          <p className="text-xs text-fg-muted mb-3">
            Get started quickly by enabling recommended rules for your AI assistant:
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {PRESET_RULES.map((p) => (
              <div
                key={p.title}
                className="p-3 bg-surface rounded-lg border border-border flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-fg">{p.title}</span>
                    <Badge tone="neutral" className="capitalize text-[10px]">
                      {p.category}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-fg-muted mt-1 line-clamp-2">{p.content}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 text-xs h-7 self-start"
                  onClick={() =>
                    createRule.mutate({
                      title: p.title,
                      category: p.category,
                      content: p.content,
                      enabled: true,
                    })
                  }
                  loading={createRule.isPending}
                >
                  <Plus className="h-3 w-3 mr-1" /> Add Rule
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Rules List */}
      {rules.isLoading ? (
        <div className="flex justify-center p-8">
          <Spinner />
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-8 text-center text-sm text-fg-subtle">
          {search ? "No rules match your search." : "No rules in this category."}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((rule) => (
            <Card key={rule.id} className="p-4 transition-all hover:border-border-strong">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-fg">{rule.title}</h3>
                    <Badge tone="neutral" className="capitalize text-[10px]">
                      {rule.category}
                    </Badge>
                    {!rule.enabled && (
                      <Badge tone="warning" className="text-[10px]">
                        Inactive
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-fg-muted whitespace-pre-wrap leading-relaxed font-mono bg-subtle p-2.5 rounded-md border border-border/50">
                    {rule.content}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch
                    checked={rule.enabled}
                    onChange={(checked) => toggleRule.mutate({ id: rule.id, enabled: checked })}
                    label={`Enable ${rule.title}`}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingRule(rule)}
                    aria-label={`Edit ${rule.title}`}
                    className="h-8 w-8 p-0"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDeletingRule(rule)}
                    aria-label={`Delete ${rule.title}`}
                    className="h-8 w-8 p-0 text-danger hover:text-danger hover:bg-danger-soft"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Edit / Create Rule Dialog */}
      <Dialog
        open={!!editingRule}
        onClose={() => setEditingRule(null)}
        title={editingRule?.id ? "Edit Rule" : "Create New Rule"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditingRule(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!editingRule?.title?.trim() || !editingRule?.content?.trim()) return;
                if (editingRule.id) {
                  updateRule.mutate({
                    id: editingRule.id,
                    patch: {
                      title: editingRule.title.trim(),
                      content: editingRule.content.trim(),
                      category: (editingRule.category as RuleCategory) ?? "general",
                      enabled: editingRule.enabled !== false,
                    },
                  });
                } else {
                  createRule.mutate({
                    title: editingRule.title.trim(),
                    content: editingRule.content.trim(),
                    category: (editingRule.category as RuleCategory) ?? "general",
                    enabled: editingRule.enabled !== false,
                  });
                }
              }}
              loading={createRule.isPending || updateRule.isPending}
              disabled={!editingRule?.title?.trim() || !editingRule?.content?.trim()}
            >
              {editingRule?.id ? "Save Changes" : "Create Rule"}
            </Button>
          </>
        }
      >
        {editingRule && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-fg-subtle">Rule Title</label>
              <Input
                value={editingRule.title ?? ""}
                onChange={(e) => setEditingRule({ ...editingRule, title: e.target.value })}
                placeholder="e.g. Concise Responses"
                maxLength={100}
                className="mt-1"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-medium text-fg-subtle">Category</label>
              <select
                value={editingRule.category ?? "general"}
                onChange={(e) =>
                  setEditingRule({ ...editingRule, category: e.target.value as RuleCategory })
                }
                className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:border-accent focus:outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-fg-subtle">Instruction Content</label>
              <textarea
                value={editingRule.content ?? ""}
                onChange={(e) => setEditingRule({ ...editingRule, content: e.target.value })}
                placeholder="Describe how the assistant should behave when this rule applies..."
                rows={5}
                className="mt-1 block w-full rounded-lg border border-border bg-surface p-3 text-xs leading-5 text-fg font-mono focus:border-accent focus:outline-none"
              />
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-medium text-fg">Active by default</span>
              <Switch
                checked={editingRule.enabled !== false}
                onChange={(checked) => setEditingRule({ ...editingRule, enabled: checked })}
                label="Active by default"
              />
            </div>
          </div>
        )}
      </Dialog>

      {/* Delete Rule Confirmation */}
      <ConfirmDialog
        open={!!deletingRule}
        title="Delete Rule?"
        message={`Are you sure you want to delete "${deletingRule?.title}"? This cannot be undone.`}
        confirmLabel="Delete Rule"
        onCancel={() => setDeletingRule(null)}
        onConfirm={() => deletingRule && deleteRule.mutate(deletingRule.id)}
        loading={deleteRule.isPending}
      />

      <MarketplaceDialog
        open={showMarketplace}
        onClose={() => setShowMarketplace(false)}
        initialTab="rules"
      />
    </div>
  );
}
