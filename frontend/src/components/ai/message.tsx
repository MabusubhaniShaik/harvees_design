import { Bot, User2 } from "lucide-react"

import { cn } from "@/lib/utils"

export type AssistantMessage = {
  id: string
  role: "user" | "assistant"
  content: string
}

type MessageProps = {
  message: AssistantMessage
}

export function Message({ message }: MessageProps) {
  const isAssistant = message.role === "assistant"

  return (
    <div
      className={cn(
        "flex w-full gap-3",
        isAssistant ? "justify-start" : "justify-end",
      )}
    >
      {isAssistant && (
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Bot className="size-4" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[85%] rounded-2xl border px-4 py-3 text-sm leading-6 shadow-sm",
          isAssistant
            ? "rounded-tl-md border-border bg-card text-card-foreground"
            : "rounded-tr-md border-primary/10 bg-primary text-primary-foreground",
        )}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
      </div>
      {!isAssistant && (
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
          <User2 className="size-4" />
        </div>
      )}
    </div>
  )
}

export function MessageLoader() {
  return (
    <div className="flex w-full justify-start gap-3">
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Bot className="size-4" />
      </div>
      <div className="flex items-center gap-1 rounded-2xl rounded-tl-md border border-border bg-card px-4 py-3 shadow-sm">
        <span className="size-2 rounded-full bg-muted-foreground/55 animate-[pulse_1.2s_ease-in-out_infinite]" />
        <span className="size-2 rounded-full bg-muted-foreground/55 animate-[pulse_1.2s_ease-in-out_0.15s_infinite]" />
        <span className="size-2 rounded-full bg-muted-foreground/55 animate-[pulse_1.2s_ease-in-out_0.3s_infinite]" />
      </div>
    </div>
  )
}
