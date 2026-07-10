import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/__maniLayout/")({
  beforeLoad: () => {
    throw redirect({ to: "/module" })
  },
})
