import { useState, useEffect } from "react";
import {
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Globe,
  Key,
  Lock,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Trash2,
  X,
} from "lucide-react";
import { Badge, Button, Dialog, Input, Spinner } from "./ui";
import { api } from "../lib/api";
import { keys, useApiMutation, useOAuthStatus } from "../hooks/queries";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "../lib/utils";

interface OAuthConnectModalProps {
  open: boolean;
  onClose: () => void;
  initialProvider?: "gemini" | "anthropic";
}

export function OAuthConnectModal({
  open,
  onClose,
  initialProvider = "gemini",
}: OAuthConnectModalProps) {
  const queryClient = useQueryClient();
  const oauthStatus = useOAuthStatus();
  const [activeTab, setActiveTab] = useState<"gemini" | "anthropic">(initialProvider);

  // Sync tab with initialProvider when modal opens
  useEffect(() => {
    if (open) setActiveTab(initialProvider);
  }, [open, initialProvider]);

  // Google OAuth Form State
  const [googleClientId, setGoogleClientId] = useState("");
  const [googleClientSecret, setGoogleClientSecret] = useState("");
  const [googleCliToken, setGoogleCliToken] = useState("");
  const [googleMethod, setGoogleMethod] = useState<"web" | "cli">("web");
  const [googleValidating, setGoogleValidating] = useState(false);
  const [googleValResult, setGoogleValResult] = useState<{ valid: boolean; email?: string; error?: string } | null>(null);

  // Claude OAuth Form State
  const [claudeClientId, setClaudeClientId] = useState("");
  const [claudeClientSecret, setClaudeClientSecret] = useState("");
  const [claudeBearerToken, setClaudeBearerToken] = useState("");
  const [claudeMethod, setClaudeMethod] = useState<"web" | "token">("token");
  const [claudeValidating, setClaudeValidating] = useState(false);
  const [claudeValResult, setClaudeValResult] = useState<{ valid: boolean; error?: string } | null>(null);

  const [copiedUri, setCopiedUri] = useState(false);
  const [copiedCli, setCopiedCli] = useState(false);

  const redirectUri = typeof window !== "undefined" ? `${window.location.origin}/settings?tab=ai` : "";

  // Disconnect Mutation
  const disconnectMutation = useApiMutation(
    (provider: "gemini" | "anthropic") =>
      api<{ success: boolean }>("/oauth/disconnect", { method: "POST", body: { provider } }),
    {
      invalidate: [keys.oauthStatus, keys.settings],
      success: "OAuth credentials disconnected",
    },
  );

  // Copy helper
  const copyToClipboard = (text: string, type: "uri" | "cli") => {
    navigator.clipboard.writeText(text);
    if (type === "uri") {
      setCopiedUri(true);
      setTimeout(() => setCopiedUri(false), 2000);
    } else {
      setCopiedCli(true);
      setTimeout(() => setCopiedCli(false), 2000);
    }
  };

  // Google: Launch Web OAuth Sign-in
  const handleStartGoogleOAuth = async () => {
    if (!googleClientId.trim()) {
      setGoogleValResult({
        valid: false,
        error: "Google OAuth Client ID is required. Please paste your Client ID from Google Cloud Console, or switch to the 'Instant CLI Token' tab above to connect immediately.",
      });
      return;
    }

    try {
      setGoogleValidating(true);
      setGoogleValResult(null);
      const res = await api<{ url: string }>("/oauth/google/auth-url", {
        method: "POST",
        body: {
          redirect_uri: redirectUri,
          client_id: googleClientId.trim(),
          client_secret: googleClientSecret.trim() || undefined,
        },
      });

      if (res.url) {
        // Save state to localStorage to handle return
        localStorage.setItem("talorys_oauth_pending", JSON.stringify({ provider: "gemini", redirectUri }));
        window.location.href = res.url;
      }
    } catch (err) {
      setGoogleValResult({ valid: false, error: err instanceof Error ? err.message : "Failed to start OAuth" });
    } finally {
      setGoogleValidating(false);
    }
  };

  // Google: Validate and Save CLI Token
  const handleVerifyGoogleCliToken = async () => {
    if (!googleCliToken.trim()) return;
    setGoogleValidating(true);
    setGoogleValResult(null);

    try {
      const res = await api<{ valid: boolean; email?: string; error?: string }>("/oauth/google/validate-token", {
        method: "POST",
        body: { token: googleCliToken.trim(), save: true },
      });

      setGoogleValResult(res);
      if (res.valid) {
        queryClient.invalidateQueries({ queryKey: keys.oauthStatus });
        queryClient.invalidateQueries({ queryKey: keys.settings });
      }
    } catch (err) {
      setGoogleValResult({ valid: false, error: err instanceof Error ? err.message : "Validation failed" });
    } finally {
      setGoogleValidating(false);
    }
  };

  // Claude: Launch Web OAuth
  const handleStartClaudeOAuth = async () => {
    try {
      setClaudeValidating(true);
      const res = await api<{ url: string }>("/oauth/claude/auth-url", {
        method: "POST",
        body: {
          redirect_uri: redirectUri,
          client_id: claudeClientId.trim() || undefined,
          client_secret: claudeClientSecret.trim() || undefined,
        },
      });

      if (res.url) {
        localStorage.setItem("talorys_oauth_pending", JSON.stringify({ provider: "anthropic", redirectUri }));
        window.location.href = res.url;
      }
    } catch (err) {
      setClaudeValResult({ valid: false, error: err instanceof Error ? err.message : "Failed to start Claude OAuth" });
    } finally {
      setClaudeValidating(false);
    }
  };

  // Claude: Verify & Save Bearer Token
  const handleVerifyClaudeBearer = async () => {
    if (!claudeBearerToken.trim()) return;
    setClaudeValidating(true);
    setClaudeValResult(null);

    try {
      const res = await api<{ valid: boolean; error?: string }>("/oauth/claude/validate-token", {
        method: "POST",
        body: { token: claudeBearerToken.trim(), save: true },
      });

      setClaudeValResult(res);
      if (res.valid) {
        queryClient.invalidateQueries({ queryKey: keys.oauthStatus });
        queryClient.invalidateQueries({ queryKey: keys.settings });
      }
    } catch (err) {
      setClaudeValResult({ valid: false, error: err instanceof Error ? err.message : "Validation failed" });
    } finally {
      setClaudeValidating(false);
    }
  };

  const gStatus = oauthStatus.data?.google;
  const cStatus = oauthStatus.data?.claude;

  return (
    <Dialog open={open} onClose={onClose} title="AI OAuth Authentication Setup" wide>
      <div className="space-y-4 pt-1">
        <p className="text-xs text-fg-subtle -mt-2 mb-2">
          Connect Google / Antigravity and Claude using OAuth without needing raw API keys.
        </p>

        {/* Provider Tabs */}
        <div className="flex rounded-xl border border-border bg-subtle p-1">
          <button
            type="button"
            onClick={() => setActiveTab("gemini")}
            className={cn(
              "flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2",
              activeTab === "gemini" ? "bg-surface text-fg shadow-xs" : "text-fg-subtle hover:text-fg"
            )}
          >
            Google / Antigravity
            {gStatus?.connected && <span className="h-2 w-2 rounded-full bg-emerald-500" />}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("anthropic")}
            className={cn(
              "flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2",
              activeTab === "anthropic" ? "bg-surface text-fg shadow-xs" : "text-fg-subtle hover:text-fg"
            )}
          >
            Anthropic Claude
            {cStatus?.connected && <span className="h-2 w-2 rounded-full bg-emerald-500" />}
          </button>
        </div>

        {/* TAB 1: GOOGLE / ANTIGRAVITY */}
        {activeTab === "gemini" && (
          <div className="space-y-4">
            {/* Active Status Banner */}
            {gStatus?.connected ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span className="text-xs font-semibold text-fg">Google / Antigravity Connected</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => disconnectMutation.mutate("gemini")}
                    loading={disconnectMutation.isPending}
                    className="h-7 text-xs text-danger hover:bg-danger/10"
                  >
                    <Trash2 className="h-3 w-3 mr-1" /> Disconnect
                  </Button>
                </div>
                <div className="text-[11px] text-fg-subtle flex flex-wrap gap-x-4 gap-y-1">
                  {gStatus.email && <span>Account: <strong className="text-fg">{gStatus.email}</strong></span>}
                  <span>Auto-Refresh: <strong className="text-emerald-500">{gStatus.hasRefreshToken ? "Active" : "Standard"}</strong></span>
                  {gStatus.tokenExpiry && (
                    <span>Expires in: {Math.max(0, Math.round((gStatus.tokenExpiry - Date.now()) / 60000))}m</span>
                  )}
                </div>
              </div>
            ) : null}

            {/* Method Chooser */}
            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="text-xs font-medium text-fg">Connection Method:</span>
              <div className="flex gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => setGoogleMethod("web")}
                  className={cn(
                    "px-2.5 py-1 rounded-md transition-colors",
                    googleMethod === "web" ? "bg-accent text-white font-medium" : "text-fg-subtle hover:text-fg"
                  )}
                >
                  <Globe className="h-3.5 w-3.5 inline mr-1" /> Web OAuth Flow
                </button>
                <button
                  type="button"
                  onClick={() => setGoogleMethod("cli")}
                  className={cn(
                    "px-2.5 py-1 rounded-md transition-colors",
                    googleMethod === "cli" ? "bg-accent text-white font-medium" : "text-fg-subtle hover:text-fg"
                  )}
                >
                  <Terminal className="h-3.5 w-3.5 inline mr-1" /> Instant CLI Token
                </button>
              </div>
            </div>

            {/* Method A: Web OAuth */}
            {googleMethod === "web" && (
              <div className="space-y-3">
                <div className="rounded-lg bg-subtle p-3 space-y-2 border border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-fg">1. Authorized Redirect URI</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(redirectUri, "uri")}
                      className="text-[10px] text-accent hover:underline flex items-center gap-1"
                    >
                      {copiedUri ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                      {copiedUri ? "Copied" : "Copy URI"}
                    </button>
                  </div>
                  <p className="font-mono text-[10px] text-fg-subtle break-all bg-surface p-1.5 rounded border border-border">
                    {redirectUri}
                  </p>
                  <div className="text-[10px] text-fg-subtle space-y-1">
                    <p>
                      <strong>How to get your Client ID:</strong>
                    </p>
                    <ol className="list-decimal pl-4 space-y-0.5">
                      <li>
                        Go to{" "}
                        <a
                          href="https://console.cloud.google.com/apis/credentials"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent underline font-medium inline-flex items-center gap-0.5"
                        >
                          Google Cloud Console Credentials <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      </li>
                      <li>Click <strong>Create Credentials &gt; OAuth client ID</strong></li>
                      <li>Select Application type: <strong>Web application</strong></li>
                      <li>Add the <strong>Authorized redirect URI</strong> copied above</li>
                      <li>Copy your Client ID and Client Secret and paste below</li>
                    </ol>
                  </div>
                </div>

                {googleValResult?.error && (
                  <div className="rounded-lg bg-danger/10 border border-danger/20 p-2.5 text-xs text-danger">
                    {googleValResult.error}
                  </div>
                )}

                <div className="space-y-2">
                  <div>
                    <label className="text-xs font-medium text-fg flex items-center justify-between">
                      <span>Google OAuth Client ID <span className="text-danger">*</span></span>
                    </label>
                    <Input
                      value={googleClientId}
                      onChange={(e) => {
                        setGoogleClientId(e.target.value);
                        if (googleValResult?.error) setGoogleValResult(null);
                      }}
                      placeholder="e.g. 123456789-abc.apps.googleusercontent.com"
                      className="mt-1 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-fg">Google OAuth Client Secret</label>
                    <Input
                      type="password"
                      value={googleClientSecret}
                      onChange={(e) => setGoogleClientSecret(e.target.value)}
                      placeholder="GOCSPX-..."
                      className="mt-1 font-mono text-xs"
                    />
                  </div>
                </div>

                <Button
                  onClick={handleStartGoogleOAuth}
                  loading={googleValidating}
                  disabled={!googleClientId.trim()}
                  className="w-full text-xs"
                >
                  Sign in with Google / Antigravity
                </Button>

                <div className="rounded-lg bg-accent/5 border border-accent/20 p-2.5 text-[11px] text-fg-subtle">
                  💡 <strong>Faster Alternative:</strong> Switch to the <strong>Instant CLI Token</strong> tab above to connect immediately without setting up a Google Cloud project, or grab a free API key from{" "}
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent underline font-medium"
                  >
                    Google AI Studio
                  </a>.
                </div>
              </div>
            )}

            {/* Method B: Fast CLI Token */}
            {googleMethod === "cli" && (
              <div className="space-y-3">
                <div className="rounded-lg bg-subtle p-3 space-y-2 border border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-fg">Run this command in your terminal:</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard("gcloud auth print-access-token", "cli")}
                      className="text-[10px] text-accent hover:underline flex items-center gap-1"
                    >
                      {copiedCli ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                      {copiedCli ? "Copied" : "Copy Command"}
                    </button>
                  </div>
                  <div className="bg-surface p-2 rounded border border-border font-mono text-xs text-accent">
                    gcloud auth print-access-token
                  </div>
                  <p className="text-[10px] text-fg-subtle">
                    Generates a valid Google OAuth token directly from your local gcloud SDK or Antigravity login.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-medium text-fg">Paste Generated Access Token (ya29...)</label>
                  <Input
                    type="password"
                    value={googleCliToken}
                    onChange={(e) => setGoogleCliToken(e.target.value)}
                    placeholder="ya29.a0AfH6SM..."
                    className="mt-1 font-mono text-xs"
                  />
                </div>

                {googleValResult && (
                  <div
                    className={cn(
                      "p-2.5 rounded-lg text-xs flex items-center gap-2",
                      googleValResult.valid ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" : "bg-danger/10 text-danger border border-danger/20"
                    )}
                  >
                    {googleValResult.valid ? (
                      <>
                        <Check className="h-4 w-4 shrink-0" />
                        <span>Connected successfully as <strong>{googleValResult.email}</strong>!</span>
                      </>
                    ) : (
                      <>
                        <ShieldAlert className="h-4 w-4 shrink-0" />
                        <span>{googleValResult.error || "Invalid token"}</span>
                      </>
                    )}
                  </div>
                )}

                <Button
                  onClick={handleVerifyGoogleCliToken}
                  loading={googleValidating}
                  disabled={!googleCliToken.trim()}
                  className="w-full text-xs"
                >
                  Verify &amp; Connect Token
                </Button>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ANTHROPIC CLAUDE */}
        {activeTab === "anthropic" && (
          <div className="space-y-4">
            {/* Active Status Banner */}
            {cStatus?.connected ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span className="text-xs font-semibold text-fg">Anthropic Claude Connected</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => disconnectMutation.mutate("anthropic")}
                    loading={disconnectMutation.isPending}
                    className="h-7 text-xs text-danger hover:bg-danger/10"
                  >
                    <Trash2 className="h-3 w-3 mr-1" /> Disconnect
                  </Button>
                </div>
                <p className="text-[11px] text-fg-subtle">
                  Claude requests will use Authorization: Bearer OAuth token headers automatically.
                </p>
              </div>
            ) : null}

            {/* Method Chooser */}
            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="text-xs font-medium text-fg">Connection Method:</span>
              <div className="flex gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => setClaudeMethod("token")}
                  className={cn(
                    "px-2.5 py-1 rounded-md transition-colors",
                    claudeMethod === "token" ? "bg-accent text-white font-medium" : "text-fg-subtle hover:text-fg"
                  )}
                >
                  <Key className="h-3.5 w-3.5 inline mr-1" /> OAuth Bearer Token
                </button>
                <button
                  type="button"
                  onClick={() => setClaudeMethod("web")}
                  className={cn(
                    "px-2.5 py-1 rounded-md transition-colors",
                    claudeMethod === "web" ? "bg-accent text-white font-medium" : "text-fg-subtle hover:text-fg"
                  )}
                >
                  <Globe className="h-3.5 w-3.5 inline mr-1" /> Custom OAuth App
                </button>
              </div>
            </div>

            {/* Method A: Bearer Token Importer */}
            {claudeMethod === "token" && (
              <div className="space-y-3">
                <div className="rounded-lg bg-subtle p-3 space-y-1.5 border border-border">
                  <span className="text-[11px] font-semibold text-fg">Claude OAuth Bearer Token</span>
                  <p className="text-[10px] text-fg-subtle">
                    Paste your Claude OAuth user token or Claude Workspace Bearer token. Talorys sends requests with official Claude OAuth headers without an API key.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-medium text-fg">Claude OAuth Token</label>
                  <Input
                    type="password"
                    value={claudeBearerToken}
                    onChange={(e) => setClaudeBearerToken(e.target.value)}
                    placeholder="sk-ant-... or Bearer token"
                    className="mt-1 font-mono text-xs"
                  />
                </div>

                {claudeValResult && (
                  <div
                    className={cn(
                      "p-2.5 rounded-lg text-xs flex items-center gap-2",
                      claudeValResult.valid ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" : "bg-danger/10 text-danger border border-danger/20"
                    )}
                  >
                    {claudeValResult.valid ? (
                      <>
                        <Check className="h-4 w-4 shrink-0" />
                        <span>Token verified &amp; connected successfully!</span>
                      </>
                    ) : (
                      <>
                        <ShieldAlert className="h-4 w-4 shrink-0" />
                        <span>{claudeValResult.error || "Token verification failed"}</span>
                      </>
                    )}
                  </div>
                )}

                <Button
                  onClick={handleVerifyClaudeBearer}
                  loading={claudeValidating}
                  disabled={!claudeBearerToken.trim()}
                  className="w-full text-xs"
                >
                  Verify &amp; Connect Claude Token
                </Button>
              </div>
            )}

            {/* Method B: Web OAuth */}
            {claudeMethod === "web" && (
              <div className="space-y-3">
                <div className="rounded-lg bg-subtle p-3 space-y-2 border border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-fg">Authorized Redirect URI</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(redirectUri, "uri")}
                      className="text-[10px] text-accent hover:underline flex items-center gap-1"
                    >
                      {copiedUri ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                      {copiedUri ? "Copied" : "Copy URI"}
                    </button>
                  </div>
                  <p className="font-mono text-[10px] text-fg-subtle break-all bg-surface p-1.5 rounded border border-border">
                    {redirectUri}
                  </p>
                </div>

                <div className="space-y-2">
                  <div>
                    <label className="text-xs font-medium text-fg">Anthropic Client ID</label>
                    <Input
                      value={claudeClientId}
                      onChange={(e) => setClaudeClientId(e.target.value)}
                      placeholder="Anthropic OAuth Client ID"
                      className="mt-1 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-fg">Anthropic Client Secret</label>
                    <Input
                      type="password"
                      value={claudeClientSecret}
                      onChange={(e) => setClaudeClientSecret(e.target.value)}
                      placeholder="Anthropic OAuth Client Secret"
                      className="mt-1 font-mono text-xs"
                    />
                  </div>
                </div>

                <Button
                  onClick={handleStartClaudeOAuth}
                  loading={claudeValidating}
                  className="w-full text-xs"
                >
                  Authorize with Claude
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}
