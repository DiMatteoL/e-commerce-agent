import { type NextRequest } from "next/server";
import type { Message as VercelChatMessage } from "ai";

import { chatStream } from "@/features/ai-chat/chat";
import { saveChat } from "@/features/ai-chat/save-chat";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import {
  googleAnalyticsAccounts,
  googleAnalyticsProperties,
} from "@/server/db/schema";
import { and, eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      messages?: VercelChatMessage[];
      id?: string;
    };
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

    // Fetch selected GA property for the user if available
    let selectedGa:
      | {
          id: number;
          propertyDisplayName: string | null;
          propertyResourceName: string;
          accountDisplayName: string | null;
        }
      | undefined = undefined;

    if (userId) {
      const rows = await db
        .select({
          id: googleAnalyticsProperties.id,
          propertyDisplayName: googleAnalyticsProperties.propertyDisplayName,
          propertyResourceName: googleAnalyticsProperties.propertyResourceName,
          accountDisplayName: googleAnalyticsAccounts.accountDisplayName,
        })
        .from(googleAnalyticsProperties)
        .innerJoin(
          googleAnalyticsAccounts,
          eq(googleAnalyticsProperties.accountId, googleAnalyticsAccounts.id),
        )
        .where(
          and(
            eq(googleAnalyticsProperties.userId, userId),
            eq(googleAnalyticsProperties.selected, true),
          ),
        )
        .limit(1);
      selectedGa = rows[0] ?? undefined;
    }

    // Early return with helpful message if user is not authenticated or GA not connected
    // This prevents slow AI inference with failing tool calls
    if (!userId || !selectedGa) {
      const helpMessage = !userId
        ? `👋 **Welcome!** To get started with GA4 data analysis, please:

1. **Sign in** to your account using the button in the top-right corner
2. **Connect your Google Analytics** account and grant read-only access to your Google Analytics data

Once connected, I'll be able to help you analyze conversion rates, identify opportunities, and provide data-driven recommendations for your e-commerce business.

*Note: We only request read-only access to Google Analytics. We never edit or delete your data.*`
        : `👋 **Almost there!** To analyze your GA4 data, please:

1. **Connect your Google Analytics** account (look for the banner at the top or use the property selector)
2. **Grant read-only access** when prompted by Google

Once connected, I'll be able to help you analyze conversion rates, identify opportunities, and provide data-driven recommendations based on your actual GA4 data.

*Note: We only request read-only access to Google Analytics. We never edit or delete your data.*`;

      const readableStream = new ReadableStream({
        start(controller) {
          const data = JSON.stringify({
            type: "text",
            content: helpMessage,
          });
          controller.enqueue(new TextEncoder().encode(`data: ${data}\n\n`));
          controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
          controller.close();
        },
      });

      return new Response(readableStream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // Create the stream with user and GA context
    const stream = await chatStream(messages, userInfo, selectedGa);

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
          if (messages.length > 0) {
            const finalChatId = await saveChat({
              chatId,
              userId,
              messages,
              assistantResponse,
              selectedGa: selectedGa
                ? {
                    id: selectedGa.id,
                    propertyDisplayName: selectedGa.propertyDisplayName,
                    propertyResourceName: selectedGa.propertyResourceName,
                    accountDisplayName: selectedGa.accountDisplayName,
                  }
                : undefined,
            });

            const redirectData = JSON.stringify({
              type: "redirect",
              chatId: finalChatId,
            });
            controller.enqueue(
              new TextEncoder().encode(`data: ${redirectData}\n\n`),
            );
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
