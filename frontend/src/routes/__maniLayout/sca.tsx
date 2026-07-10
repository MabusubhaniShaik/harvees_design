import { Outlet, createFileRoute, redirect } from "@tanstack/react-router"

import { ScaFloatingAssistant } from "@/components/ai/sca-floating-assistant"
import { AppShellLayout } from "@/layout/AppShellLayout"

export const Route = createFileRoute("/__maniLayout/sca")({
  beforeLoad: () => {
    if (!sessionStorage.getItem("selectedModule")) {
      sessionStorage.setItem("moduleAlert", "true")
      throw redirect({ to: "/module" })
    }
  },
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <AppShellLayout floatingSlot={<ScaFloatingAssistant />}>
      {<Outlet />}
    </AppShellLayout>
  )
}
