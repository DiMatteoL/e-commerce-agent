import type { Message as VercelChatMessage } from "ai";
import { nanoid } from "nanoid";

import { db } from "@/server/db";
import { chats } from "@/server/db/schema";

export interface SaveChatParams {
  chatId?: string;
  userId: string;
  messages: VercelChatMessage[];
  assistantResponse: string;
}

export async function saveChat({
  chatId,
  userId,
  messages,
  assistantResponse,
}: SaveChatParams): Promise<string> {
  // Generate ID if not provided
  const id = chatId ?? nanoid();

  // Get title from first message
  const title = messages[0]?.content?.substring(0, 100) ?? "New Chat";
  const createdAt = new Date();

  const payload = {
    id,
    title,
    userId,
    createdAt: createdAt.toISOString(),
    path: `/chat/${id}`,
    messages: [
      ...messages,
      {
        content: assistantResponse,
        role: "assistant" as const,
      },
    ],
  };

  // Insert chat into database using Drizzle
  await db
    .insert(chats)
    .values({
      id,
      userId,
      payload,
      createdAt,
    })
    .onConflictDoUpdate({
      target: chats.id,
      set: {
        payload,
        updatedAt: new Date(),
      },
    });

  return id;
}
