import { type NextRequest } from "next/server";
import type { Message as VercelChatMessage } from "ai";

import { chatStream } from "@/features/ai-chat/chat";
import { saveChat } from "@/features/ai-chat/save-chat";
import { auth } from "@/server/auth";

/**
 * This handler uses LangChain Anthropic with streaming response
 * Compatible with the chat-window.tsx frontend expectations
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      messages?: VercelChatMessage[];
      id?: string;
    };
    console.log("body", body);
    const messages = body.messages ?? [];
    const chatId = body.id;

    // Get the current user session
    const session = await auth();
    const userId = session?.user?.id;

    // Prepare user info for the bot if user is authenticated
    const userInfo = session?.user
      ? {
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
          image: session.user.image,
        }
      : undefined;

    // Create the stream with user context
    const stream = await chatStream(messages, userInfo);

    // Collect the complete assistant response
    let assistantResponse = "";

    // Create a readable stream that formats the response for the frontend
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.content;
            if (typeof content === "string") {
              assistantResponse += content;
              const data = JSON.stringify({
                type: "text",
                content: content,
              });
              const formatted = `data: ${data}\n\n`;
              controller.enqueue(new TextEncoder().encode(formatted));
            }
          }

          // Save the chat to database after streaming is complete
          if (userId && messages.length > 0) {
            await saveChat({
              chatId,
              userId,
              messages,
              assistantResponse,
            });
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
