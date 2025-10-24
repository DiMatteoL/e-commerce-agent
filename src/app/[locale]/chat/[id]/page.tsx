"use client";

import { Chat } from "@/components/chat";
import { api } from "@/trpc/react";
import { useParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { type Message } from "ai";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import type { Chat as ChatType } from "@/server/api/routers/chat";

export default function ChatIdPage() {
  const t = useTranslations("ChatPage");
  const params = useParams();
  const router = useRouter();
  const { status: authStatus } = useSession();
  const chatId = params.id as string;
  const [chat, setChat] = useState<ChatType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const utils = api.useUtils();

  // Redirect unauthorized users to home page
  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.replace("/");
    }
  }, [authStatus, router]);

  const getChatOrClaimMutation = api.chat.getChatOrClaim.useMutation({
    onSuccess: (data) => {
      setChat(data);
      setIsLoading(false);
      // Invalidate user chats cache to update sidebar
      void utils.user.getUserWithChats.invalidate();
    },
    onError: (err) => {
      const errorMessage = err.message ?? t("error");
      setError(errorMessage);
      setIsLoading(false);
    },
  });

  useEffect(() => {
    // Only fetch chat if user is authenticated
    if (authStatus === "authenticated" && chatId) {
      getChatOrClaimMutation.mutate({ id: chatId });
    }
    // Only depend on chatId and authStatus to avoid infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, authStatus]);

  // Show loading while checking auth or loading chat
  if (authStatus === "loading" || isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">{t("loading")}</div>
      </div>
    );
  }

  // Redirecting to home page (show nothing to avoid flash)
  if (authStatus === "unauthenticated") {
    return null;
  }

  if (error || !chat) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">{error ?? t("notFound")}</div>
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
