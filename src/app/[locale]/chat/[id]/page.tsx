"use client";

import { Chat } from "@/components/chat";
import { api } from "@/trpc/react";
import { useParams } from "next/navigation";
import { type Message } from "ai";

export default function ChatIdPage() {
  const params = useParams();
  const chatId = params.id as string;

  const {
    data: chat,
    isLoading,
    error,
  } = api.chat.getChat.useQuery(
    { id: chatId },
    {
      enabled: !!chatId,
    },
  );

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading chat...</div>
      </div>
    );
  }

  if (error || !chat) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">
          {error ? "Error loading chat" : "Chat not found"}
        </div>
      </div>
    );
  }

  // Convert chat messages to the format expected by the Chat component
  const initialMessages: Message[] = chat.messages.map((msg) => ({
    id: msg.id,
    role: msg.role as "user" | "assistant" | "system",
    content: msg.content,
  }));

  return <Chat id={chatId} initialMessages={initialMessages} />;
}
