import * as React from "react";
import Link from "next/link";
import Textarea from "react-textarea-autosize";
import { useTranslations } from "next-intl";

import { useEnterSubmit } from "@/hooks/use-enter-submit";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CornerDownLeft, Plus } from "lucide-react";

export interface PromptProps {
  input: string;
  setInput: (value: string | ((prev: string) => string)) => void;
  onSubmit: (value: string) => Promise<void>;
  isLoading: boolean;
}

export function PromptForm({
  onSubmit,
  input,
  setInput,
  isLoading,
}: PromptProps) {
  const t = useTranslations("PromptForm");
  const { formRef, onKeyDown } = useEnterSubmit();
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!input?.trim()) {
          return;
        }
        setInput("");
        await onSubmit(input);
      }}
      ref={formRef}
    >
      <div className="bg-background relative flex max-h-60 w-full grow flex-col overflow-hidden px-8 sm:rounded-md sm:border sm:px-12">
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href="/"
              className={cn(
                buttonVariants({ size: "sm", variant: "outline" }),
                "bg-background absolute top-4 left-0 h-8 w-8 rounded-full p-0 sm:left-4",
              )}
            >
              <Plus />
              <span className="sr-only">{t("newChat")}</span>
            </Link>
          </TooltipTrigger>
          <TooltipContent>{t("newChat")}</TooltipContent>
        </Tooltip>
        <Textarea
          ref={inputRef}
          tabIndex={0}
          onKeyDown={onKeyDown}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("placeholder")}
          spellCheck={false}
          className="min-h-[60px] w-full resize-none bg-transparent px-4 py-[1.3rem] focus-within:outline-none sm:text-sm"
        />
        <div className="absolute top-1/2 -translate-y-1/2 right-0 sm:right-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="submit"
                size="icon"
                variant="secondary"
                disabled={isLoading || input === ""}
                className="h-8 w-8"
              >
                <CornerDownLeft />
                <span className="sr-only">{t("sendMessage")}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("sendMessage")}</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </form>
  );
}
