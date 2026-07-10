import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

type TablePaginationProps = {
  page: number
  pageCount: number
  total: number
  pageSize: number
  onPageChange: (page: number) => void
  zeroBased?: boolean
}

function TablePagination({
  page,
  pageCount,
  total,
  pageSize,
  onPageChange,
  zeroBased = true,
}: TablePaginationProps) {
  if (pageCount <= 1 || total <= pageSize) return null

  const pageIndex = zeroBased ? page : page - 1
  const currentPage = pageIndex + 1
  const start = pageIndex * pageSize + 1
  const end = Math.min((pageIndex + 1) * pageSize, total)

  function toExternalPage(nextPageIndex: number) {
    return zeroBased ? nextPageIndex : nextPageIndex + 1
  }

  return (
    <div className="flex items-center justify-between border-t border-border/60 bg-muted/20 px-4 py-2">
      <p className="text-xs text-muted-foreground">
        Showing {start}-{end} of {total}
      </p>
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={pageIndex <= 0}
              onClick={() => onPageChange(toExternalPage(Math.max(pageIndex - 1, 0)))}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent sideOffset={6}>Previous page</TooltipContent>
        </Tooltip>
        <span className="min-w-14 text-center text-xs text-muted-foreground">
          {currentPage} / {pageCount}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={pageIndex >= pageCount - 1}
              onClick={() => onPageChange(toExternalPage(Math.min(pageIndex + 1, pageCount - 1)))}
              aria-label="Next page"
            >
              <ChevronRight className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent sideOffset={6}>Next page</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}

export { TablePagination }
