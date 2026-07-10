import { Outlet, createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/__maniLayout")({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="h-svh overflow-hidden bg-slate-50">
      <div className="mx-auto flex h-full min-h-0 w-full flex-col overflow-hidden">
        <Outlet />
      </div>
    </div>
  )
}
