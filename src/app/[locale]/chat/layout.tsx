import "@/styles/globals.css";

import { SessionGuard } from "@/components/app/session-guard";
import { CenteredSpinner } from "@/components/ui/spinner";

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;

  // return <SessionGuard fallback={<CenteredSpinner />}>{children}</SessionGuard>;
}
