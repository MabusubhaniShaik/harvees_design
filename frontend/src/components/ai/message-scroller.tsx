import * as React from "react"

import {
  Message,
  MessageLoader,
  type AssistantMessage,
} from "@/components/ai/message"

type MessageScrollerProps = {
  messages: AssistantMessage[]
  emptyState: React.ReactNode
  loading?: boolean
}

export function MessageScroller({
  messages,
  emptyState,
  loading = false,
}: MessageScrollerProps) {
  const bottomRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages, loading])

  if (messages.length === 0) {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/20 p-6 text-center">
        {emptyState}
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto pr-1">
      {messages.map((message) => (
        <Message key={message.id} message={message} />
      ))}
      {loading ? <MessageLoader /> : null}
      <div ref={bottomRef} />
    </div>
  )
}
