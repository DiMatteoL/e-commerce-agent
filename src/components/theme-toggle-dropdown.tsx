"use client";

import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Moon, Sun } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface ThemeToggleDropdownProps {
  className?: string;
}

export function ThemeToggleDropdown({ className }: ThemeToggleDropdownProps) {
  const { theme, setTheme } = useTheme();
  const t = useTranslations("NavUser");

  const handleThemeChange = (newTheme: string) => {
    if (newTheme) {
      setTheme(newTheme);
    }
  };

  return (
    <div className="flex w-full items-center justify-between px-2 py-1.5">
      <div className="flex items-center">
        {theme === "dark" ? (
          <Moon className="mr-2 h-4 w-4" />
        ) : (
          <Sun className="mr-2 h-4 w-4" />
        )}
        {t("theme")}
      </div>
      <ToggleGroup
        type="single"
        size="sm"
        value={theme}
        onValueChange={handleThemeChange}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className={className}
      >
        <ToggleGroupItem value="light" aria-label={t("light")}>
          <Sun className="h-4 w-4" />
        </ToggleGroupItem>
        <ToggleGroupItem value="dark" aria-label={t("dark")}>
          <Moon className="h-4 w-4" />
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
