import { PanelsTopLeft } from "lucide-react"
import { useNavigate } from "@tanstack/react-router"

import { FloatingDock } from "@/components/ai/floating-dock"

export function ScaFloatingAssistant() {
  const navigate = useNavigate()

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-40 md:right-6 md:bottom-6">
      <FloatingDock
        items={[
          {
            key: "page",
            label: "AI Assistant",
            icon: <PanelsTopLeft className="size-4" />,
            onClick: () => void navigate({ to: "/sca/ai-assistant" }),
          },
        ]}
      />
    </div>
  )
}
