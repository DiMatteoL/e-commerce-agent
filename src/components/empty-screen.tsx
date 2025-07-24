"use client";

import { type UseChatHelpers } from "ai/react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

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
      <div className="bg-background rounded-lg border p-8">
        <h1 className="mb-2 text-lg font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground leading-normal">
          {t("description")}
        </p>
        <div className="mt-4 flex flex-col items-start space-y-2">
          {exampleMessages.map((message, index) => (
            <Button
              key={index}
              variant="link"
              className="h-auto p-0 text-base"
              onClick={() => setInput(message.message)}
            >
              <ArrowRight className="text-muted-foreground mr-2" />
              {message.heading}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
