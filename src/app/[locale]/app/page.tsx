"use client";

import { LatestPost } from "@/components/post";
import { api } from "@/trpc/react";
import { useSession } from "next-auth/react";

export default function AppPage() {
  const { data: session } = useSession();
  const { data: hello } = api.post.hello.useQuery({ text: "from tRPC" });

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <div className="flex flex-col items-center gap-2">
        <p>{hello ? hello.greeting : "Loading tRPC query..."}</p>

        <div className="flex flex-col items-center justify-center gap-4">
          <p>{session && <span>Logged in as {session.user?.name}</span>}</p>
        </div>
      </div>
      <LatestPost />
    </div>
  );
}
