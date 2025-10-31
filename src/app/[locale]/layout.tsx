import "@/styles/globals.css";

import { NextIntlClientProvider, hasLocale } from "next-intl";
import { Toaster } from "@/components/ui/sonner";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { TRPCReactProvider } from "@/trpc/react";
import { ThemeProvider } from "@/app/_providers/theme-provider";
import { HydrateClient } from "@/trpc/server";
import { getMessages } from "next-intl/server";
import { auth } from "@/server/auth";
import { SessionProvider } from "next-auth/react";
import { Header } from "@/components/app/header";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { GoogleConnectionBanner } from "@/components/google-connection-banner";
import { ClarityAnalytics } from "@/components/clarity-analytics";
import { generateSiteMetadata } from "@/lib/metadata";
import { geist } from "@/lib/fonts";

export async function generateMetadata() {
  return generateSiteMetadata();
}

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const messages = await getMessages();
  const session = await auth();

  return (
    <html
      lang={locale}
      className={`${geist.variable}`}
      suppressHydrationWarning
    >
      <body>
        <TRPCReactProvider>
          <HydrateClient>
            <ThemeProvider
              attribute="class"
              defaultTheme="light"
              enableSystem
              disableTransitionOnChange
            >
              <NextIntlClientProvider messages={messages}>
                <SessionProvider session={session}>
                  <SidebarProvider
                    style={
                      { "--sidebar-width": "350px" } as React.CSSProperties
                    }
                  >
                    <AppSidebar />
                    <SidebarInset>
                      <Header />
                      <GoogleConnectionBanner />
                      <div className="flex flex-1 flex-col gap-4 p-4">
                        {children}
                      </div>
                    </SidebarInset>
                  </SidebarProvider>
                  <Toaster />
                </SessionProvider>
              </NextIntlClientProvider>
            </ThemeProvider>
          </HydrateClient>
        </TRPCReactProvider>
        <ClarityAnalytics />
      </body>
    </html>
  );
}
