import type { ChatMessage, ChatStreamEvent, PendingAction, ToolActivity } from "@talorys/shared";
import type { Services } from "../services/container";
import { type AIProvider, classifyAiError, estimateTokens, type ProviderTool, usageOfFailure } from "../ai/provider";
import { AppError, NotFoundError } from "../api/errors";
import { ALL_TOOLS, ToolExecutor, type ToolDefinition } from "../tools";
import { clip } from "../services/text";
import { buildSystemPrompt } from "./prompt";
import { SUMMARIZE_THRESHOLD, buildContextWindow, memoryTokenBudget, selectRelevantMemories, summarizationPrompt } from "./memory";
import type { RunnerExtensions } from "../semantic/hooks";
import { McpClient } from "../mcp/client";
import { getAllMcpTools } from "../mcp/tools";

export interface TurnInput {
  conversationId?: string;
  message: string;
  retry?: boolean;
  signal: AbortSignal;
  provider?: string | null;
  model?: string | null;
}

export function titleFromMessage(message: string): string {
  const clean = message.replace(/\s+/g, " ").trim();
  if (clean.length <= 60) return clean;
  const cut = clip(clean, 60);
  const lastSpace = cut.lastIndexOf(" ");
  return `${lastSpace > 30 ? cut.slice(0, lastSpace) : cut}…`;
}

function toolLabel(tool: ToolDefinition | undefined, name: string, input: unknown): string {
  if (!tool) return name;
  const parsed = tool.input.safeParse(input);
  if (!parsed.success) return name.replace(/_/g, " ");
  try {
    return tool.label(parsed.data);
  } catch {
    return name;
  }
}

function toProviderTools(executor: ToolExecutor): ProviderTool[] {
  return executor.available().map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.input,
    execute: (input, callId) => executor.execute(tool.name, input, callId),
  }));
}

const APPROVAL_OUTCOME: Record<PendingAction["status"], string> = {
  pending: "waiting for the owner's approval",
  approved: "approved by the owner and done",
  cancelled: "declined by the owner",
  expired: "expired without approval",
  failed: "approved but failed",
};

/** Lets the model see what happened to actions it proposed in earlier turns. */
function withApprovalOutcomes(m: ChatMessage): ChatMessage {
  const notes = m.tools.flatMap((t) => (t.approval ? [`[${t.approval.summary}: ${APPROVAL_OUTCOME[t.approval.status]}]`] : []));
  return notes.length ? { ...m, content: `${m.content}\n\n${notes.join("\n")}`.trim() } : m;
}

/** Runs agent turns: context assembly, provider streaming, tool execution, persistence. */
export class AgentRunner {
  constructor(
    private readonly services: Services,
    private readonly providerOrFactory: AIProvider | ((override?: { provider?: string | null; model?: string | null }) => AIProvider | null) | null,
    private readonly ext?: RunnerExtensions,
  ) {}

  private resolveProvider(conversation?: { provider_override?: string | null; model_override?: string | null } | null): AIProvider | null {
    if (typeof this.providerOrFactory === "function") {
      return this.providerOrFactory({
        provider: conversation?.provider_override,
        model: conversation?.model_override,
      });
    }
    return this.providerOrFactory;
  }

