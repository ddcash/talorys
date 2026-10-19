import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app";
import { body } from "../middleware";

export const oauthRoutes = new Hono<AppEnv>();

const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/generative-language",
  "https://www.googleapis.com/auth/cloud-platform",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

/**
 * Returns current OAuth status and metadata for Claude and Google/Antigravity
 */
oauthRoutes.get("/oauth/status", async (c) => {
  const s = c.env.agent.services;
  const current = s.settings.get();
  const keys = { ...current.externalKeys };

  // Sanitize test client IDs if present
  if (keys.googleClientId?.includes("test-client-id")) {
    delete keys.googleClientId;
    delete keys.googleClientSecret;
    s.settings.update({ externalKeys: keys });
  }

  const validGoogleClientId = keys.googleClientId && !keys.googleClientId.includes("test-client-id");

  return c.json({
    google: {
      connected: Boolean(keys.googleOAuthToken),
      email: keys.googleUserEmail ?? null,
      hasRefreshToken: Boolean(keys.googleRefreshToken),
      tokenExpiry: keys.googleTokenExpiry ?? null,
      hasClientConfig: Boolean(validGoogleClientId && keys.googleClientSecret),
      clientId: validGoogleClientId ? `${keys.googleClientId!.slice(0, 16)}...` : null,
    },
    claude: {
      connected: Boolean(keys.anthropicOAuthToken),
      hasRefreshToken: Boolean(keys.anthropicOAuthRefreshToken),
      hasClientConfig: Boolean(keys.anthropicClientId && keys.anthropicClientSecret),
    },
  });
});

/**
 * Generates a Google OAuth authorization URL for the user to sign in
 */
oauthRoutes.post("/oauth/google/auth-url", async (c) => {
  const { redirect_uri, client_id, client_secret } = await body(
    c,
    z.object({
      redirect_uri: z.string().url(),
      client_id: z.string().min(1).optional(),
      client_secret: z.string().min(1).optional(),
    }),
  );

  const s = c.env.agent.services;
  const current = s.settings.get();
  const keys = { ...current.externalKeys };

  // Sanitize test client IDs
  if (keys.googleClientId?.includes("test-client-id")) {
    delete keys.googleClientId;
    delete keys.googleClientSecret;
  }

  const effectiveClientId = (client_id && !client_id.includes("test-client-id"))
    ? client_id.trim()
    : (keys.googleClientId && !keys.googleClientId.includes("test-client-id") ? keys.googleClientId : undefined);

  if (!effectiveClientId) {
    return c.json(
      { error: "Google OAuth Client ID is required. Please paste your Client ID from Google Cloud Console." },
      400,
    );
  }

  // Save client_id and client_secret if valid
  if (client_id || client_secret) {
    if (client_id && !client_id.includes("test-client-id")) keys.googleClientId = client_id.trim();
    if (client_secret) keys.googleClientSecret = client_secret.trim();
    s.settings.update({ externalKeys: keys });
  }

  const state = Math.random().toString(36).substring(2, 15);

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", effectiveClientId);
  authUrl.searchParams.set("redirect_uri", redirect_uri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", GOOGLE_SCOPES);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("state", state);

  return c.json({
    url: authUrl.toString(),
    state,
    client_id: effectiveClientId,
  });
});

/**
 * Exchanges Google OAuth authorization code for access & refresh tokens
 */
oauthRoutes.post("/oauth/google/exchange", async (c) => {
  const { code, redirect_uri, client_id, client_secret } = await body(
    c,
    z.object({
      code: z.string().min(1),
      redirect_uri: z.string().url(),
      client_id: z.string().optional(),
      client_secret: z.string().optional(),
    }),
  );

  const s = c.env.agent.services;
  const current = s.settings.get();
  const keys = { ...current.externalKeys };

  const effectiveClientId = client_id || keys.googleClientId;
  const effectiveClientSecret = client_secret || keys.googleClientSecret;

  if (!effectiveClientId || !effectiveClientSecret) {
    return c.json(
      { error: "Google Client ID and Client Secret are required to exchange authorization code." },
      400,
    );
  }

  try {
    const tokenParams = new URLSearchParams({
      code,
      client_id: effectiveClientId,
      client_secret: effectiveClientSecret,
      redirect_uri,
      grant_type: "authorization_code",
    });

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenParams.toString(),
    });

    const tokenData = await tokenRes.json<any>();

    if (!tokenRes.ok || !tokenData.access_token) {
      return c.json(
        { error: tokenData.error_description || tokenData.error || "Failed to exchange code with Google" },
        400,
      );
    }

    // Try to get user email
    let email: string | null = null;
    try {
      const userRes = await fetch("https://www.googleapis.com/oauth2/v1/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (userRes.ok) {
        const userData = await userRes.json<any>();
        email = userData.email || null;
      }
    } catch {
      // Ignore userinfo failure
    }

    // Update settings with tokens
    keys.googleOAuthToken = tokenData.access_token;
    if (tokenData.refresh_token) {
      keys.googleRefreshToken = tokenData.refresh_token;
    }
    keys.googleClientId = effectiveClientId;
    keys.googleClientSecret = effectiveClientSecret;
    if (tokenData.expires_in) {
      keys.googleTokenExpiry = Date.now() + tokenData.expires_in * 1000;
    }
    if (email) {
      keys.googleUserEmail = email;
    }

    const updated = s.settings.update({ externalKeys: keys });
    s.activity.record("settings.oauth", `Google/Antigravity OAuth connected for ${email || "user"}`);

    return c.json({
      success: true,
      provider: "gemini",
      connected: true,
      email,
      expires_in: tokenData.expires_in,
      settings: updated,
    });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Exchange network error" }, 500);
  }
});

