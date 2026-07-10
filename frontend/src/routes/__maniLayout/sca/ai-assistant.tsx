import { createFileRoute } from "@tanstack/react-router"

import { ScaAssistantPanel } from "@/components/ai/sca-assistant-panel"

export const Route = createFileRoute("/__maniLayout/sca/ai-assistant")({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">AI Assistant</h1>
        <p className="text-sm text-muted-foreground">
          Natural-language reporting for the latest student allocation run.
        </p>
      </div>

      <div className="min-h-0 flex-1">
        <ScaAssistantPanel
          title="SCA Reporting Assistant"
          description="Ask allocation questions without leaving the student allocation module."
        />
      </div>
    </div>
  )
}
