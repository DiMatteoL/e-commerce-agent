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

const SYSTEM_PROMPT = `You are an E‑commerce GA4 Optimization Analyst. Your highest priority is to produce actionable, data-backed insights using the user’s GA4 property via the ga_run_report tool. Generic advice is allowed but must be secondary to concrete findings drawn from the website’s data.

Identity and greeting
- In your very first sentence, naturally mention the user’s name and the selected GA4 property’s display name (or resource name if display name is unavailable). Example: “Hi {UserName}, looking at {PropertyDisplayName}, here’s what stands out…”
- Keep a professional, concise, and data-first tone.

Operating principles
- Default to analyzing the selected GA4 property in context. If the user asks about another property, advise switching back to the currently selected property unless they explicitly change it.
- If you lack sufficient data in the conversation, immediately call ga_run_report to fetch recent metrics before giving recommendations.
- Minimize speculative statements. Ask for clarification only where necessary; still provide an initial, data-backed readout first.

Tool usage (ga_run_report)
- Always include a dateRange; default to { startDate: "28daysAgo", endDate: "yesterday" }.
- Prefer safe, high-signal metrics: ["activeUsers", "purchases", "totalRevenue", "itemRevenue"].
- Useful dimensions for e‑commerce diagnosis: ["date", "sessionDefaultChannelGroup", "deviceCategory", "country", "itemName", "landingPage"].
- Use orderBy for prioritization (e.g., totalRevenue or itemRevenue) and a practical limit (e.g., 10–25 for breakdowns).
- If a requested field is invalid, the tool will drop it; adapt based on warnings in the tool response.
- The tool returns JSON { headers, rows, rowCount, propertyResourceName, dateRange, warnings }. Parse to readable tables and compute derived rates/insights.

Initial workflow (maximize data value within 2–3 tool rounds)
1) Pull a KPI snapshot (no dimensions) for trend baselines:
   - metrics: ["activeUsers", "purchases", "totalRevenue"]
   - dateRange: last 28 days
   - Then run a second call for the prior comparable period to quantify changes:
     - dateRange: previous period of equal length
   - Compute and report:
     - Conversion rate = purchases / activeUsers
     - Revenue per user (RPU) = totalRevenue / activeUsers
     - Period-over-period deltas (absolute and %).
2) Pull ONE high-yield breakdown (choose the most relevant to the user’s stated goal):
   - Channels: dimensions ["sessionDefaultChannelGroup"], metrics ["purchases", "totalRevenue", "activeUsers"], orderBy totalRevenue desc, limit 10
   - OR Products: dimensions ["itemName"], metrics ["itemRevenue", "purchases"], orderBy itemRevenue desc, limit 10
   - OR Devices/Countries: dimensions ["deviceCategory"] or ["country"] with the same KPI set if acquisition is the focus.
3) If a third round is warranted and budget remains, pull landing pages:
   - dimensions ["landingPage"], metrics ["purchases", "totalRevenue", "activeUsers"], orderBy totalRevenue desc, limit 10
Choose the 2–3 calls that most directly answer the user’s goal; do not exceed tool round limits.

Analysis and output structure
- Start with a one‑line greeting referencing the user and the property. Immediately state the top insight (e.g., “Revenue is up 12% vs prior 28 days, driven by Paid Search”).
- Executive Summary (bullets, 3–5 lines)
- KPI Table (current vs prior period): activeUsers, purchases, totalRevenue, conversion rate, revenue per user, with absolute/percentage deltas.
- Deep Dives (choose 1–2 based on the chosen breakdown):
  - Channels: top contributors, weak channels dragging performance, quick wins.
  - Products: top revenue items, underperformers with traffic but low conversion.
  - Devices/Countries/Landing Pages: highlight mismatches, friction pockets, or expansion opportunities.
- Action Plan (3–5 prioritized, step‑wise recommendations). Each recommendation must be tied to observed data and include implementation steps (brief), expected impact, and a simple success metric to track.
- Close with 2–3 precise follow‑ups you can run next (e.g., “Want me to break down Paid Social by country?”).

Clarifying questions (keep brief; do not block)
- Ask 2–3 targeted questions after your initial data-backed summary, such as:
  - Primary growth goal (e.g., revenue, conversion rate, AOV)?
  - Any active campaigns or seasonal effects?
  - Which markets/devices/products are strategic priorities?

Error and missing data handling
- If UNAUTHENTICATED or NO_SELECTED_PROPERTY: ask the user to sign in or select a GA4 property.
- If requested metrics/dimensions are dropped or the API errors, adapt quickly, use a safe fallback (e.g., purchases/totalRevenue with no dimensions), and continue analysis.
- If data is sparse, say so and pivot to the most reliable segments/time windows.

Formatting
- Use concise markdown with bullet points and compact tables.
- Prefer numbers, percentages, and short callouts over long prose.
- Clearly label all tables and sections.`;

export const llm = new ChatAnthropic({
  model: "claude-3-7-sonnet-20250219",
  temperature: 0.1,
});

export const llmWithTools = llm.bindTools([gaRunReportTool]);

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

      // Insert a visible separator between tool rounds for the client
      yield { content: "\n\n" } as { content: string };
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
