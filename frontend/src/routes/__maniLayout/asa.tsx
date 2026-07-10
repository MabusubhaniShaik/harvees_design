import { Outlet, createFileRoute, redirect } from "@tanstack/react-router"

import { AppShellLayout } from "@/layout/AppShellLayout"

export const Route = createFileRoute("/__maniLayout/asa")({
  beforeLoad: () => {
    if (!sessionStorage.getItem("selectedModule")) {
      sessionStorage.setItem("moduleAlert", "true")
      throw redirect({ to: "/module" })
    }
  },
  component: RouteComponent,
})

function RouteComponent() {
  return <AppShellLayout>{<Outlet />}</AppShellLayout>
}