/**
 * Validates a Google OAuth token and returns token info & email
 */
oauthRoutes.post("/oauth/google/validate-token", async (c) => {
  const { token, save } = await body(
    c,
    z.object({
      token: z.string().min(1),
      save: z.boolean().optional(),
    }),
  );

  const clean = token.trim().replace(/^Bearer\s+/i, "");

  try {
    const res = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${encodeURIComponent(clean)}`);
    const data = await res.json<any>();

    if (!res.ok || data.error) {
      return c.json({
        valid: false,
        error: data.error_description || data.error || "Invalid or expired token",
      });
    }

    if (save) {
      const s = c.env.agent.services;
      const current = s.settings.get();
      const keys = { ...current.externalKeys };
      keys.googleOAuthToken = clean;
      if (data.email) keys.googleUserEmail = data.email;
      if (data.expires_in) keys.googleTokenExpiry = Date.now() + data.expires_in * 1000;
      s.settings.update({ externalKeys: keys });
      s.activity.record("settings.oauth", `Saved Google OAuth token for ${data.email || "user"}`);
    }

    return c.json({
      valid: true,
      email: data.email || null,
      scope: data.scope || null,
      expires_in: data.expires_in || null,
    });
  } catch (err) {
    return c.json({ valid: false, error: err instanceof Error ? err.message : "Token validation request failed" });
  }
});

/**
 * Generates a Claude / Anthropic OAuth authorization URL
 */
oauthRoutes.post("/oauth/claude/auth-url", async (c) => {
  const { redirect_uri, client_id, client_secret } = await body(
    c,
    z.object({
      redirect_uri: z.string().url(),
      client_id: z.string().min(1).optional(),
      client_secret: z.string().min(1).optional(),
    }),
  );

  const s = c.env.agent.services;
  const current = s.settings.get();
  const keys = { ...current.externalKeys };

  const effectiveClientId = client_id || keys.anthropicClientId;
  if (!effectiveClientId) {
    return c.json(
      { error: "Anthropic Claude Client ID is required to initiate OAuth flow." },
      400,
    );
  }

  if (client_id || client_secret) {
    if (client_id) keys.anthropicClientId = client_id.trim();
    if (client_secret) keys.anthropicClientSecret = client_secret.trim();
    s.settings.update({ externalKeys: keys });
  }

  const state = Math.random().toString(36).substring(2, 15);
  const authUrl = new URL("https://console.anthropic.com/oauth/authorize");
  authUrl.searchParams.set("client_id", effectiveClientId);
  authUrl.searchParams.set("redirect_uri", redirect_uri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "messages:write");
  authUrl.searchParams.set("state", state);

  return c.json({
    url: authUrl.toString(),
    state,
    client_id: effectiveClientId,
  });
});

/**
 * Exchanges Claude authorization code for tokens
 */
oauthRoutes.post("/oauth/claude/exchange", async (c) => {
  const { code, redirect_uri, client_id, client_secret } = await body(
    c,
    z.object({
      code: z.string().min(1),
      redirect_uri: z.string().url(),
      client_id: z.string().optional(),
      client_secret: z.string().optional(),
    }),
  );

  const s = c.env.agent.services;
  const current = s.settings.get();
  const keys = { ...current.externalKeys };

  const effectiveClientId = client_id || keys.anthropicClientId;
  const effectiveClientSecret = client_secret || keys.anthropicClientSecret;

  if (!effectiveClientId || !effectiveClientSecret) {
    return c.json(
      { error: "Claude Client ID and Client Secret are required to exchange authorization code." },
      400,
    );
  }

  try {
    const tokenRes = await fetch("https://api.anthropic.com/v1/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: effectiveClientId,
        client_secret: effectiveClientSecret,
        redirect_uri,
        grant_type: "authorization_code",
      }).toString(),
    });

    const tokenData = await tokenRes.json<any>();

    if (!tokenRes.ok || !tokenData.access_token) {
      return c.json(
        { error: tokenData.error_description || tokenData.error || "Failed to exchange code with Anthropic" },
        400,
      );
    }

    keys.anthropicOAuthToken = tokenData.access_token;
    if (tokenData.refresh_token) keys.anthropicOAuthRefreshToken = tokenData.refresh_token;
    keys.anthropicClientId = effectiveClientId;
    keys.anthropicClientSecret = effectiveClientSecret;

    const updated = s.settings.update({ externalKeys: keys });
    s.activity.record("settings.oauth", "Claude OAuth connected");

    return c.json({
      success: true,
      provider: "anthropic",
      connected: true,
      settings: updated,
    });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Exchange network error" }, 500);
  }
});

/**
 * Validates a Claude / Anthropic OAuth Bearer token
 */
oauthRoutes.post("/oauth/claude/validate-token", async (c) => {
  const { token, save } = await body(
    c,
    z.object({
      token: z.string().min(1),
      save: z.boolean().optional(),
    }),
  );

  const clean = token.trim().replace(/^Bearer\s+/i, "");

  try {
    // Send lightweight test ping to Anthropic API
    const res = await fetch("https://api.anthropic.com/v1/models", {
      headers: {
        Authorization: `Bearer ${clean}`,
        "anthropic-version": "2023-06-01",
        "anthropic-client": "claude-code",
        "User-Agent": "claude-code/0.2.29",
      },
    });

    const data = await res.json<any>().catch(() => ({}));
    if (res.status === 401 || res.status === 403 || data.error?.type === "authentication_error") {
      return c.json({
        valid: false,
        error: data.error?.message || "Authentication failed. Token is invalid, expired, or unauthorized.",
      });
    }

    if (save) {
      const s = c.env.agent.services;
      const current = s.settings.get();
      const keys = { ...current.externalKeys };
      keys.anthropicOAuthToken = clean;
      s.settings.update({ externalKeys: keys });
      s.activity.record("settings.oauth", "Saved Claude OAuth token");
    }

    return c.json({ valid: true, status: res.status });
  } catch (err) {
    return c.json({ valid: false, error: err instanceof Error ? err.message : "Validation ping failed" });
  }
});

/**
 * Direct token saver
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

/**
 * Disconnects OAuth for a provider
 */
oauthRoutes.post("/oauth/disconnect", async (c) => {
  const { provider } = await body(c, z.object({ provider: z.enum(["anthropic", "gemini"]) }));
  const s = c.env.agent.services;
  const current = s.settings.get();
  const externalKeys = { ...current.externalKeys };

  if (provider === "anthropic") {
    delete externalKeys.anthropicOAuthToken;
    delete externalKeys.anthropicOAuthRefreshToken;
    delete externalKeys.anthropicClientId;
    delete externalKeys.anthropicClientSecret;
  } else if (provider === "gemini") {
    delete externalKeys.googleOAuthToken;
    delete externalKeys.googleRefreshToken;
    delete externalKeys.googleClientId;
    delete externalKeys.googleClientSecret;
    delete externalKeys.googleTokenExpiry;
    delete externalKeys.googleUserEmail;
  }

  const updated = s.settings.update({ externalKeys });
  s.activity.record("settings.oauth", `Disconnected ${provider} OAuth`);

  return c.json({ success: true, provider, connected: false, settings: updated });
});
