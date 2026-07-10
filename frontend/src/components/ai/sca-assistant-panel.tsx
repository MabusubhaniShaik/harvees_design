import * as React from "react"
import { Loader2, SendHorizonal, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { TooltipButton } from "@/components/ui/tooltip-button"
import { Input } from "@/components/ui/input"
import { MessageScroller } from "@/components/ai/message-scroller"
import {
  fetchScaAiChatHistory,
  fetchScaAiConfig,
  sendScaAiMessage,
  type ScaAiConfig,
} from "@/lib/services/sca-ai"
import type { AssistantMessage } from "@/components/ai/message"

type ScaAssistantPanelProps = {
  title?: string
  description?: string
}

const createId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

export function ScaAssistantPanel({
  title = "Allocation AI Assistant",
  description = "Ask allocation questions from the latest generated run.",
}: ScaAssistantPanelProps) {
  const [config, setConfig] = React.useState<ScaAiConfig | null>(null)
  const [messages, setMessages] = React.useState<AssistantMessage[]>([])
  const [inputValue, setInputValue] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [bootLoading, setBootLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    Promise.all([fetchScaAiConfig(), fetchScaAiChatHistory()])
      .then(([configResult, historyResult]) => {
        setConfig(configResult)
        setMessages(
          historyResult.map((message) => ({
            id: message.id,
            role: message.role,
            content: message.content,
          })),
        )
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load AI configuration."),
      )
      .finally(() => setBootLoading(false))
  }, [])

  async function submitMessage(messageText: string) {
    const nextMessage = messageText.trim()

    if (!nextMessage || loading) {
      return
    }

    setLoading(true)
    setError(null)
    setMessages((current) => [
      ...current,
      { id: createId(), role: "user", content: nextMessage },
    ])
    setInputValue("")

    try {
      const response = await sendScaAiMessage(nextMessage)
      setMessages((current) => [
        ...current,
        {
          id: createId(),
          role: "assistant",
          content: response.answer,
        },
      ])
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to generate the AI response."
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void submitMessage(inputValue)
  }

  return (
    <div className="flex h-full min-h-0 flex-col rounded-[20px] border border-border/70 bg-background/95 shadow-sm">
      <div className="flex items-start justify-between gap-4 border-b border-border/70 px-5 py-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-foreground" />
            <h2 className="text-base font-semibold">{title}</h2>
          </div>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {config ? (
          <div className="rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
            {config.model}
          </div>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-wrap gap-2 border-b border-border/70 px-4 py-4">
          {bootLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading assistant setup
            </div>
          ) : null}
          {config?.suggestions.map((suggestion) => (
            <Button
              key={suggestion}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void submitMessage(suggestion)}
              disabled={loading || !config.enabled}
              className="rounded-full"
            >
              {suggestion}
            </Button>
          ))}
        </div>

        <div className="min-h-0 flex-1 px-4 py-4">
          <MessageScroller
            messages={messages}
            loading={loading}
            emptyState={
              <div className="space-y-2">
                <p className="text-base font-medium">Allocation reporting assistant</p>
                <p className="max-w-md text-sm leading-6 text-muted-foreground">
                  Ask about allocation counts, first-preference misses, rejection rates,
                  and category summaries from the latest allocation run.
                </p>
              </div>
            }
          />
        </div>

        <div className="border-t border-border/70 px-4 py-4">
          <div className="space-y-3">
            {error ? (
              <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            {!config?.enabled && !bootLoading ? (
              <div className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                Gemini is not enabled. Set `GEMINI_API_KEY` or `API_KEY` in the backend
                environment to activate the assistant.
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="flex items-center gap-3">
              <Input
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                placeholder="Ask an allocation question"
                disabled={loading || !config?.enabled}
                className="h-11 rounded-full"
              />
              <TooltipButton
                type="submit"
                size="icon-lg"
                className="rounded-full"
                disabled={loading || !inputValue.trim() || !config?.enabled}
                tooltip={loading ? "Sending" : "Send message"}
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <SendHorizonal className="size-4" />
                )}
              </TooltipButton>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
