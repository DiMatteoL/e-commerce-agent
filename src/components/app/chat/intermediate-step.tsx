import { useState } from "react";
import type { Message } from "ai/react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";

export function IntermediateStep(props: { message: Message }) {
  const parsedInput = JSON.parse(props.message.content) as {
    action: { name: string; args: unknown };
    observation: string;
  };
  const action = parsedInput.action;
  const observation = parsedInput.observation;
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="bg-secondary border-input mr-auto mb-8 flex max-w-[80%] flex-col rounded border p-3 whitespace-pre-wrap">
      <button
        type="button"
        className={cn(
          "flex items-center gap-1 text-left",
          expanded && "w-full",
        )}
        onClick={(e) => setExpanded(!expanded)}
      >
        <span>
          Step: <strong className="font-mono">{action.name}</strong>
        </span>
        <span className={cn(expanded && "hidden")}>
          <ChevronDown className="h-5 w-5" />
        </span>
        <span className={cn(!expanded && "hidden")}>
          <ChevronUp className="h-5 w-5" />
        </span>
      </button>
      <div
        className={cn(
          "max-h-[0px] overflow-hidden text-sm transition-[max-height] ease-in-out",
          expanded && "max-h-[360px]",
        )}
      >
        <div
          className={cn(
            "rounded",
            expanded ? "max-w-full" : "transition-[max-width] delay-100",
          )}
        >
          Input:{" "}
          <code className="max-h-[100px] overflow-auto">
            {JSON.stringify(action.args)}
          </code>
        </div>
        <div
          className={cn(
            "rounded",
            expanded ? "max-w-full" : "transition-[max-width] delay-100",
          )}
        >
          Output:{" "}
          <code className="max-h-[260px] overflow-auto">{observation}</code>
        </div>
      </div>
    </div>
  );
}
