"use client";

import { ChatWindow } from "@/components/app/chat/chat-window";
import { LatestPost } from "@/components/post";
import { api } from "@/trpc/react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";

export default function AppPage() {
  const { data: session } = useSession();
  const { data: hello } = api.post.hello.useQuery({ text: "from tRPC" });
  const t = useTranslations("HomePage");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <div className="flex flex-col items-center gap-2">
        <p>{hello ? hello.greeting : "Loading tRPC query..."}</p>

        <div className="flex flex-col items-center justify-center gap-4">
          <p>{session && <span>Logged in as {session.user?.name}</span>}</p>
        </div>
      </div>
      <LatestPost />
      <p>{t("title")}</p>

      <ChatWindow
        endpoint="/api/chat"
        emptyStateComponent={<div>No messages yet</div>}
        placeholder="Ask me anything..."
      />
    </div>
  );
}
