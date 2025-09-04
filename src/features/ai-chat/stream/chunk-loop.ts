import { concat } from "@langchain/core/utils/stream";
import {
  AIMessage,
  SystemMessage,
  ToolMessage,
  type AIMessageChunk,
  type AIMessageFields,
} from "@langchain/core/messages";
import type { StructuredTool } from "@langchain/core/tools";
import type { ToolCall as LCToolCall } from "@langchain/core/messages/tool";
import type { ToolBoundLLM } from "@/features/ai-chat/llm/client";

function extractChunkText(chunk: AIMessageChunk): string | undefined {
  const c = chunk.content as unknown;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) {
    const parts = c
      .map((block) => {
        if (
          block &&
          typeof block === "object" &&
          "text" in block &&
          typeof (block as { text?: unknown }).text === "string"
        ) {
          return (block as { text: string }).text;
        }
        return "";
      })
      .join("");
    return parts.length > 0 ? parts : undefined;
  }
  return undefined;
}

function getExactToolCallsFromChunk(
  chunk?: AIMessageChunk,
): LCToolCall[] | undefined {
  if (!chunk) return undefined;
  const direct = (chunk as unknown as { tool_calls?: LCToolCall[] }).tool_calls;
  if (Array.isArray(direct) && direct.length > 0) return direct;
  const ak = (
    chunk as unknown as { additional_kwargs?: { tool_calls?: LCToolCall[] } }
  ).additional_kwargs;
  if (ak && Array.isArray(ak.tool_calls) && ak.tool_calls.length > 0)
    return ak.tool_calls;
  return undefined;
}

function safeParse(input: string): Record<string, unknown> | undefined {
  try {
    return JSON.parse(input) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

export type StreamToken = { content: string };

export async function* toolAwareChunkLoop(options: {
  llmWithTools: ToolBoundLLM;
  systemPrompt: string;
  messages: Array<
    AIMessage | SystemMessage | ToolMessage | { _getType: () => string }
  >;
  toolsByName: Map<string, StructuredTool>;
  maxToolRounds?: number;
}): AsyncGenerator<StreamToken> {
  const { llmWithTools, systemPrompt, messages, toolsByName } = options;
  const MAX_TOOL_ROUNDS = options.maxToolRounds ?? 3;

  const workingMessages: Array<
    AIMessage | SystemMessage | ToolMessage | { _getType: () => string }
  > = [new SystemMessage(systemPrompt), ...messages];

  async function* orchestrate() {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      let gathered: AIMessageChunk | undefined = undefined;
      let textBuffer = "";
      const stream = await llmWithTools.stream(workingMessages as unknown[]);

      for await (const chunk of stream) {
        const text = extractChunkText(chunk);
        if (text) {
          textBuffer += text;
          yield { content: text } as StreamToken;
        }
        gathered = gathered ? concat(gathered, chunk) : chunk;
      }

      const calls = getExactToolCallsFromChunk(gathered);
      if (!calls || calls.length === 0) {
        return;
      }

      const assistantFields: AIMessageFields = {
        content: textBuffer && textBuffer.length > 0 ? textBuffer : " ",
        tool_calls: calls,
      } as AIMessageFields;
      const assistantToolCallMsg = new AIMessage(assistantFields);
      workingMessages.push(assistantToolCallMsg);

      console.log("calling tools", calls);
      for (const call of calls) {
        const tool = toolsByName.get(call.name);
        if (!tool) {
          const errPayload = JSON.stringify({
            error: "UNKNOWN_TOOL",
            name: call.name,
          });
          workingMessages.push(
            new ToolMessage(errPayload, call.id ?? call.name),
          );
          continue;
        }
        try {
          console.log("calling tool", call.name);
          console.log("call.args", call.args);
          const args =
            typeof call.args === "string"
              ? safeParse(call.args)
              : (call.args as Record<string, unknown>);
          const result = (await tool.invoke(args ?? {})) as string;
          console.log("result", result);
          workingMessages.push(new ToolMessage(result, call.id ?? tool.name));
        } catch (err) {
          const message = err instanceof Error ? err.message : "Tool error";
          const errorPayload = JSON.stringify({
            error: message,
            tool: call.name,
          });
          console.error("tool error", errorPayload);
          workingMessages.push(
            new ToolMessage(errorPayload, call.id ?? tool.name),
          );
        }
      }

      yield { content: "\n\n" } as StreamToken;
    }

    yield {
      content: "I'm having trouble completing your request. Please try again.",
    };
  }

  return yield* orchestrate();
}
