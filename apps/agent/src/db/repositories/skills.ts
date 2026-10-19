import type { Skill, SkillCategory } from "@talorys/shared";
import { type Database, newId, now } from "../database";
import { NotFoundError } from "../../api/errors";

interface SkillRow {
  id: string;
  name: string;
  description: string;
  instructions: string;
  tools_json: string;
  category: SkillCategory;
  enabled: number;
  created_at: string;
  updated_at: string;
}

function rowToSkill(r: SkillRow): Skill {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    instructions: r.instructions,
    tools_json: r.tools_json || "[]",
    category: r.category,
    enabled: Boolean(r.enabled),
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export class SkillsRepository {
  constructor(private readonly db: Database) {}

  list(): Skill[] {
    const rows = this.db.all<SkillRow>("SELECT * FROM tal_skills ORDER BY created_at ASC");
    return rows.map(rowToSkill);
  }

  listActive(): Skill[] {
    const rows = this.db.all<SkillRow>("SELECT * FROM tal_skills WHERE enabled = 1 ORDER BY category ASC, created_at ASC");
    return rows.map(rowToSkill);
  }

  get(id: string): Skill | null {
    const row = this.db.one<SkillRow>("SELECT * FROM tal_skills WHERE id = ?", id);
    return row ? rowToSkill(row) : null;
  }

  create(data: {
    name: string;
    description: string;
    instructions: string;
    tools_json?: string;
    category?: SkillCategory;
    enabled?: boolean;
  }): Skill {
    const id = newId();
    const timestamp = now();
    const category = data.category ?? "general";
    const tools_json = data.tools_json ?? "[]";
    const enabled = data.enabled !== false ? 1 : 0;

    this.db.run(
      `INSERT INTO tal_skills (id, name, description, instructions, tools_json, category, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      data.name,
      data.description,
      data.instructions,
      tools_json,
      category,
      enabled,
      timestamp,
      timestamp,
    );

    return {
      id,
      name: data.name,
      description: data.description,
      instructions: data.instructions,
      tools_json,
      category,
      enabled: Boolean(enabled),
      created_at: timestamp,
      updated_at: timestamp,
    };
  }

  update(id: string, patch: Partial<{
    name: string;
    description: string;
    instructions: string;
    tools_json: string;
    category: SkillCategory;
    enabled: boolean;
  }>): Skill {
    const current = this.get(id);
    if (!current) throw new NotFoundError("Skill not found");

    const name = patch.name ?? current.name;
    const description = patch.description ?? current.description;
    const instructions = patch.instructions ?? current.instructions;
    const tools_json = patch.tools_json ?? current.tools_json;
    const category = patch.category ?? current.category;
    const enabled = patch.enabled !== undefined ? (patch.enabled ? 1 : 0) : current.enabled ? 1 : 0;
    const timestamp = now();

    this.db.run(
      `UPDATE tal_skills SET name = ?, description = ?, instructions = ?, tools_json = ?, category = ?, enabled = ?, updated_at = ? WHERE id = ?`,
      name,
      description,
      instructions,
      tools_json,
      category,
      enabled,
      timestamp,
      id,
    );

    return {
      id,
      name,
      description,
      instructions,
      tools_json,
      category,
      enabled: Boolean(enabled),
      created_at: current.created_at,
      updated_at: timestamp,
    };
  }

  delete(id: string): void {
    const res = this.db.run("DELETE FROM tal_skills WHERE id = ?", id);
    if (res.changes === 0) throw new NotFoundError("Skill not found");
  }
}
