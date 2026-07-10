import { Link, useRouterState } from "@tanstack/react-router"
import { LayoutGrid } from "lucide-react"

import { getPathTitle } from "@/config/sidebar-navigation"
import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"

export function HeaderLayout() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  return (
    <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur-xl">
      <div className="flex h-16 w-full items-center gap-3 px-4 md:px-6">
        <SidebarTrigger className="shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-foreground">
            {getPathTitle(pathname)}
          </p>
          <p className="truncate text-xs text-muted-foreground">{pathname}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2 bg-background" asChild>
            <Link to="/module">
              <LayoutGrid className="size-4" />
              <span>Modules</span>
            </Link>
          </Button>
        </div>
      </div>
    </header>
  )
}
