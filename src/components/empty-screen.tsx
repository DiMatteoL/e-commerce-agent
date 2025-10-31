"use client";

import { type UseChatHelpers } from "ai/react";
import { useTranslations } from "next-intl";

import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/logo";

export function EmptyScreen({ setInput }: Pick<UseChatHelpers, "setInput">) {
  const t = useTranslations("EmptyScreen");

  const exampleMessages = [
    {
      heading: t("examples.conversionRates"),
      message: t("messages.conversionRates"),
    },
    {
      heading: t("examples.cartAbandonment"),
      message: t("messages.cartAbandonment"),
    },
    {
      heading: t("examples.trafficSources"),
      message: t("messages.trafficSources"),
    },
  ];

  return (
    <div className="mx-auto max-w-2xl px-4">
      <div className="bg-primary flex flex-col rounded-2xl border border-white/20 p-6 shadow-2xl shadow-black/20">
        {/* Logo and Badges */}
        <div className="mb-5 flex w-full items-center justify-between">
          <div className="text-white">
            <Logo size={50} />
          </div>
          <div className="inline-flex items-center gap-2">
            <div className="bg-secondary inline-flex items-center justify-center rounded-lg px-3 py-1.5 shadow-sm">
              <span className="text-sm font-bold tracking-wide text-black">
                AI
              </span>
            </div>
            <div className="inline-flex items-center justify-center rounded-lg border-2 border-white/30 px-3 py-1.5">
              <span className="text-sm font-bold tracking-wide text-white/90">
                BETA
              </span>
            </div>
          </div>
        </div>

        {/* Title and Description */}
        <div className="mb-5 space-y-2">
          <h1 className="text-lg leading-tight font-bold tracking-tight text-white">
            {t("title")}
          </h1>
          <p className="text-sm leading-relaxed font-medium text-white/90">
            {t("description")}
          </p>
        </div>

        {/* Separator */}
        <div className="mb-5 h-px w-full bg-linear-to-r from-transparent via-white/30 to-transparent" />

        {/* CTAs Section */}
        <div className="flex w-full flex-col gap-2">
          {exampleMessages.map((message, index) => (
            <button
              key={index}
              onClick={() => setInput(message.message)}
              className="group hover:text-secondary flex items-center gap-2.5 text-left text-sm font-medium text-white transition-all hover:translate-x-1"
            >
              <ArrowRight className="text-secondary h-4 w-4 transition-transform group-hover:translate-x-1" />
              <span className="flex-1">{message.heading}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
