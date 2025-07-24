"use client";

import { type Message } from "ai";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCopyToClipboard } from "usehooks-ts";
import { Check, Copy } from "lucide-react";

interface ChatMessageActionsProps extends React.ComponentProps<"div"> {
  message: Message;
}

export function ChatMessageActions({
  message,
  className,
  ...props
}: ChatMessageActionsProps) {
  const [isCopied, copyToClipboard] = useCopyToClipboard();

  const onCopy = () => {
    if (isCopied) return;
    void copyToClipboard(message.content);
  };

  return (
    <div
      className={cn(
        "flex items-center justify-end transition-opacity group-hover:opacity-100 md:absolute md:-top-2 md:-right-10 md:opacity-0",
        className,
      )}
      {...props}
    >
      <Button variant="ghost" size="icon" onClick={onCopy}>
        {isCopied ? <Check /> : <Copy />}
        <span className="sr-only">Copy message</span>
      </Button>
    </div>
  );
}
