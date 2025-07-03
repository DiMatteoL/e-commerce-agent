import { CTASection } from "@/components/landing/sections/cta-section";
import { FAQSection } from "@/components/landing/sections/faq-section";
import { FooterSection } from "@/components/landing/sections/footer-section";
import { HeroSection } from "@/components/landing/sections/hero-section";
import { LandingNavbar } from "@/components/landing/sections/landing-navbar";
import { PricingSection } from "@/components/landing/sections/pricing-section";

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
