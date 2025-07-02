import Link from "next/link";

import { CompanyShowcase } from "@/components/sections/company-showcase";
import { CTASection } from "@/components/sections/cta-section";
import { FAQSection } from "@/components/sections/faq-section";
import { FooterSection } from "@/components/sections/footer-section";
import { HeroSection } from "@/components/sections/hero-section";
import { PricingSection } from "@/components/sections/pricing-section";
import { LatestPost } from "@/components/post";
import { auth } from "@/server/auth";
import { api, HydrateClient } from "@/trpc/server";

export default async function Home() {
  const hello = await api.post.hello({ text: "from tRPC" });
  const session = await auth();

  if (session?.user) {
    void api.post.getLatest.prefetch();
  }

  return (
    <HydrateClient>
      <main className="divide-border flex min-h-screen w-full flex-col items-center justify-center divide-y">
        <HeroSection />
        <div className="flex flex-col items-center gap-2">
          <p className="text-2xl text-white">
            {hello ? hello.greeting : "Loading tRPC query..."}
          </p>

          <div className="flex flex-col items-center justify-center gap-4">
            <p className="text-center text-2xl text-white">
              {session && <span>Logged in as {session.user?.name}</span>}
            </p>
            <Link
              href={session ? "/api/auth/signout" : "/api/auth/signin"}
              className="rounded-full bg-white/10 px-10 py-3 font-semibold no-underline transition hover:bg-white/20"
            >
              {session ? "Sign out" : "Sign in"}
            </Link>
          </div>
        </div>

        {session?.user && <LatestPost />}
        <FAQSection />
        <PricingSection />
        <CTASection />
        <FooterSection />
      </main>
    </HydrateClient>
  );
}
