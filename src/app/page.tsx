import { CTASection } from "@/components/sections/cta-section";
import { FAQSection } from "@/components/sections/faq-section";
import { FooterSection } from "@/components/sections/footer-section";
import { HeroSection } from "@/components/sections/hero-section";
import { LandingNavbar } from "@/components/sections/landing-navbar";
import { PricingSection } from "@/components/sections/pricing-section";

export default async function Home() {
  return (
    <>
      <LandingNavbar />
      <main className="divide-border flex min-h-screen w-full flex-col items-center justify-center divide-y">
        <HeroSection />
        <FAQSection />
        <PricingSection />
        <CTASection />
        <FooterSection />
      </main>
    </>
  );
}
