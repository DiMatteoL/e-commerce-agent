import { type Message } from "ai";

import { Button } from "@/components/ui/button";
import { PromptForm } from "@/components/prompt-form";
import { ButtonScrollToBottom } from "@/components/button-scroll-to-bottom";
import { CircleStop, RefreshCcw } from "lucide-react";

export interface ChatPanelProps {
  id?: string;
  isLoading: boolean;
  stop: () => void;
  append: (
    message: Pick<Message, "content" | "role"> & { id?: string },
  ) => Promise<null>;
  reload: () => Promise<null>;
  messages: Message[];
  input: string;
  setInput: (value: string | ((prev: string) => string)) => void;
}

export function ChatPanel({
  id,
  isLoading,
  stop,
  append,
  reload,
  input,
  setInput,
  messages,
}: ChatPanelProps) {
  return (
    <div className="from-muted/10 to-muted/30 fixed inset-x-0 bottom-0 bg-gradient-to-b from-10% to-50% md:right-0 md:left-[var(--sidebar-width)]">
      <ButtonScrollToBottom />
      <div className="mx-auto sm:max-w-2xl sm:px-4">
        <div className="flex h-10 items-center justify-center">
          {isLoading ? (
            <Button
              variant="outline"
              onClick={() => stop()}
              className="bg-background"
            >
              <CircleStop className="mr-2" />
              Stop generating
            </Button>
          ) : (
            messages?.length > 0 && (
              <Button
                variant="outline"
                onClick={() => void reload()}
                className="bg-background"
              >
                <RefreshCcw className="mr-2" />
                Regenerate response
              </Button>
            )
          )}
        </div>
        <div className="bg-background space-y-4 border-t px-4 py-2 shadow-lg sm:rounded-t-xl sm:border md:py-4">
          <PromptForm
            onSubmit={async (value) => {
              await append({
                id,
                content: value,
                role: "user",
              });
            }}
            input={input}
            setInput={setInput}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
}
