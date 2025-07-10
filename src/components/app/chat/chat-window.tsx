"use client";

import { type Message } from "ai";
import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { toast } from "sonner";

import { ChatMessageBubble } from "./chat-message-bubble";
import { IntermediateStep } from "./intermediate-step";
import { Button } from "@/components/ui/button";
import { LoaderCircle, Paperclip } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { UploadDocumentsForm } from "./upload-document-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface Source {
  pageContent: string;
  metadata?: {
    loc?: {
      lines?: {
        from: number;
        to: number;
      };
    };
  };
}

function ChatMessages(props: {
  messages: Message[];
  emptyStateComponent: ReactNode;
  sourcesForMessages: Record<string, Source[]>;
  aiEmoji?: string;
  className?: string;
}) {
  return (
    <div className="mx-auto flex w-full max-w-[768px] flex-col pb-12">
      {props.messages.map((m, i) => {
        if (m.role === "system") {
          return <IntermediateStep key={m.id} message={m} />;
        }

        const sourceKey = (props.messages.length - 1 - i).toString();
        const sources = props.sourcesForMessages[sourceKey] ?? [];
        return (
          <ChatMessageBubble
            key={m.id}
            message={m}
            aiEmoji={props.aiEmoji}
            sources={sources}
          />
        );
      })}
    </div>
  );
}

export function ChatInput(props: {
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onStop?: () => void;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  loading?: boolean;
  placeholder?: string;
  children?: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  const disabled = props.loading && props.onStop == null;
  return (
    <form
      onSubmit={(e) => {
        e.stopPropagation();
        e.preventDefault();

        if (props.loading) {
          props.onStop?.();
        } else {
          props.onSubmit(e);
        }
      }}
      className={cn("flex w-full flex-col", props.className)}
    >
      <div className="border-input bg-secondary mx-auto flex w-full max-w-[768px] flex-col gap-2 rounded-lg border">
        <input
          value={props.value}
          placeholder={props.placeholder}
          onChange={props.onChange}
          className="border-none bg-transparent p-4 outline-none"
        />

        <div className="mr-2 mb-2 ml-4 flex justify-between">
          <div className="flex gap-3">{props.children}</div>

          <div className="flex gap-2 self-end">
            {props.actions}
            <Button type="submit" className="self-end" disabled={disabled}>
              {props.loading ? (
                <span role="status" className="flex justify-center">
                  <LoaderCircle className="animate-spin" />
                  <span className="sr-only">Loading...</span>
                </span>
              ) : (
                <span>Send</span>
              )}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}

export function ChatLayout(props: { content: ReactNode; footer: ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-4">{props.content}</div>
      <div className="border-t p-4">{props.footer}</div>
    </div>
  );
}

export function ChatWindow(props: {
  endpoint?: string;
  emptyStateComponent: ReactNode;
  placeholder?: string;
  emoji?: string;
  showIngestForm?: boolean;
  showIntermediateStepsToggle?: boolean;
}) {
  const [showIntermediateSteps, setShowIntermediateSteps] = useState(
    !!props.showIntermediateStepsToggle,
  );
  const [intermediateStepsLoading, setIntermediateStepsLoading] =
    useState(false);

  const [sourcesForMessages, setSourcesForMessages] = useState<
    Record<string, Source[]>
  >({});

  // Use custom chat implementation with our API
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
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
        }),
      });

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
                };
                if (parsed.type === "text" && parsed.content) {
                  assistantMessage.content += parsed.content;
                  setMessages((prev) => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1] = {
                      ...assistantMessage,
                    };
                    return newMessages;
                  });
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
    }
  };

  const chat = {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
  };

  async function sendMessage(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (chat.isLoading || intermediateStepsLoading) return;

    if (!showIntermediateSteps) {
      await chat.handleSubmit(e);
      return;
    }

    // Simplified version without complex intermediate steps
    await chat.handleSubmit(e);
  }

  return (
    <ChatLayout
      content={
        chat.messages.length === 0 ? (
          <div>{props.emptyStateComponent}</div>
        ) : (
          <ChatMessages
            aiEmoji={props.emoji}
            messages={chat.messages}
            emptyStateComponent={props.emptyStateComponent}
            sourcesForMessages={sourcesForMessages}
          />
        )
      }
      footer={
        <ChatInput
          value={chat.input}
          onChange={chat.handleInputChange}
          onSubmit={sendMessage}
          loading={chat.isLoading || intermediateStepsLoading}
          placeholder={props.placeholder ?? "What's it like to be a pirate?"}
        >
          {props.showIngestForm && (
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  className="-ml-2 pr-3 pl-2"
                  disabled={chat.messages.length !== 0}
                >
                  <Paperclip className="size-4" />
                  <span>Upload document</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Upload document</DialogTitle>
                  <DialogDescription>
                    Upload a document to use for the chat.
                  </DialogDescription>
                </DialogHeader>
                <UploadDocumentsForm />
              </DialogContent>
            </Dialog>
          )}

          {props.showIntermediateStepsToggle && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="show_intermediate_steps"
                name="show_intermediate_steps"
                checked={showIntermediateSteps}
                disabled={chat.isLoading || intermediateStepsLoading}
                onCheckedChange={(checked) =>
                  setShowIntermediateSteps(!!checked)
                }
              />
              <label htmlFor="show_intermediate_steps" className="text-sm">
                Show intermediate steps
              </label>
            </div>
          )}
        </ChatInput>
      }
    />
  );
}
