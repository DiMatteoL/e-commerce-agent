import { calculatorTool } from "@/features/ai-chat/tools/operate";
import { gaRunReportTool } from "@/features/ai-chat/tools/google-analytics";
import { ChatAnthropic } from "@langchain/anthropic";

import type { Message as VercelChatMessage } from "ai";
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  ToolMessage,
  type AIMessageChunk,
  type AIMessageFields,
} from "@langchain/core/messages";
import type { StructuredTool } from "@langchain/core/tools";
import type { ToolCall as LCToolCall } from "@langchain/core/messages/tool";
import { concat } from "@langchain/core/utils/stream";

const SYSTEM_PROMPT = `You are an expert Google Analytics (GA) Optimization Agent specialized in e-commerce platforms. Your primary role is to analyze GA data and provide actionable advice on optimizations to boost metrics like traffic, conversions, revenue, and user engagement. Base all recommendations on Google Analytics best practices, including enhanced e-commerce tracking, conversion funnels, audience segmentation, and behavior flow analysis.
Key Guidelines:
- Always reference current GA metrics and features as of ${new Date().toLocaleDateString()}, and advise users to verify data in their own GA dashboard.
- Start responses by asking 2-3 clarifying questions about the user's e-commerce platform (e.g., Shopify, WooCommerce), business goals (e.g., increase sales by 20%), specific GA challenges (e.g., high bounce rates), and available data (e.g., sessions, conversion rates over the past month).
- Provide advice in a structured format:
  1. Summarize the issue or opportunity based on described data.
  2. Analyze key GA metrics (e.g., sessions, engagement rate, total users, conversion rate) and compare them to benchmarks or previous periods.
  3. Suggest 3-5 optimizations with step-by-step implementation instructions, including GA setup tips (e.g., enabling enhanced tracking, setting up goals).
  4. Recommend visualizations like pie charts for channel contributions, histograms for funnels, or tables for source performance.
  5. End with potential impact (e.g., "This could increase conversions by 15% based on industry benchmarks") and follow-up questions.
- Focus on e-commerce-specific optimizations such as tracking product performance, reducing cart abandonment, optimizing traffic sources (organic, paid, social), and improving customer lifetime value.
- Use ethical practices: Do not guess data; if information is insufficient, ask for more details. Avoid promoting unrelated tools unless directly relevant to GA integration.
- Keep responses concise, professional, and data-driven. Use markdown for clarity (e.g., bullet points, tables).
`;

export const llm = new ChatAnthropic({
  model: "claude-3-5-sonnet-20240620",
  temperature: 0.1,
});

export const llmWithTools = llm.bindTools([calculatorTool, gaRunReportTool]);

interface UserInfo {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

export interface SelectedGaPropertyContext {
  propertyDisplayName: string | null;
  propertyResourceName: string;
  accountDisplayName: string | null;
}

export async function chatStream(
  messages: VercelChatMessage[],
  userInfo?: UserInfo,
  selectedGa?: SelectedGaPropertyContext,
) {
  const langchainMessages = messages.map(formatMessage);

  // Create personalized system prompt if user is authenticated
  let systemPrompt = userInfo
    ? `${SYSTEM_PROMPT}

You are currently assisting ${userInfo.name ?? "a user"} (User ID: ${userInfo.id}${userInfo.email ? `, Email: ${userInfo.email}` : ""}).
Personalize your responses when appropriate and feel free to reference the user by name in a natural, friendly way.`
    : SYSTEM_PROMPT;

  if (selectedGa) {
    const propertyLabel =
      selectedGa.propertyDisplayName ?? selectedGa.propertyResourceName;
    const accountLabel = selectedGa.accountDisplayName ?? "Unknown account";
    systemPrompt += `

Google Analytics Context:
- Selected Property: ${propertyLabel}
- Account: ${accountLabel}
Assume questions refer to this property. If the user asks about a different property, you must suggest to switch to the selected property.`;
  }

  // Working messages start with a single system message
  const workingMessages: (
    | HumanMessage
    | AIMessage
    | SystemMessage
    | ToolMessage
  )[] = [new SystemMessage(systemPrompt), ...langchainMessages];

  // Tools registry
  const tools: StructuredTool[] = [
    calculatorTool as unknown as StructuredTool,
    gaRunReportTool as unknown as StructuredTool,
  ];
  const toolByName = new Map<string, StructuredTool>(
    tools.map((t) => [t.name, t] as const),
  );

  const MAX_TOOL_ROUNDS = 3;

  // Return a custom async iterator that orchestrates streaming + tools
  async function* orchestrate() {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      let gathered: AIMessageChunk | undefined = undefined;
      let textBuffer = "";
      const stream = await llmWithTools.stream(workingMessages);

      for await (const chunk of stream) {
        // Forward any text tokens immediately and accumulate for message content
        const text = extractChunkText(chunk);
        if (text) {
          textBuffer += text;
          yield { content: text } as { content: string };
        }
        gathered = gathered ? concat(gathered, chunk) : chunk;
      }

      // After stream ends, check for tool calls
      const calls = getExactToolCallsFromChunk(gathered);
      if (!calls || calls.length === 0) {
        // No tools requested → we are done streaming
        return;
      }

      // Append the assistant tool-call message with non-empty content and exact tool_calls
      const assistantFields: AIMessageFields = {
        content: textBuffer && textBuffer.length > 0 ? textBuffer : " ",
        tool_calls: calls,
      };
      const assistantToolCallMsg = new AIMessage(assistantFields);
      workingMessages.push(assistantToolCallMsg);

      // Execute tools and append ToolMessages, pairing by original call.id
      for (const call of calls) {
        const tool = toolByName.get(call.name);
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
          // Args may already be parsed; if string, attempt JSON.parse
          const args =
            typeof call.args === "string"
              ? safeParse(call.args)
              : (call.args as Record<string, unknown>);
          const result = (await tool.invoke(args ?? {})) as string;
          workingMessages.push(new ToolMessage(result, call.id ?? tool.name));
        } catch (err) {
          const message = err instanceof Error ? err.message : "Tool error";
          const errorPayload = JSON.stringify({
            error: message,
            tool: call.name,
          });
          workingMessages.push(
            new ToolMessage(errorPayload, call.id ?? tool.name),
          );
        }
      }
      // Loop again to let the model consume ToolMessages and continue streaming
    }

    // Safety fallback
    yield {
      content: "I'm having trouble completing your request. Please try again.",
    } as { content: string };
  }

  return orchestrate();
}

const formatMessage = (message: VercelChatMessage) => {
  if (message.role === "user") {
    return new HumanMessage(message.content);
  } else if (message.role === "assistant") {
    return new AIMessage(message.content);
  }
  return new HumanMessage(message.content); // fallback
};

function extractChunkText(chunk: AIMessageChunk): string | undefined {
  const c = chunk.content;
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

// Return the exact provider-parsed tool calls from the gathered chunk
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
