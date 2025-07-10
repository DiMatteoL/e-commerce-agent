"use client";

import { locales } from "@/i18n/routing";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useLocale } from "next-intl";
import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface LanguagePickerProps {
  className?: string;
}

export function LanguagePicker({ className }: LanguagePickerProps) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const handleLanguageChange = (newLocale: string) => {
    router.push(pathname, { locale: newLocale });
  };

  const getLanguageDisplay = (locale: string) => {
    switch (locale) {
      case "en":
        return "EN";
      case "fr":
        return "FR";
      default:
        return locale.toUpperCase();
    }
  };

  const getLanguageName = (locale: string) => {
    switch (locale) {
      case "en":
        return "English";
      case "fr":
        return "Français";
      default:
        return locale;
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "border-border bg-background hover:bg-accent hover:text-accent-foreground flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
            className,
          )}
        >
          <Globe className="size-4" />
          <span className="font-medium">{getLanguageDisplay(locale)}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {locales.map((loc) => (
          <DropdownMenuItem
            key={loc}
            onClick={() => handleLanguageChange(loc)}
            className={cn(
              "cursor-pointer",
              locale === loc && "bg-accent text-accent-foreground",
            )}
          >
            <div className="flex w-full items-center justify-between">
              <span>{getLanguageName(loc)}</span>
              <span className="text-muted-foreground text-xs font-medium">
                {getLanguageDisplay(loc)}
              </span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
