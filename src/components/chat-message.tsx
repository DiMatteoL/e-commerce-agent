import { type Message } from "ai";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { CodeBlock } from "@/components/ui/codeblock";
import { MemoizedReactMarkdown } from "@/components/markdown";
import { ChatMessageActions } from "@/components/chat-message-actions";
import { User } from "lucide-react";
import { SmallLogo } from "@/components/small-logo";

interface CodeProps {
  inline?: boolean;
  className?: string;
  children?: ReactNode;
}

export interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message, ...props }: ChatMessageProps) {
  return (
    <div
      className={cn("group relative mb-4 flex items-start md:-ml-12")}
      {...props}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-md select-none",
          message.role === "user"
            ? "bg-background border shadow"
            : "bg-brand-gradient text-white",
        )}
      >
        {message.role === "user" ? <User /> : <SmallLogo size={20} />}
      </div>
      <div className="ml-4 flex-1 space-y-2 overflow-hidden px-1">
        <MemoizedReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          components={{
            p({ children }) {
              return <p className="mb-2 last:mb-0">{children}</p>;
            },
            code(props) {
              const { inline, className, children, ...rest } =
                props as CodeProps;

              // Safely convert children to string
              let content = "";
              if (typeof children === "string") {
                content = children;
              } else if (Array.isArray(children)) {
                content = children.join("");
              }

              // Show animated cursor indicator
              if (content === "▍") {
                return (
                  <span className="mt-1 animate-pulse cursor-default">▍</span>
                );
              }

              const match = /language-(\w+)/.exec(className ?? "");

              if (inline) {
                return (
                  <code className={className} {...rest}>
                    {content.replace(/`▍`/g, "▍")}
                  </code>
                );
              }

              return (
                <CodeBlock
                  key={Math.random()}
                  language={match?.[1] ?? ""}
                  value={content.replace(/\n$/, "")}
                  {...rest}
                />
              );
            },
          }}
        >
          {message.content}
        </MemoizedReactMarkdown>
        <ChatMessageActions message={message} />
      </div>
    </div>
  );
}
