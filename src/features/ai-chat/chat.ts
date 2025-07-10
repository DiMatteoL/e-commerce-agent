import { calculatorTool } from "@/features/ai-chat/tools/operate";
import { ChatAnthropic } from "@langchain/anthropic";
import { HumanMessage, AIMessage } from "@langchain/core/messages";

const llm = new ChatAnthropic({
  model: "claude-3-5-sonnet-20240620",
  temperature: 0,
});

const llmWithTools = llm.bindTools([calculatorTool]);

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}

export async function* chatStream(
  messages: ChatMessage[],
  options?: {
    onToolCall?: (toolCall: unknown) => void;
  },
) {
  try {
    // Convert messages to LangChain format
    const langchainMessages = messages.map((msg) => {
      if (msg.role === "user") {
        return new HumanMessage(msg.content);
      } else if (msg.role === "assistant") {
        return new AIMessage(msg.content);
      }
      return new HumanMessage(msg.content); // fallback
    });

    // Stream the response
    const stream = await llmWithTools.stream(langchainMessages);

    let fullResponse = "";
    for await (const chunk of stream) {
      const content = chunk.content;
      if (typeof content === "string") {
        fullResponse += content;
        yield {
          type: "text",
          content: content,
          fullResponse: fullResponse,
        };
      }

      // Handle tool calls
      if (chunk.tool_calls && chunk.tool_calls.length > 0) {
        for (const toolCall of chunk.tool_calls) {
          options?.onToolCall?.(toolCall);
          yield {
            type: "tool_call",
            toolCall: toolCall,
          };
        }
      }
    }
  } catch (error) {
    console.error("Error in chatStream:", error);
    yield {
      type: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function processChat(messages: ChatMessage[]): Promise<string> {
  const langchainMessages = messages.map((msg) => {
    if (msg.role === "user") {
      return new HumanMessage(msg.content);
    } else if (msg.role === "assistant") {
      return new AIMessage(msg.content);
    }
    return new HumanMessage(msg.content); // fallback
  });

  const response = await llmWithTools.invoke(langchainMessages);
  return response.content as string;
}
