import { generateText, streamText, type LanguageModelV1, type ToolSet } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { AgentEvent, AIProvider, GenerateRequest, ToolRequest, Usage } from "./provider";
import { classifyAiError, estimateTokens, modelUsage, tokens, withUsage } from "./provider";

export type SupportedExternalProvider =
  | "anthropic"
  | "openai"
  | "openrouter"
  | "gemini"
  | "freellmapi"
  | "groq"
  | "cerebras"
  | "mistral";

export class ExternalAIProvider implements AIProvider {
  readonly billable = false; // Billed on user's own external provider account

  constructor(
    readonly id: SupportedExternalProvider,
    readonly model: string,
    private readonly apiKey: string,
    private readonly isOAuth: boolean = false,
    private readonly options?: { endpoint?: string },
  ) {}

  private createModel(): LanguageModelV1 {
    switch (this.id) {
      case "anthropic": {
        const clean = this.apiKey.replace(/^Bearer\s+/i, "");
        const anthropic = createAnthropic({
          apiKey: this.isOAuth ? "placeholder" : this.apiKey,
          headers: this.isOAuth
            ? {
                Authorization: `Bearer ${clean}`,
                "anthropic-version": "2023-06-01",
              }
            : undefined,
        });
        return anthropic(this.model) as unknown as LanguageModelV1;
      }
      case "openai": {
        const openai = createOpenAI({ apiKey: this.apiKey });
        return openai(this.model) as unknown as LanguageModelV1;
      }
      case "openrouter": {
        const openrouter = createOpenAI({
          baseURL: "https://openrouter.ai/api/v1",
          apiKey: this.apiKey,
          headers: {
            "HTTP-Referer": "https://talorys.pages.dev",
            "X-Title": "Talorys AI",
          },
        });
        return openrouter(this.model) as unknown as LanguageModelV1;
      }
      case "gemini": {
        const clean = this.apiKey.replace(/^Bearer\s+/i, "");
        const google = createGoogleGenerativeAI({
          apiKey: this.isOAuth ? "placeholder" : this.apiKey,
          headers: this.isOAuth
            ? {
                Authorization: `Bearer ${clean}`,
              }
            : undefined,
        });
        return google(this.model) as unknown as LanguageModelV1;
      }
      case "freellmapi": {
        const baseURL = this.options?.endpoint || "http://localhost:3001/v1";
        const freellmapi = createOpenAI({
          baseURL,
          apiKey: this.apiKey || "freellmapi-local",
        });
        return freellmapi(this.model) as unknown as LanguageModelV1;
      }
      case "groq": {
        const groq = createOpenAI({
          baseURL: "https://api.groq.com/openai/v1",
          apiKey: this.apiKey,
        });
        return groq(this.model) as unknown as LanguageModelV1;
      }
      case "cerebras": {
        const cerebras = createOpenAI({
          baseURL: "https://api.cerebras.ai/v1",
          apiKey: this.apiKey,
        });
        return cerebras(this.model) as unknown as LanguageModelV1;
      }
      case "mistral": {
        const mistral = createOpenAI({
          baseURL: "https://api.mistral.ai/v1",
          apiKey: this.apiKey,
        });
        return mistral(this.model) as unknown as LanguageModelV1;
      }
      default:
        throw new Error(`Unsupported external AI provider: ${this.id}`);
    }
  }

  async generate(req: GenerateRequest): Promise<{ text: string; usage: Usage }> {
    try {
      const result = await generateText({
        model: this.createModel(),
        instructions: req.system,
        messages: req.messages,
        maxOutputTokens: req.maxOutputTokens,
        temperature: req.temperature,
        abortSignal: req.signal,
        maxRetries: 0,
      });

      const inEst = estimateTokens(JSON.stringify(req.messages) + req.system);
      const outEst = estimateTokens(result.text);

      return {
        text: result.text,
        usage: modelUsage(
          this.model,
          this.billable,
          tokens(result.usage?.promptTokens, inEst),
          tokens(result.usage?.completionTokens, outEst),
        ),
      };
    } catch (error) {
      throw withUsage(classifyAiError(error), undefined);
    }
  }

  async *stream(req: GenerateRequest): AsyncIterable<AgentEvent> {
    yield* this.generateWithTools({ ...req, tools: [], maxIterations: 1, toolBudgetExhausted: () => true });
  }

  async *generateWithTools(req: ToolRequest): AsyncIterable<AgentEvent> {
    const tools: ToolSet = {};
    for (const t of req.tools) {
      tools[t.name] = {
        description: t.description,
        inputSchema: t.inputSchema,
        execute: async (input: unknown, options: { toolCallId: string }) => t.execute(input, options.toolCallId),
      } as ToolSet[string];
    }

    const hasTools = req.tools.length > 0;
    let streamError: unknown = null;
    let stepOutputChars = 0;

    const result = streamText({
      model: this.createModel(),
      instructions: req.system,
      messages: req.messages,
      maxOutputTokens: req.maxOutputTokens,
      temperature: req.temperature,
      abortSignal: req.signal,
      maxRetries: 0,
      ...(hasTools
        ? {
            tools,
            stopWhen: ({ steps }: { steps: unknown[] }) =>
              steps.length >= req.maxIterations || (req.reserveNextStep ? !req.reserveNextStep() : false),
            prepareStep: ({ stepNumber }: { stepNumber: number }) =>
              stepNumber >= req.maxIterations - 1 || req.toolBudgetExhausted() ? { toolChoice: "none" as const } : {},
          }
        : {}),
      onError: ({ error }: { error: unknown }) => {
        streamError = error;
      },
    });

    let failure: unknown = null;
    try {
      for await (const part of result.fullStream) {
        switch (part.type) {
          case "reasoning-delta":
            stepOutputChars += part.text.length;
            break;
          case "text-delta":
            stepOutputChars += part.text.length;
            if (part.text) yield { type: "text", delta: part.text };
            break;
          case "tool-call":
            stepOutputChars += JSON.stringify({ name: part.toolName, input: part.input }).length;
            yield { type: "tool-start", id: part.toolCallId, name: part.toolName, input: part.input };
            break;
          case "tool-result":
            yield { type: "tool-end", id: part.toolCallId, name: part.toolName, output: part.output };
            break;
          case "tool-error":
            yield {
              type: "tool-end",
              id: part.toolCallId,
              name: part.toolName,
              output: null,
              error: part.error instanceof Error ? part.error.message : String(part.error),
            };
            break;
          case "finish-step":
            if (part.usage) {
              yield {
                type: "usage",
                usage: modelUsage(
                  this.model,
                  this.billable,
                  tokens(part.usage.promptTokens, estimateTokens(stepOutputChars)),
                  tokens(part.usage.completionTokens, estimateTokens(stepOutputChars)),
                ),
              };
            }
            stepOutputChars = 0;
            break;
          case "error":
            throw part.error;
          default:
            break;
        }
      }
    } catch (error) {
      failure = error;
    }

    failure ??= streamError;
    if (failure) throw classifyAiError(failure);
  }
}
