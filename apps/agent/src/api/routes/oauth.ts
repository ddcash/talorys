import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app";
import { body } from "../middleware";

export const oauthRoutes = new Hono<AppEnv>();

/**
 * Saves and validates OAuth tokens for Claude (Anthropic) or Antigravity / Gemini (Google)
 */
oauthRoutes.post("/oauth/token", async (c) => {
  const { provider, token, refresh_token } = await body(
    c,
    z.object({
      provider: z.enum(["anthropic", "gemini"]),
      token: z.string().min(1).max(4096),
      refresh_token: z.string().max(4096).optional(),
    }),
  );

  const s = c.env.agent.services;
  const current = s.settings.get();
  const externalKeys = { ...current.externalKeys };

  if (provider === "anthropic") {
    externalKeys.anthropicOAuthToken = token.trim();
  } else if (provider === "gemini") {
    externalKeys.googleOAuthToken = token.trim();
    if (refresh_token) externalKeys.googleRefreshToken = refresh_token.trim();
  }

  const updated = s.settings.update({ externalKeys });
  s.activity.record("settings.oauth", `Updated ${provider} OAuth credentials`);

  return c.json({
    success: true,
    provider,
    connected: true,
    settings: updated,
  });
});

/** Disconnects OAuth for a provider */
oauthRoutes.post("/oauth/disconnect", async (c) => {
  const { provider } = await body(c, z.object({ provider: z.enum(["anthropic", "gemini"]) }));
  const s = c.env.agent.services;
  const current = s.settings.get();
  const externalKeys = { ...current.externalKeys };

  if (provider === "anthropic") {
    delete externalKeys.anthropicOAuthToken;
  } else if (provider === "gemini") {
    delete externalKeys.googleOAuthToken;
    delete externalKeys.googleRefreshToken;
  }

  const updated = s.settings.update({ externalKeys });
  s.activity.record("settings.oauth", `Disconnected ${provider} OAuth`);

  return c.json({ success: true, provider, connected: false, settings: updated });
});
