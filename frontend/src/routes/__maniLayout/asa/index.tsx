import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/__maniLayout/asa/")({
  beforeLoad: () => {
    throw redirect({ to: "/asa/home" })
  },
})
