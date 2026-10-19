import { useState } from "react";
import type { Skill, SkillCategory } from "@talorys/shared";
import { ChevronDown, ChevronUp, Cpu, Edit2, Layers, Plus, Sparkles, Trash2, Wrench } from "lucide-react";
import { Badge, Button, Card, ConfirmDialog, Dialog, Input, Spinner, Switch } from "./ui";
import { MarketplaceDialog } from "./MarketplaceDialog";
import { keys, useApiMutation, useSkills } from "../hooks/queries";
import { api } from "../lib/api";
import { cn } from "../lib/utils";

const SKILL_CATEGORIES: { id: SkillCategory; label: string }[] = [
  { id: "general", label: "General" },
  { id: "productivity", label: "Productivity" },
  { id: "coding", label: "Coding" },
  { id: "research", label: "Research" },
  { id: "data", label: "Data" },
  { id: "writing", label: "Writing" },
  { id: "automation", label: "Automation" },
];

const PRESET_SKILLS: Array<{
  name: string;
  category: SkillCategory;
  description: string;
  instructions: string;
  tools_json: string;
}> = [
  {
    name: "Deep Research & Knowledge Synthesizer",
    category: "research",
    description: "Systematically searches memories, notes, and external MCP resources before synthesizing comprehensive reports.",
    instructions:
      "When researching a topic:\n1. Search existing memories and notes first using search tools.\n2. Inquire or query connected MCP knowledge servers if relevant.\n3. Formulate conclusions with explicit supporting points.\n4. Save key discoveries to memory when instructed.",
    tools_json: JSON.stringify(["semantic_search", "notes_search", "mcp:*"]),
  },
  {
    name: "Architect & Code Reviewer",
    category: "coding",
    description: "Evaluates algorithms, security postures, edge cases, and best architecture patterns.",
    instructions:
      "When evaluating or generating technical code:\n1. Verify edge conditions, concurrency issues, and input validation.\n2. Prefer clear modular design over premature optimization.\n3. Include brief usage examples and test suggestions.",
    tools_json: JSON.stringify(["code_review"]),
  },
  {
    name: "Daily Execution Planner",
    category: "productivity",
    description: "Organizes daily objectives into structured, prioritized tasks and project milestones.",
    instructions:
      "When helping with daily execution:\n1. Review open tasks and upcoming calendar/day bounds.\n2. Propose top 3 critical priorities.\n3. Create or update tasks with clear tags and due dates.",
    tools_json: JSON.stringify(["tasks_create", "tasks_update"]),
  },
];

