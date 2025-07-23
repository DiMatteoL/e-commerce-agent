import "@/styles/globals.css";

import { SessionProvider } from "next-auth/react";
import { SessionGuard } from "@/components/app/session-guard";
import { CenteredSpinner } from "@/components/ui/spinner";
import { auth } from "@/server/auth";
import { redirect } from "next/navigation";

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  if (!session?.user) {
    redirect("/api/auth/signin?callbackUrl=/app");
  }

  return (
    <SessionProvider session={session}>
      <main>
        <SessionGuard fallback={<CenteredSpinner />}>{children}</SessionGuard>
      </main>
    </SessionProvider>
  );
}
