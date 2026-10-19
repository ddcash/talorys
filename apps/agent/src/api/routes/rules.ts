import { ruleCreateSchema, ruleUpdateSchema } from "@talorys/shared";
import { Hono } from "hono";
import type { AppEnv } from "../app";
import { body } from "../middleware";

export const rulesRoutes = new Hono<AppEnv>();

rulesRoutes.get("/rules", (c) => {
  const rules = c.env.agent.services.rules.list();
  return c.json({ rules });
});

rulesRoutes.post("/rules", async (c) => {
  const input = await body(c, ruleCreateSchema);
  const rule = c.env.agent.services.rules.create(input);
  return c.json({ rule }, 201);
});

rulesRoutes.get("/rules/:id", (c) => {
  const rule = c.env.agent.services.rules.get(c.req.param("id"));
  if (!rule) return c.json({ error: "Rule not found" }, 404);
  return c.json({ rule });
});

rulesRoutes.patch("/rules/:id", async (c) => {
  const patch = await body(c, ruleUpdateSchema);
  const rule = c.env.agent.services.rules.update(c.req.param("id"), patch);
  return c.json({ rule });
});

rulesRoutes.delete("/rules/:id", (c) => {
  c.env.agent.services.rules.delete(c.req.param("id"));
  return c.json({ deleted: true });
});