export function SkillsSettingsCard() {
  const skills = useSkills();
  const [showMarketplace, setShowMarketplace] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingSkill, setEditingSkill] = useState<Partial<Skill> | null>(null);
  const [deletingSkill, setDeletingSkill] = useState<Skill | null>(null);

  const createSkill = useApiMutation(
    (input: {
      name: string;
      description: string;
      instructions: string;
      category?: SkillCategory;
      tools_json?: string;
      enabled?: boolean;
    }) => api<{ skill: Skill }>("/skills", { method: "POST", body: input }),
    {
      invalidate: [keys.skills],
      success: "Skill created",
      onSuccess: () => setEditingSkill(null),
    },
  );

  const updateSkill = useApiMutation(
    ({ id, patch }: { id: string; patch: Partial<Skill> }) =>
      api<{ skill: Skill }>(`/skills/${id}`, { method: "PATCH", body: patch }),
    {
      invalidate: [keys.skills],
      success: "Skill updated",
      onSuccess: () => setEditingSkill(null),
    },
  );

  const toggleSkill = useApiMutation(
    ({ id, enabled }: { id: string; enabled: boolean }) =>
      api<{ skill: Skill }>(`/skills/${id}`, { method: "PATCH", body: { enabled } }),
    {
      invalidate: [keys.skills],
      success: (r) => `${r.skill.name} ${r.skill.enabled ? "enabled" : "disabled"}`,
    },
  );

  const deleteSkill = useApiMutation(
    (id: string) => api(`/skills/${id}`, { method: "DELETE" }),
    {
      invalidate: [keys.skills],
      success: "Skill deleted",
      onSuccess: () => setDeletingSkill(null),
    },
  );

  const skillList = skills.data ?? [];
  const filtered = skillList.filter((s) => {
    const matchesCat = selectedCategory === "all" || s.category === selectedCategory;
    const matchesSearch =
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase()) ||
      s.instructions.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const activeCount = skillList.filter((s) => s.enabled).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-fg flex items-center gap-2">
            <Cpu className="h-5 w-5 text-accent" />
            Specialized Skills
            <Badge tone="accent">{activeCount} active</Badge>
          </h2>
          <p className="text-xs text-fg-subtle mt-0.5">
            Skills furnish Talorys with domain-specific operating playbooks, workflows, and targeted tool capabilities.
          </p>
        </div>
        <div className="flex items-center gap-2">
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
            size="sm"
            onClick={() =>
              setEditingSkill({
                name: "",
                description: "",
                instructions: "",
                category: "general",
                tools_json: "[]",
                enabled: true,
              })
            }
          >
            <Plus className="h-4 w-4 mr-1" /> Add Skill
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
            All ({skillList.length})
          </button>
          {SKILL_CATEGORIES.map((c) => {
            const count = skillList.filter((s) => s.category === c.id).length;
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
            placeholder="Search skills…"
            className="h-8 text-xs"
          />
        </div>
      </div>

      {/* Preset Starter Suggestions if skills are few */}
      {skillList.length === 0 && (
        <Card className="p-4 border-dashed border-accent/40 bg-accent/5">
          <div className="flex items-center gap-2 text-sm font-medium text-accent mb-2">
            <Sparkles className="h-4 w-4" /> Recommended Starter Skills
          </div>
          <p className="text-xs text-fg-muted mb-3">
            Add pre-configured capabilities to enhance your assistant's intelligence:
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            {PRESET_SKILLS.map((p) => (
              <div
                key={p.name}
                className="p-3 bg-surface rounded-lg border border-border flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-fg">{p.name}</span>
                    <Badge tone="neutral" className="capitalize text-[10px]">
                      {p.category}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-fg-muted mt-1.5 line-clamp-3">{p.description}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3 text-xs h-7 self-start"
                  onClick={() =>
                    createSkill.mutate({
                      name: p.name,
                      category: p.category,
                      description: p.description,
                      instructions: p.instructions,
                      tools_json: p.tools_json,
                      enabled: true,
                    })
                  }
                  loading={createSkill.isPending}
                >
                  <Plus className="h-3 w-3 mr-1" /> Add Skill
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Skills List */}
      {skills.isLoading ? (
        <div className="flex justify-center p-8">
          <Spinner />
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-8 text-center text-sm text-fg-subtle">
          {search ? "No skills match your search." : "No skills in this category."}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((skill) => {
            const isExpanded = expandedId === skill.id;
            let tools: string[] = [];
            try {
              tools = JSON.parse(skill.tools_json || "[]");
            } catch {
              tools = [];
            }

            return (
              <Card key={skill.id} className="p-4 transition-all hover:border-border-strong">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-fg">{skill.name}</h3>
                      <Badge tone="neutral" className="capitalize text-[10px]">
                        {skill.category}
                      </Badge>
                      {!skill.enabled && (
                        <Badge tone="warning" className="text-[10px]">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-fg-muted leading-relaxed">{skill.description}</p>

                    {tools.length > 0 && (
                      <div className="mt-2 flex flex-wrap items-center gap-1">
                        <span className="text-[10px] text-fg-subtle flex items-center gap-0.5 mr-1">
                          <Wrench className="h-3 w-3" /> Tools:
                        </span>
                        {tools.map((t) => (
                          <span
                            key={t}
                            className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-fg-muted"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Expandable Instructions */}
                    <div className="mt-2.5">
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : skill.id)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="h-3 w-3" /> Hide instructions
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-3 w-3" /> View instructions
                          </>
                        )}
                      </button>
                      {isExpanded && (
                        <div className="mt-2 p-3 bg-subtle rounded-md border border-border/50 text-xs font-mono text-fg-muted whitespace-pre-wrap leading-relaxed animate-fade-in">
                          {skill.instructions}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={skill.enabled}
                      onChange={(checked) => toggleSkill.mutate({ id: skill.id, enabled: checked })}
                      label={`Enable ${skill.name}`}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingSkill(skill)}
                      aria-label={`Edit ${skill.name}`}
                      className="h-8 w-8 p-0"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeletingSkill(skill)}
                      aria-label={`Delete ${skill.name}`}
                      className="h-8 w-8 p-0 text-danger hover:text-danger hover:bg-danger-soft"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit / Create Skill Dialog */}
      <Dialog
        open={!!editingSkill}
        onClose={() => setEditingSkill(null)}
        title={editingSkill?.id ? "Edit Skill" : "Create New Skill"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditingSkill(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!editingSkill?.name?.trim() || !editingSkill?.instructions?.trim()) return;
                if (editingSkill.id) {
                  updateSkill.mutate({
                    id: editingSkill.id,
                    patch: {
                      name: editingSkill.name.trim(),
                      description: editingSkill.description?.trim() ?? "",
                      instructions: editingSkill.instructions.trim(),
                      category: (editingSkill.category as SkillCategory) ?? "general",
                      tools_json: editingSkill.tools_json ?? "[]",
                      enabled: editingSkill.enabled !== false,
                    },
                  });
                } else {
                  createSkill.mutate({
                    name: editingSkill.name.trim(),
                    description: editingSkill.description?.trim() ?? "",
                    instructions: editingSkill.instructions.trim(),
                    category: (editingSkill.category as SkillCategory) ?? "general",
                    tools_json: editingSkill.tools_json ?? "[]",
                    enabled: editingSkill.enabled !== false,
                  });
                }
              }}
              loading={createSkill.isPending || updateSkill.isPending}
              disabled={!editingSkill?.name?.trim() || !editingSkill?.instructions?.trim()}
            >
              {editingSkill?.id ? "Save Changes" : "Create Skill"}
            </Button>
          </>
        }
      >
        {editingSkill && (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <div>
              <label className="text-xs font-medium text-fg-subtle">Skill Name</label>
              <Input
                value={editingSkill.name ?? ""}
                onChange={(e) => setEditingSkill({ ...editingSkill, name: e.target.value })}
                placeholder="e.g. Code Reviewer"
                maxLength={80}
                className="mt-1"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-medium text-fg-subtle">Category</label>
              <select
                value={editingSkill.category ?? "general"}
                onChange={(e) =>
                  setEditingSkill({ ...editingSkill, category: e.target.value as SkillCategory })
                }
                className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:border-accent focus:outline-none"
              >
                {SKILL_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-fg-subtle">Short Description</label>
              <Input
                value={editingSkill.description ?? ""}
                onChange={(e) => setEditingSkill({ ...editingSkill, description: e.target.value })}
                placeholder="Brief summary of what this skill enables..."
                maxLength={200}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-fg-subtle">Instructions & Playbook</label>
              <textarea
                value={editingSkill.instructions ?? ""}
                onChange={(e) => setEditingSkill({ ...editingSkill, instructions: e.target.value })}
                placeholder="Step-by-step instructions the agent should follow when exercising this skill..."
                rows={6}
                className="mt-1 block w-full rounded-lg border border-border bg-surface p-3 text-xs leading-5 text-fg font-mono focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-fg-subtle">Associated Tool Names (JSON Array)</label>
              <Input
                value={editingSkill.tools_json ?? "[]"}
                onChange={(e) => setEditingSkill({ ...editingSkill, tools_json: e.target.value })}
                placeholder='e.g. ["search", "notes", "mcp:*"]'
                className="mt-1 font-mono text-xs"
              />
              <p className="mt-1 text-[11px] text-fg-subtle">
                Optional array of tool identifiers or glob patterns associated with this skill.
              </p>
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-medium text-fg">Active by default</span>
              <Switch
                checked={editingSkill.enabled !== false}
                onChange={(checked) => setEditingSkill({ ...editingSkill, enabled: checked })}
                label="Active by default"
              />
            </div>
          </div>
        )}
      </Dialog>

      {/* Delete Skill Confirmation */}
      <ConfirmDialog
        open={!!deletingSkill}
        title="Delete Skill?"
        message={`Are you sure you want to delete "${deletingSkill?.name}"? This cannot be undone.`}
        confirmLabel="Delete Skill"
        onCancel={() => setDeletingSkill(null)}
        onConfirm={() => deletingSkill && deleteSkill.mutate(deletingSkill.id)}
        loading={deleteSkill.isPending}
      />

      <MarketplaceDialog
        open={showMarketplace}
        onClose={() => setShowMarketplace(false)}
        initialTab="skills"
      />
    </div>
  );
}