  async *chat(input: TurnInput): AsyncGenerator<ChatStreamEvent> {
    const s = this.services;
    const settings = s.settings.get();
    const { limits } = settings;

    // 1. Conversation and the owner's message.
    let conversation = input.conversationId ? s.conversations.get(input.conversationId) : null;
    if (input.conversationId && !conversation) throw new NotFoundError("Conversation not found");
    let userMessage: ChatMessage;
    if (input.retry && conversation) {
      // Drop the failed assistant reply and answer the last owner message again.
      const last = s.conversations.lastMessage(conversation.id);
      if (last?.role === "assistant" && last.status !== "complete") s.conversations.deleteMessage(last.id);
      const prev = s.conversations.lastMessage(conversation.id);
      if (prev?.role !== "user") throw new AppError("CONFLICT", "Nothing to retry.");
      // Restored backup content is data, never live owner input.
      if (prev.source === "import") throw new AppError("CONFLICT", "Messages restored from a backup can't be retried. Send a new message instead.");
      userMessage = prev;
    } else {
      if (!conversation) {
        conversation = s.conversations.create(titleFromMessage(input.message), {
          provider: input.provider,
          model: input.model,
        });
        yield { type: "title", conversation_id: conversation.id, title: conversation.title };
      } else if (input.provider !== undefined || input.model !== undefined) {
        conversation = s.conversations.updateOverrides(conversation.id, {
          provider_override: input.provider,
          model_override: input.model,
        });
      }
      userMessage = s.conversations.addMessage({ conversation_id: conversation.id, role: "user", content: input.message });
    }
    const assistantId = crypto.randomUUID();
    yield { type: "start", conversation_id: conversation.id, user_message_id: userMessage.id, assistant_message_id: assistantId };

    let text = "";
    const tools: ToolActivity[] = [];
    const finish = (status: ChatMessage["status"], error: string | null): ChatMessage =>
      s.conversations.addMessage({
        id: assistantId,
        conversation_id: conversation!.id,
        role: "assistant",
        content: text,
        tools,
        status,
        error,
      });

    try {
      const provider = this.resolveProvider(conversation);
      if (!provider) {
        throw new AppError("AI_UNAVAILABLE", "AI provider is not configured for this deployment. Everything else keeps working.");
      }
      const hasFallbacks = settings.autoFailover && (settings.fallbacks?.length ?? 0) > 0;
      const isWorkersAiOnly = (conversation.provider_override || settings.provider || "workers-ai") === "workers-ai" && !hasFallbacks;
      if (isWorkersAiOnly && !s.usage.canUseAi(limits)) throw aiLimitReached(limits.maxAiRequestsPerDay);

      // 2. Context: relevant memories, summary, recent history within the token budget.
      const selected = this.ext ? await this.ext.selectMemories(userMessage.content) : selectRelevantMemories(s.memories, userMessage.content);
      const memories = s.memoryHistory.promptMemories(selected, memoryTokenBudget(limits));
      const items = this.ext?.selectItems ? await this.ext.selectItems(userMessage.content) : undefined;

      // Active Rules
      const activeRules = s.rules.listActive().map((r) => ({
        title: r.title,
        content: r.content,
        category: r.category,
      }));

      // Active Skills
      const activeSkills = s.skills.listActive();
      const skillsPrompt = activeSkills.map((sk) => ({
        name: sk.name,
        instructions: sk.instructions,
      }));

      // Recall context from external MCP memory provider (e.g. Inkstone Knowledge Base)
      let mcpMemoryContext: string | null = null;
      const memoryServer = s.mcp.getMemoryProvider();
      if (memoryServer) {
        mcpMemoryContext = await McpClient.recallFromInkstone(userMessage.content, memoryServer);
      }
      const combinedItems = [items, mcpMemoryContext].filter(Boolean).join("\n\n") || undefined;

      const history = s.pendingActions
        .withCurrentStatus(s.conversations.messages(conversation.id, { limit: 200 }))
        .filter((m) => m.role === "user" || m.status === "complete")
        .map(withApprovalOutcomes);
      let summary = conversation.summary;
      let summaryUpto = conversation.summary_upto;
      const baseSystem = buildSystemPrompt({
        agentName: settings.agentName,
        timezone: settings.timezone,
        now: new Date(),
        autoMemory: settings.autoMemory,
        memories,
        conversationSummary: summary,
        rules: activeRules,
        skills: skillsPrompt,
        ...(combinedItems ? { items: combinedItems } : {}),
      });
      const historyBudget = Math.max(500, limits.maxContextTokens - estimateTokens(baseSystem) - 600);
      let window = buildContextWindow(history, historyBudget, summaryUpto);

      // Summarizing is an extra model call: only when the budget leaves room for the reply too.
      if (window.overflow.length >= SUMMARIZE_THRESHOLD && s.usage.remainingAi(limits) >= 2) {
        try {
          s.usage.increment({ ai_requests: 1 });
          const result = await provider.generate({
            system: "You write compact, factual conversation summaries.",
            messages: summarizationPrompt(summary, window.overflow),
            maxOutputTokens: 300,
            temperature: 0.2,
            signal: input.signal,
          });
          s.usage.record(result.usage);
          summary = result.text.trim().slice(0, 2000);
          summaryUpto = window.overflow.at(-1)!.created_at;
          s.conversations.setSummary(conversation.id, summary, summaryUpto);
          window = buildContextWindow(history, historyBudget, summaryUpto);
        } catch (error) {
          const usage = usageOfFailure(error);
          if (usage) s.usage.record(usage);
          console.warn("Summarization skipped", error);
        }
      }

      const system = summary === conversation.summary
        ? baseSystem
        : buildSystemPrompt({
            agentName: settings.agentName,
            timezone: settings.timezone,
            now: new Date(),
            autoMemory: settings.autoMemory,
            memories,
            conversationSummary: summary,
            rules: activeRules,
            skills: skillsPrompt,
            ...(combinedItems ? { items: combinedItems } : {}),
          });

      // 3. Tools with per-turn limits: native tools + active MCP tools.
      const enabledMcp = s.mcp.listEnabled();
      const mcpTools = getAllMcpTools(enabledMcp);
      const combinedTools = [...(this.ext?.tools ?? ALL_TOOLS), ...mcpTools];
      const executor = new ToolExecutor(
        combinedTools,
        { services: s, timezone: settings.timezone, mode: "chat", conversationId: conversation.id },
        { maxToolCalls: limits.maxToolCalls },
      );
      const providerTools = toProviderTools(executor);

      // Provider candidates: primary selection + configured fallbacks
      const primaryCandidate = {
        provider: conversation.provider_override || settings.provider || "workers-ai",
        model: conversation.model_override || settings.model,
      };

      const candidates: Array<{ provider: string; model: string }> = [primaryCandidate];
      if (settings.autoFailover !== false && settings.fallbacks?.length) {
        for (const fb of settings.fallbacks) {
          if (fb.provider !== primaryCandidate.provider || fb.model !== primaryCandidate.model) {
            candidates.push(fb);
          }
        }
      }

      // Guaranteed resilient safety-net fallbacks when autoFailover is enabled:
      // Always ensure the chat can recover to Cloudflare Workers AI and free providers
      if (settings.autoFailover !== false) {
        if (!candidates.some((c) => c.provider === "workers-ai" && c.model === "@cf/zai-org/glm-4.7-flash")) {
          candidates.push({ provider: "workers-ai", model: "@cf/zai-org/glm-4.7-flash" });
        }
        if (!candidates.some((c) => c.provider === "workers-ai" && c.model === "@cf/meta/llama-3.3-70b-instruct-fp8-fast")) {
          candidates.push({ provider: "workers-ai", model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast" });
        }
        if (!candidates.some((c) => c.provider === "workers-ai" && c.model === "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b")) {
          candidates.push({ provider: "workers-ai", model: "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b" });
        }
        if (!candidates.some((c) => c.provider === "pollinations")) {
          candidates.push({ provider: "pollinations", model: "openai" });
        }
      }

      let streamedAnyText = false;
      let lastError: unknown = null;

      for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[i]!;
        let currentProvider: AIProvider | null = null;
        try {
          currentProvider = this.resolveProvider({
            provider_override: candidate.provider,
            model_override: candidate.model,
          });
        } catch (err) {
          lastError = err;
          continue;
        }

        if (!currentProvider) continue;

        // Check budget limits and free-tier guards
        const budget = settings.budget;
        if (budget?.enabled && budget.failoverOnBudget && i < candidates.length - 1) {
          const todayUsage = s.usage.today();
          const todayRequests = todayUsage.ai_requests;
          const todayTokens = todayUsage.input_tokens_reported + todayUsage.output_tokens_reported;
          const todayCost = todayUsage.cost_usd_estimate ?? 0;

          const requestExceeded = budget.maxDailyRequests > 0 && todayRequests >= budget.maxDailyRequests;
          const tokenExceeded = budget.maxDailyTokens > 0 && todayTokens >= budget.maxDailyTokens;
          // Cloudflare Workers AI runs within the user's included free quota (10,000 Neurons/day)
          const freeTierViolation = budget.freeTierOnly && currentProvider.billable && currentProvider.id !== "workers-ai";
          const costExceeded = budget.maxMonthlyCostUsd > 0 && todayCost >= budget.maxMonthlyCostUsd;

          const budgetHit = requestExceeded || tokenExceeded || freeTierViolation || costExceeded;

          if (budgetHit) {
            const next = candidates[i + 1]!;
            const reason = freeTierViolation
              ? "Billed model avoided (100% Free-Tier Mode active)"
              : costExceeded
              ? `Max cost threshold ($${budget.maxMonthlyCostUsd.toFixed(2)}) reached`
              : requestExceeded
              ? `Daily request budget (${budget.maxDailyRequests}) reached`
              : `Daily token budget (${budget.maxDailyTokens.toLocaleString()}) reached`;

            const budgetNotice = `*[Zero-Cost Budget Guard: ${reason} for ${candidate.provider}. Failing over to free ${next.provider} (${next.model})...]*\n\n`;
            yield { type: "text", delta: budgetNotice };
            text += budgetNotice;
            continue;
          }
        }

        // Check Workers AI native limit and fail over to free alternative if possible
        if (candidate.provider === "workers-ai" && !s.usage.canUseAi(limits) && i < candidates.length - 1) {
          const next = candidates[i + 1]!;
          const limitNotice = `*[Cloudflare Workers AI daily request limit reached. Failing over to ${next.provider} (${next.model})...]*\n\n`;
          yield { type: "text", delta: limitNotice };
          text += limitNotice;
          continue;
        }

        try {
          if (candidate.provider === "workers-ai" && !s.usage.reserveAi(limits)) {
            throw aiLimitReached(limits.maxAiRequestsPerDay);
          } else if (candidate.provider !== "workers-ai") {
            s.usage.increment({ ai_requests: 1 });
          }

          for await (const event of currentProvider.generateWithTools({
            system,
            messages: window.messages,
            tools: providerTools,
            maxIterations: limits.maxAgentIterations,
            maxOutputTokens: limits.maxOutputTokens,
            temperature: settings.temperature,
            toolBudgetExhausted: () => executor.budgetExhausted(),
            reserveNextStep: () => s.usage.reserveAi(limits),
            signal: input.signal,
          })) {
            if (event.type === "text") {
              streamedAnyText = true;
              text += event.delta;
              yield { type: "text", delta: event.delta };
            } else if (event.type === "tool-start") {
              const activity: ToolActivity = {
                id: event.id,
                name: event.name,
                label: toolLabel(executor.find(event.name), event.name, event.input),
                status: "running",
              };
              tools.push(activity);
              yield { type: "tool", tool: { ...activity } };
            } else if (event.type === "tool-end") {
              const activity = tools.find((t) => t.id === event.id);
              if (activity) {
                activity.status = event.error ? "error" : "success";
                if (event.error) activity.error = event.error.slice(0, 300);
                const approval = executor.approvalFor(event.id);
                if (approval) activity.approval = approval;
                yield { type: "tool", tool: { ...activity } };
              }
            } else if (event.type === "usage") {
              s.usage.record(event.usage);
            }
          }

          // Successfully completed stream with this candidate!
          lastError = null;
          break;
        } catch (err) {
          lastError = err;
          if (streamedAnyText || i === candidates.length - 1) {
            throw err;
          }

          const next = candidates[i + 1]!;
          const rawErr = err instanceof Error ? err.message : String(err);
          const brief = rawErr.length > 80 ? rawErr.slice(0, 77) + "..." : rawErr;
          const notice = `*[Notice: ${candidate.provider} (${brief}). Failing over to ${next.provider} (${next.model})...]*\n\n`;
          yield { type: "text", delta: notice };
          text += notice;
        }
      }

      if (lastError) throw lastError;

      s.usage.increment({ tool_calls: executor.callCount });

      // Providers (like the AI SDK's streamText) may end the stream quietly on abort instead of throwing.
      if (input.signal.aborted) {
        yield { type: "done", message: finish("cancelled", null) };
        return;
      }
      if (!text.trim()) {
        text = tools.some((t) => t.status === "success") ? "Done." : "I wasn't able to produce a response. Please try rephrasing.";
      }
      yield { type: "done", message: finish("complete", null) };
    } catch (error) {
      if (input.signal.aborted) {
        yield { type: "done", message: finish("cancelled", null) };
        return;
      }
      const appError = error instanceof AppError ? error : classifyAiError(error);
      if (appError.code.startsWith("AI_")) s.usage.increment({ ai_errors: 1 });
      yield { type: "error", code: appError.code, message: appError.message };
      yield { type: "done", message: finish("error", appError.message) };
    }
  }

  /** Runs an AI automation prompt with read-only tools. Returns the reply text. */
  async runScheduledPrompt(prompt: string, signal?: AbortSignal): Promise<string> {
    const s = this.services;
    const settings = s.settings.get();
    const provider = this.resolveProvider(null);
    if (!provider) throw new AppError("AI_UNAVAILABLE", "AI provider is not configured.");
    const executor = new ToolExecutor(
      this.ext?.tools ?? ALL_TOOLS,
      { services: s, timezone: settings.timezone, mode: "scheduled" },
      { maxToolCalls: Math.min(settings.limits.maxToolCalls, 4) },
    );
    const system = buildSystemPrompt({
      agentName: settings.agentName,
      timezone: settings.timezone,
      now: new Date(),
      autoMemory: false,
      memories: s.memoryHistory.promptMemories(
        this.ext ? await this.ext.selectMemories(prompt) : selectRelevantMemories(s.memories, prompt),
        memoryTokenBudget(settings.limits),
      ),
      rules: s.rules.listActive().map((r) => ({ title: r.title, content: r.content, category: r.category })),
      skills: s.skills.listActive().map((sk) => ({ name: sk.name, instructions: sk.instructions })),
      scheduled: true,
    });
    const providerTools = toProviderTools(executor);
    let text = "";
    // Reserved after the awaits above, so a run started just before the budget ran out cannot overrun it.
    if (!s.usage.reserveScheduledAi(settings.limits)) throw aiLimitReached(settings.limits.maxAiRequestsPerDay);
    try {
      for await (const event of provider.generateWithTools({
        system,
        messages: [{ role: "user", content: prompt }],
        tools: providerTools,
        maxIterations: Math.min(settings.limits.maxAgentIterations, 3),
        maxOutputTokens: Math.min(settings.limits.maxOutputTokens, 600),
        temperature: settings.temperature,
        toolBudgetExhausted: () => executor.budgetExhausted(),
        reserveNextStep: () => s.usage.reserveAi(settings.limits),
        signal,
      })) {
        if (event.type === "text") text += event.delta;
        if (event.type === "usage") {
          s.usage.record(event.usage);
        }
      }
    } catch (error) {
      s.usage.increment({ ai_errors: 1 });
      throw classifyAiError(error);
    }
    s.usage.increment({ tool_calls: executor.callCount });
    return text.trim() || "(No output)";
  }
}

function aiLimitReached(max: number): AppError {
  return new AppError("AI_LIMIT_REACHED", `Talorys reached its daily limit of ${max} AI requests (adjustable in Settings → AI).`);
}
