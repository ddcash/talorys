import type { Rule, RuleCategory } from "@talorys/shared";
import { type Database, newId, now } from "../database";
import { NotFoundError } from "../../api/errors";

interface RuleRow {
  id: string;
  title: string;
  content: string;
  category: RuleCategory;
  enabled: number;
  created_at: string;
  updated_at: string;
}

function rowToRule(r: RuleRow): Rule {
  return {
    id: r.id,
    title: r.title,
    content: r.content,
    category: r.category,
    enabled: Boolean(r.enabled),
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export class RulesRepository {
  constructor(private readonly db: Database) {}

  list(): Rule[] {
    const rows = this.db.all<RuleRow>("SELECT * FROM tal_rules ORDER BY created_at ASC");
    return rows.map(rowToRule);
  }

  listActive(): Rule[] {
    const rows = this.db.all<RuleRow>("SELECT * FROM tal_rules WHERE enabled = 1 ORDER BY category ASC, created_at ASC");
    return rows.map(rowToRule);
  }

  get(id: string): Rule | null {
    const row = this.db.one<RuleRow>("SELECT * FROM tal_rules WHERE id = ?", id);
    return row ? rowToRule(row) : null;
  }

  create(data: {
    title: string;
    content: string;
    category?: RuleCategory;
    enabled?: boolean;
  }): Rule {
    const id = newId();
    const timestamp = now();
    const category = data.category ?? "general";
    const enabled = data.enabled !== false ? 1 : 0;

    this.db.run(
      `INSERT INTO tal_rules (id, title, content, category, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      id,
      data.title,
      data.content,
      category,
      enabled,
      timestamp,
      timestamp,
    );

    return {
      id,
      title: data.title,
      content: data.content,
      category,
      enabled: Boolean(enabled),
      created_at: timestamp,
      updated_at: timestamp,
    };
  }

  update(id: string, patch: Partial<{ title: string; content: string; category: RuleCategory; enabled: boolean }>): Rule {
    const current = this.get(id);
    if (!current) throw new NotFoundError("Rule not found");

    const title = patch.title ?? current.title;
    const content = patch.content ?? current.content;
    const category = patch.category ?? current.category;
    const enabled = patch.enabled !== undefined ? (patch.enabled ? 1 : 0) : current.enabled ? 1 : 0;
    const timestamp = now();

    this.db.run(
      `UPDATE tal_rules SET title = ?, content = ?, category = ?, enabled = ?, updated_at = ? WHERE id = ?`,
      title,
      content,
      category,
      enabled,
      timestamp,
      id,
    );

    return {
      id,
      title,
      content,
      category,
      enabled: Boolean(enabled),
      created_at: current.created_at,
      updated_at: timestamp,
    };
  }

  delete(id: string): void {
    const res = this.db.run("DELETE FROM tal_rules WHERE id = ?", id);
    if (res.changes === 0) throw new NotFoundError("Rule not found");
  }
}
