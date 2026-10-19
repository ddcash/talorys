import type { McpServer, McpToolSummary } from "@talorys/shared";

export interface McpTestResult {
  ok: boolean;
  toolsCount: number;
  tools: McpToolSummary[];
  error?: string;
}

interface JsonRpcResponse<T = unknown> {
  jsonrpc: string;
  id?: string | number | null;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

interface McpToolsListResult {
  tools: Array<{
    name: string;
    description?: string;
    inputSchema?: Record<string, unknown>;
  }>;
}

interface McpToolCallResult {
  content?: Array<{
    type: string;
    text?: string;
    data?: unknown;
  }>;
  structuredContent?: unknown;
  isError?: boolean;
}

export class McpClient {
  private static getHeaders(authToken?: string | null): HeadersInit {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": "2024-11-05",
    };
    if (authToken) {
      headers.Authorization = authToken.startsWith("Bearer ") ? authToken : `Bearer ${authToken}`;
    }
    return headers;
  }

  /**
   * Parses JSON-RPC response from either application/json or SSE text/event-stream format.
   */
  private static async parseResponse<T>(response: Response): Promise<JsonRpcResponse<T>> {
    const rawText = await response.text();
    // Check if it's SSE (Server-Sent Events) or contains 'data:'
    if (rawText.includes("data:")) {
      const lines = rawText.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data:")) {
          const payload = trimmed.slice(5).trim();
          if (payload && payload !== "[DONE]") {
            try {
              return JSON.parse(payload) as JsonRpcResponse<T>;
            } catch {
              // keep searching
            }
          }
        }
      }
    }

    try {
      return JSON.parse(rawText) as JsonRpcResponse<T>;
    } catch {
      throw new Error(`Failed to parse MCP response: ${rawText.slice(0, 300)}`);
    }
  }

  /**
   * Tests connection to an MCP server endpoint by performing tools/list.
   */
  static async testConnection(url: string, authToken?: string | null, timeoutMs = 6000): Promise<McpTestResult> {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: this.getHeaders(authToken),
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
          params: {},
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        return {
          ok: false,
          toolsCount: 0,
          tools: [],
          error: `HTTP ${response.status}: ${text.slice(0, 200) || response.statusText}`,
        };
      }

      const body = await this.parseResponse<McpToolsListResult>(response);
      if (body.error) {
        return {
          ok: false,
          toolsCount: 0,
          tools: [],
          error: `MCP Error ${body.error.code}: ${body.error.message}`,
        };
      }

      const rawTools = body.result?.tools ?? [];
      const tools: McpToolSummary[] = rawTools.map((t) => ({
        name: t.name,
        description: t.description ?? "",
        inputSchema: t.inputSchema,
      }));

      return {
        ok: true,
        toolsCount: tools.length,
        tools,
      };
    } catch (err) {
      return {
        ok: false,
        toolsCount: 0,
        tools: [],
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Fetches the current list of available tools from an MCP server.
   */
  static async listTools(server: McpServer, timeoutMs = 8000): Promise<McpToolSummary[]> {
    const res = await this.testConnection(server.url, server.auth_token, timeoutMs);
    if (!res.ok) {
      throw new Error(`Failed to list tools from ${server.name}: ${res.error}`);
    }
    return res.tools;
  }

  /**
   * Executes a tool on an MCP server over JSON-RPC 2.0.
   */
  static async callTool(
    server: McpServer,
    toolName: string,
    args: Record<string, unknown>,
    timeoutMs = 12000,
  ): Promise<unknown> {
    const response = await fetch(server.url, {
      method: "POST",
      headers: this.getHeaders(server.auth_token),
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: crypto.randomUUID(),
        method: "tools/call",
        params: {
          name: toolName,
          arguments: args,
        },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(`MCP tool call failed (HTTP ${response.status}): ${errText.slice(0, 300) || response.statusText}`);
    }

    const body = await this.parseResponse<McpToolCallResult>(response);
    if (body.error) {
      throw new Error(`MCP Error ${body.error.code}: ${body.error.message}`);
    }

    const result = body.result;
    if (result?.isError) {
      const msg = result.content?.map((c) => c.text).filter(Boolean).join("\n") || "Tool returned an error";
      throw new Error(msg);
    }

    if (result?.structuredContent !== undefined) {
      return result.structuredContent;
    }

    const textOutput = result?.content
      ?.filter((c) => c.type === "text" && c.text)
      .map((c) => c.text)
      .join("\n");

    if (textOutput) {
      try {
        return JSON.parse(textOutput);
      } catch {
        return textOutput;
      }
    }

    return result ?? "Done";
  }

  /**
   * Memory Recall from Inkstone Knowledge Base:
   * Fast, bounded, and token-efficient. Queries Inkstone for relevant notes,
   * fetches bounded text excerpts, and returns markdown for prompt context injection.
   * Stays within Cloudflare free limits (1-2 fast subrequests, 800 token ceiling).
   */
  static async recallFromInkstone(query: string, server: McpServer, maxChars = 1000): Promise<string | null> {
    if (!query.trim()) return null;

    try {
      // 1. Search Inkstone for notes matching user's turn
      const searchRes = (await this.callTool(
        server,
        "search",
        { query: query.slice(0, 250), mode: "auto" },
        3000,
      )) as { results?: Array<{ id: string; title: string; url?: string }> };

      const items = searchRes?.results?.slice(0, 2);
      if (!items || items.length === 0) return null;

      // 2. Fetch bounded note summaries
      const noteSnippets: string[] = [];
      let totalChars = 0;

      for (const item of items) {
        if (totalChars >= maxChars) break;
        try {
          const noteData = (await this.callTool(
            server,
            "read_note",
            { note_id: item.id, max_chars: Math.min(600, maxChars - totalChars) },
            3000,
          )) as { data?: { text?: string; content?: string } } | string;

          let text = "";
          if (typeof noteData === "string") {
            text = noteData;
          } else if (typeof noteData === "object" && noteData !== null) {
            text = (noteData as any).data?.text ?? (noteData as any).text ?? (noteData as any).data?.content ?? "";
          }

          if (text) {
            const clean = text.replace(/[\r\n]+/g, " ").trim().slice(0, 400);
            noteSnippets.push(`- **${item.title}**: ${clean}`);
            totalChars += clean.length;
          } else {
            noteSnippets.push(`- **${item.title}** (Note ID: ${item.id})`);
          }
        } catch {
          noteSnippets.push(`- **${item.title}** (Note ID: ${item.id})`);
        }
      }

      if (noteSnippets.length === 0) return null;

      return `Relevant context from Inkstone Knowledge Base:\n${noteSnippets.join("\n")}`;
    } catch (err) {
      // Never crash a turn if Inkstone is temporarily unreachable
      console.warn("[mcp] Inkstone recall error:", err);
      return null;
    }
  }
}
