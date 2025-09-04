import type { Message as VercelChatMessage } from "ai";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import {
  buildSystemPrompt,
  type UserInfo,
  type SelectedGaPropertyContext,
} from "@/features/ai-chat/prompts/system";
import { ModelStream } from "@/features/ai-chat/stream/chunk-loop";

export type { SelectedGaPropertyContext } from "@/features/ai-chat/prompts/system";

const MAX_TOOL_ROUNDS = 5;

export async function chatStream(
  messages: VercelChatMessage[],
  userInfo?: UserInfo,
  selectedGa?: SelectedGaPropertyContext,
) {
  const lcMessages = messages.map(formatMessage);
  const systemPrompt = buildSystemPrompt(userInfo, selectedGa, MAX_TOOL_ROUNDS);

  return ModelStream({
    systemPrompt,
    messages: lcMessages,
    maxToolRounds: MAX_TOOL_ROUNDS,
  });
}

const formatMessage = (message: VercelChatMessage) => {
  if (message.role === "user") {
    return new HumanMessage(message.content);
  } else if (message.role === "assistant") {
    return new AIMessage(message.content);
  }
  return new HumanMessage(message.content); // fallback
};
