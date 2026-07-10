import { TablePagination } from "@/components/ui/table-pagination"
import type { PaginationInfo } from "@/lib/api-client"

function Pagination({
  pagination,
  onPageChange,
}: {
  pagination: PaginationInfo
  onPageChange: (page: number) => void
}) {
  const { count, current_page, total_page_count, total_record_count } = pagination

  if (total_page_count <= 1) return null

  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-background">
      <TablePagination
        page={current_page}
        pageCount={total_page_count}
        total={total_record_count}
        pageSize={count}
        onPageChange={onPageChange}
        zeroBased={false}
      />
    </div>
  )
}

export { Pagination }
