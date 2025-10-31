import { type Metadata } from "next";

export function generateSiteMetadata(): Metadata {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ai.hint.work";
  const ogImage = `${siteUrl}/og-image.png`;

  return {
    title: "Hint AI - E-commerce Analytics & Optimization Assistant",
    description:
      "Unlock powerful insights to grow your business. AI-powered assistant that analyzes your Google Analytics data to optimize your business.",
    icons: [{ rel: "icon", url: "/favicon.ico" }],
    openGraph: {
      type: "website",
      locale: "fr",
      url: siteUrl,
      title: "Hint AI - E-commerce Analytics & Optimization Assistant",
      description:
        "Unlock powerful insights to grow your business. AI-powered assistant that analyzes your Google Analytics data to optimize your business.",
      siteName: "Hint AI",
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: "Hint AI - E-commerce Optimization Assistant",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "Hint AI - E-commerce Analytics & Optimization Assistant",
      description:
        "Unlock powerful insights to grow your business. AI-powered assistant that analyzes your Google Analytics data to optimize your business.",
      images: [ogImage],
    },
  };
}
