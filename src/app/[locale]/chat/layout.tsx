import "@/styles/globals.css";

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;

  // return <SessionGuard fallback={<CenteredSpinner />}>{children}</SessionGuard>;
}
