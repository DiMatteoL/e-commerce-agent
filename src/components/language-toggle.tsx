"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useState } from "react";
import { Globe, Loader2 } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface LanguageToggleProps {
  className?: string;
}

export function LanguageToggle({ className }: LanguageToggleProps) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("NavUser");
  const [isChanging, setIsChanging] = useState(false);

  const handleLanguageChange = (newLocale: string) => {
    if (newLocale && newLocale !== locale) {
      setIsChanging(true);
      // Small delay to show loading state before navigation
      setTimeout(() => {
        router.push(pathname ?? "/", { locale: newLocale });
      }, 100);
    }
  };

  return (
    <div className="flex w-full items-center justify-between px-2 py-1.5">
      <div className="flex items-center">
        {isChanging ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Globe className="mr-2 h-4 w-4" />
        )}
        {t("language")}
      </div>
      <ToggleGroup
        type="single"
        size="sm"
        value={locale}
        onValueChange={handleLanguageChange}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className={className}
        disabled={isChanging}
      >
        <ToggleGroupItem value="en" aria-label="English" disabled={isChanging}>
          EN
        </ToggleGroupItem>
        <ToggleGroupItem value="fr" aria-label="Français" disabled={isChanging}>
          FR
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
