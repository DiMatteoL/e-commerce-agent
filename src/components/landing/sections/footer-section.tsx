"use client";

import { Icons } from "@/components/icons";
import { LinkedInLogoIcon, TwitterLogoIcon } from "@radix-ui/react-icons";
import { FlickeringGrid } from "@/components/ui/flickering-grid";
import { siteConfig } from "@/lib/config";
import Link from "next/link";
import { useMediaQuery } from "usehooks-ts";
import type { JSX } from "react";

type Link = {
  text: string;
  url: string;
};

interface Icon {
  icon: JSX.Element;
  url: string;
}

const icons: Icon[] = [
  {
    icon: <LinkedInLogoIcon className="size-6" />,
    url: "https://www.linkedin.com",
  },
  {
    icon: <TwitterLogoIcon className="size-6" />,
    url: "https://www.twitter.com",
  },
];

export function FooterSection() {
  const tablet = useMediaQuery("(max-width: 1024px)");

  return (
    <footer id="footer" className="w-full pb-0">
      <div className="flex flex-col p-10 md:flex-row md:items-center md:justify-between">
        <div className="mx-0 flex max-w-xs flex-col items-start justify-start gap-y-5">
          <Link href="/" className="flex items-center gap-2">
            <Icons.logo className="size-8" />
            <p className="text-primary text-xl font-semibold">SkyAgent</p>
          </Link>
          <p className="text-muted-foreground font-medium tracking-tight">
            {siteConfig.hero.description}
          </p>
        </div>
        <div className="flex items-center gap-x-4">
          {icons.map((icon, index) => (
            <a
              key={index}
              href={icon.url}
              className="text-xl text-neutral-500 hover:text-neutral-900 hover:dark:text-white"
              target="_blank"
              rel="noopener noreferrer"
            >
              {icon.icon}
            </a>
          ))}
        </div>
      </div>
      <div className="relative z-0 h-48 w-full md:h-64">
        <div className="to-background absolute inset-0 z-10 bg-gradient-to-t from-transparent from-40%" />
        <div className="absolute inset-0 mx-6">
          <FlickeringGrid
            text={tablet ? "SkyAgent" : "Streamline your workflow"}
            fontSize={tablet ? 70 : 90}
            className="h-full w-full"
            squareSize={2}
            gridGap={tablet ? 2 : 3}
            color="#6B7280"
            maxOpacity={0.3}
            flickerChance={0.1}
          />
        </div>
      </div>
    </footer>
  );
}
