"use client";

import { type Message } from "ai";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocale } from "next-intl";

import { cn } from "@/lib/utils";
import { ChatList } from "@/components/chat-list";
import { ChatPanel } from "@/components/chat-panel";
import { EmptyScreen } from "@/components/empty-screen";
import { ChatScrollAnchor } from "@/components/chat-scroll-anchor";
import { api } from "@/trpc/react";

export interface ChatProps extends React.ComponentProps<"div"> {
  initialMessages?: Message[];
  id?: string;
}

export function Chat({ id, initialMessages, className }: ChatProps) {
  const locale = useLocale();
  const utils = api.useUtils();

  // Use custom chat implementation matching chat-window.tsx
  const [messages, setMessages] = useState<Message[]>(initialMessages ?? []);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentChatId, setCurrentChatId] = useState(id);
  const [isThinking, setIsThinking] = useState(false);

  useEffect(() => {
    if (isLoading) {
      setIsThinking(true);
    }
  }, [isLoading]);

  const setInputWrapper = (value: string | ((prev: string) => string)) => {
    if (typeof value === "function") {
      setInput(value);
    } else {
      setInput(value);
    }
  };

  const handleSubmit = async (message: string) => {
    if (!message.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: message,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          id: currentChatId,
        }),
      });

      if (response.status === 401) {
        toast.error(response.statusText);
        setIsLoading(false);
        setIsThinking(false);
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "",
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") {
                break;
              }

              try {
                const parsed = JSON.parse(data) as {
                  type: string;
                  content?: string;
                  chatId?: string;
                };
                if (parsed.type === "text" && parsed.content) {
                  if (isThinking) setIsThinking(false);
                  assistantMessage.content += parsed.content;
                  setMessages((prev) => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1] = {
                      ...assistantMessage,
                    };
                    return newMessages;
                  });
                } else if (parsed.type === "redirect" && parsed.chatId) {
                  // Invalidate the user chats cache to refresh the sidebar
                  void utils.user.getUserWithChats.invalidate();

                  // Update the current chat ID for subsequent operations
                  setCurrentChatId(parsed.chatId);

                  // Only update URL if we're not already on the chat ID page
                  if (!id || id !== parsed.chatId) {
                    // Update URL without navigation to prevent flicker
                    window.history.pushState(
                      null,
                      "",
                      `/${locale}/chat/${parsed.chatId}`,
                    );
                  }
                }
              } catch (e) {
                console.error("Error parsing chunk:", e);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Error in chat:", error);
      toast.error("Error while processing your request", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
      setIsThinking(false);
    }
  };

  const handleReload = async () => {
    if (messages.length > 0) {
      const lastUserMessage = [...messages]
        .reverse()
        .find((m) => m.role === "user");
      if (lastUserMessage) {
        // Remove the last assistant message and resend the last user message
        setMessages((prev) => {
          const newMessages = [...prev];
          if (newMessages[newMessages.length - 1]?.role === "assistant") {
            newMessages.pop();
          }
          return newMessages;
        });
        await handleSubmit(lastUserMessage.content);
      }
    }
    return null;
  };

  const handleStop = () => {
    setIsLoading(false);
    setIsThinking(false);
  };

  const append = async (
    message: Pick<Message, "content" | "role"> & { id?: string },
  ) => {
    await handleSubmit(message.content);
    return null;
  };

  return (
    <>
      <div className={cn("pt-4 pb-[200px] md:pt-10", className)}>
        {messages.length ? (
          <>
            <ChatList messages={messages} />
            <ChatScrollAnchor trackVisibility={isLoading} />
          </>
        ) : (
          <EmptyScreen setInput={setInputWrapper} />
        )}
        <ChatPanel
          id={currentChatId}
          isLoading={isLoading}
          stop={handleStop}
          append={append}
          reload={handleReload}
          messages={messages}
          input={input}
          setInput={setInputWrapper}
        />
      </div>
    </>
  );
}
