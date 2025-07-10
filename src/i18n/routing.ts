import { defineRouting } from "next-intl/routing";

export const locales = ["en", "fr"];

export const routing = defineRouting({ locales, defaultLocale: "en" });
