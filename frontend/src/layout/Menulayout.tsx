import { Link, useRouterState } from "@tanstack/react-router"
import { BookOpenText } from "lucide-react"
import * as React from "react"

import { getNavigationModel } from "@/config/sidebar-navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"

export function Menulayout() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const [profileOpen, setProfileOpen] = React.useState(false)
  const navigationModel = React.useMemo(
    () => getNavigationModel(pathname),
    [pathname]
  )

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="h-16 justify-center border-b border-sidebar-border bg-sidebar px-3 py-0">
        <Link
          to={navigationModel.brandTo}
          className="group flex h-11 items-center gap-3 rounded-xl px-2.5 py-1.5 text-sidebar-foreground transition-colors hover:bg-sidebar-accent group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-black text-white group-data-[collapsible=icon]:size-6">
            <span className="text-sm font-bold group-data-[collapsible=icon]:text-[10px]">
              {navigationModel.brandTitle.charAt(0)}
            </span>
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-semibold text-sidebar-foreground group-hover:text-sidebar-foreground">
              {navigationModel.brandTitle}
            </p>
            <p className="truncate text-xs text-muted-foreground group-hover:text-muted-foreground">
              {navigationModel.brandSubtitle}
            </p>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="min-h-0 overflow-y-auto bg-sidebar px-2 py-3">
        {navigationModel.sections.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel className="px-2 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground/90 uppercase">
              {section.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const isActive =
                    pathname === item.to || pathname.startsWith(`${item.to}/`)

                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton asChild isActive={isActive}>
                        <Link to={item.to}>
                          <item.icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border bg-sidebar p-3">
        <Popover open={profileOpen} onOpenChange={setProfileOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              onMouseEnter={() => setProfileOpen(true)}
              onMouseLeave={() => setProfileOpen(false)}
              onFocus={() => setProfileOpen(true)}
              onBlur={() => setProfileOpen(false)}
              className="group flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-sidebar-foreground transition-colors hover:bg-sidebar-accent focus-visible:bg-sidebar-accent focus-visible:outline-none group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
            >
              <Avatar className="group-data-[collapsible=icon]:size-6">
                <AvatarImage
                  src={`https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(
                    navigationModel.footer.avatarSeed,
                  )}`}
                  alt={navigationModel.footer.title}
                />
                <AvatarFallback className="bg-black text-white">
                  {navigationModel.footer.title.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 group-data-[collapsible=icon]:hidden">
                <p className="truncate text-sm font-medium text-sidebar-foreground group-hover:text-sidebar-foreground">
                  {navigationModel.footer.title}
                </p>
                <p className="truncate text-xs text-muted-foreground group-hover:text-muted-foreground">
                  {navigationModel.footer.subtitle}
                </p>
              </div>
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="right"
            align="end"
            sideOffset={12}
            onMouseEnter={() => setProfileOpen(true)}
            onMouseLeave={() => setProfileOpen(false)}
            className="w-72 rounded-2xl border border-border/70 p-0 shadow-xl"
          >
            <div className="rounded-t-2xl border-b border-border/60 bg-muted/40 p-4">
              <div className="flex items-center gap-3">
                <Avatar size="lg">
                  <AvatarImage
                    src={`https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(
                      navigationModel.footer.avatarSeed,
                    )}`}
                    alt={navigationModel.footer.title}
                  />
                  <AvatarFallback>
                    {navigationModel.footer.title.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <PopoverHeader className="gap-1 p-0">
                  <PopoverTitle className="text-sm">
                    {navigationModel.footer.title}
                  </PopoverTitle>
                  <PopoverDescription>
                    {navigationModel.footer.subtitle}
                  </PopoverDescription>
                </PopoverHeader>
              </div>
            </div>
            <div className="px-4 py-3 text-sm leading-6 text-muted-foreground">
              {navigationModel.footer.description}
            </div>
            <div className="p-3 pt-0">
              <div className="rounded-xl border border-border/60 bg-muted/40 px-3 py-3">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-8 items-center justify-center rounded-lg bg-background shadow-sm">
                    <BookOpenText className="size-4" />
                  </span>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      Active Sections
                    </p>
                    <p className="text-xs leading-5 text-muted-foreground">
                      {navigationModel.sections
                        .flatMap((section) => section.items)
                        .map((item) => item.title)
                        .join(" • ")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
