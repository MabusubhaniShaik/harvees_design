import * as React from "react"

import { cn } from "@/lib/utils"

type FloatingDockItem = {
  key: string
  label: string
  icon: React.ReactNode
  onClick: () => void
}

type FloatingDockProps = {
  items: FloatingDockItem[]
  className?: string
}

export function FloatingDock({ items, className }: FloatingDockProps) {
  return (
    <div
      className={cn(
        "pointer-events-auto flex items-center gap-2 rounded-full border border-border/70 bg-background/92 p-2 shadow-lg shadow-black/5 backdrop-blur-md",
        className,
      )}
    >
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={item.onClick}
          className="group flex h-11 min-w-11 items-center justify-center rounded-full border border-transparent bg-muted/60 px-3 text-muted-foreground transition hover:-translate-y-0.5 hover:border-border hover:bg-background hover:text-foreground"
          title={item.label}
          aria-label={item.label}
        >
          <span className="flex items-center gap-2">
            {item.icon}
            <span className="hidden text-xs font-medium md:inline">
              {item.label}
            </span>
          </span>
        </button>
      ))}
    </div>
  )
}
