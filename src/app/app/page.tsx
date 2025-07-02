import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { LatestPost } from "@/components/post";
import { api, HydrateClient } from "@/trpc/server";
import { Navbar } from "@/components/sections/navbar";

export default async function AppPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/api/auth/signin?callbackUrl=/app");
  }
  const hello = await api.post.hello({ text: "from tRPC" });

  if (session?.user) {
    void api.post.getLatest.prefetch();
  }

  return (
    <>
      <Navbar />
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <div className="flex flex-col items-center gap-2">
          <p>{hello ? hello.greeting : "Loading tRPC query..."}</p>

          <div className="flex flex-col items-center justify-center gap-4">
            <p>{session && <span>Logged in as {session.user?.name}</span>}</p>
          </div>
        </div>
        {session?.user && <LatestPost />}
      </div>
    </>
  );
}
