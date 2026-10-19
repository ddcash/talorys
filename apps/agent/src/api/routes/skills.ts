import { skillCreateSchema, skillUpdateSchema } from "@talorys/shared";
import { Hono } from "hono";
import type { AppEnv } from "../app";
import { body } from "../middleware";

export const skillsRoutes = new Hono<AppEnv>();

skillsRoutes.get("/skills", (c) => {
  const skills = c.env.agent.services.skills.list();
  return c.json({ skills });
});

skillsRoutes.post("/skills", async (c) => {
  const input = await body(c, skillCreateSchema);
  const skill = c.env.agent.services.skills.create(input);
  return c.json({ skill }, 201);
});

skillsRoutes.get("/skills/:id", (c) => {
  const skill = c.env.agent.services.skills.get(c.req.param("id"));
  if (!skill) return c.json({ error: "Skill not found" }, 404);
  return c.json({ skill });
});

skillsRoutes.patch("/skills/:id", async (c) => {
  const patch = await body(c, skillUpdateSchema);
  const skill = c.env.agent.services.skills.update(c.req.param("id"), patch);
  return c.json({ skill });
});

skillsRoutes.delete("/skills/:id", (c) => {
  c.env.agent.services.skills.delete(c.req.param("id"));
  return c.json({ deleted: true });
});
