import { type NextRequest } from "next/server";
import type { Message as VercelChatMessage } from "ai";

import { ChatAnthropic } from "@langchain/anthropic";
import { PromptTemplate } from "@langchain/core/prompts";
import { HumanMessage, AIMessage } from "@langchain/core/messages";

export const runtime = "edge";

const formatMessage = (message: VercelChatMessage) => {
  if (message.role === "user") {
    return new HumanMessage(message.content);
  } else if (message.role === "assistant") {
    return new AIMessage(message.content);
  }
  return new HumanMessage(message.content); // fallback
};

const SYSTEM_PROMPT = `You are a pirate named Patchy. All responses must be extremely verbose and in pirate dialect.`;

/**
 * This handler uses LangChain Anthropic with streaming response
 * Compatible with the chat-window.tsx frontend expectations
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { messages?: VercelChatMessage[] };
    const messages = body.messages ?? [];

    // Convert messages to LangChain format
    const langchainMessages = messages.map(formatMessage);

    // Add system message at the beginning
    const allMessages = [new HumanMessage(SYSTEM_PROMPT), ...langchainMessages];

    const model = new ChatAnthropic({
      temperature: 0.8,
      model: "claude-3-haiku-20240307",
    });

    // Create the stream
    const stream = await model.stream(allMessages);

    // Create a readable stream that formats the response for the frontend
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.content;
            if (typeof content === "string") {
              const data = JSON.stringify({
                type: "text",
                content: content,
              });
              const formatted = `data: ${data}\n\n`;
              controller.enqueue(new TextEncoder().encode(formatted));
            }
          }

          // Send the done signal
          controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          console.error("Error in stream:", error);
          controller.error(error);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (e: unknown) {
    const error = e as Error;
    console.error("Error in chat route:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
