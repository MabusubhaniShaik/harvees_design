import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/__maniLayout/asa/schema-detection")({
  loader: () => {
    throw redirect({ to: "/asa/dataset-upload" })
  },
})
