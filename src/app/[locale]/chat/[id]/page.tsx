"use client";

import { Chat } from "@/components/chat";
import { api } from "@/trpc/react";
import { useParams } from "next/navigation";
import { type Message } from "ai";
import { useEffect, useState } from "react";
import type { Chat as ChatType } from "@/server/api/routers/chat";

export default function ChatIdPage() {
  const params = useParams();
  const chatId = params.id as string;
  const [chat, setChat] = useState<ChatType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const utils = api.useUtils();

  const getChatOrClaimMutation = api.chat.getChatOrClaim.useMutation({
    onSuccess: (data) => {
      setChat(data);
      setIsLoading(false);
      // Invalidate user chats cache to update sidebar
      void utils.user.getUserWithChats.invalidate();
    },
    onError: (err) => {
      setError(err.message ?? "Error loading chat");
      setIsLoading(false);
    },
  });

  useEffect(() => {
    if (chatId) {
      getChatOrClaimMutation.mutate({ id: chatId });
    }
    // Only depend on chatId to avoid infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

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
        <div className="text-muted-foreground">{error ?? "Chat not found"}</div>
      </div>
    );
  }

  // Convert chat messages to the format expected by the Chat component
  const initialMessages: Message[] = chat.messages.map((msg) => ({
    id: msg.id,
    role: msg.role,
    content: msg.content,
  }));

  return <Chat id={chatId} initialMessages={initialMessages} />;
}
