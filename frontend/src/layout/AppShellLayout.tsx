import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { HeaderLayout } from "@/layout/HeaderLayout"
import { Menulayout } from "@/layout/Menulayout"

type AppShellLayoutProps = {
  children: React.ReactNode
  floatingSlot?: React.ReactNode
}

export function AppShellLayout({
  children,
  floatingSlot,
}: AppShellLayoutProps) {
  return (
    <SidebarProvider className="h-svh min-h-0 overflow-hidden">
      <Menulayout />
      <SidebarInset className="h-svh min-w-0 overflow-hidden md:peer-data-[variant=inset]:m-0 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-none md:peer-data-[variant=inset]:shadow-none md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-0">
        <HeaderLayout />
        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-muted/30">
          <div className="w-full min-w-0 max-w-full overflow-x-hidden px-4 py-6 md:px-6 md:py-8">
            {children}
          </div>
        </main>
        {floatingSlot}
      </SidebarInset>
    </SidebarProvider>
  )
}
