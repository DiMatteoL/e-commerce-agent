import { calculatorTool } from "@/features/ai-chat/tools/operate";
import { gaRunReportTool } from "@/features/ai-chat/tools/google-analytics";
import { ChatAnthropic } from "@langchain/anthropic";

import type { Message as VercelChatMessage } from "ai";
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
} from "@langchain/core/messages";

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

Example User Query: "My e-commerce site has low conversion rates. Sessions are up 10% but purchases are down."
Example Response Structure:
- Clarifying Questions: What is your average session conversion rate? Which traffic sources are performing best?
- Summary: Based on your data, increased sessions without conversions suggest issues in the funnel.
- Analysis: Compare to last month; check engagement rate and bounce rate in GA.
- Optimizations: 1. Enable enhanced e-commerce tracking... 2. Analyze checkout behavior...
- Visualizations: Suggest a conversion funnel graph.
- Impact: Potential 20% uplift in purchases.
`;

export const llm = new ChatAnthropic({
  model: "claude-3-5-sonnet-20240620",
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

  // Add system message at the beginning
  const allMessages = [new SystemMessage(systemPrompt), ...langchainMessages];

  // Create the stream
  const stream = await llm.stream(allMessages);

  return stream;
}

const formatMessage = (message: VercelChatMessage) => {
  if (message.role === "user") {
    return new HumanMessage(message.content);
  } else if (message.role === "assistant") {
    return new AIMessage(message.content);
  }
  return new HumanMessage(message.content); // fallback
};
