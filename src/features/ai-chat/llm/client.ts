import { ChatAnthropic } from "@langchain/anthropic";
import type { StructuredTool } from "@langchain/core/tools";
import type { AIMessageChunk } from "@langchain/core/messages";

export type ToolBoundLLM = {
  stream: (messages: unknown[]) => AsyncIterable<AIMessageChunk>;
};

export function createLLM(model = "claude-sonnet-4-20250514"): ChatAnthropic {
  return new ChatAnthropic({ model, temperature: 0.1 });
}

export function bindTools(
  llm: ChatAnthropic,
  tools: StructuredTool[],
): ToolBoundLLM {
  const anyLlm = llm as unknown as {
    bindTools: (t: StructuredTool[]) => {
      stream: (messages: unknown[]) => AsyncIterable<AIMessageChunk>;
    };
  };
  const bound = anyLlm.bindTools(tools);
  return { stream: bound.stream.bind(bound) };
}
