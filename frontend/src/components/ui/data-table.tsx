import * as React from "react"

import { TablePagination } from "@/components/ui/table-pagination"

type DataTableColumn<T> = {
  id: string
  header: React.ReactNode
  cell: (row: T, rowIndex: number) => React.ReactNode
  className?: string
  headerClassName?: string
}

type DataTableProps<T> = {
  columns: DataTableColumn<T>[]
  rows: T[]
  rowKey: (row: T, rowIndex: number) => React.Key
  minWidth?: string
  maxHeight?: string
  page?: number
  pageSize?: number
  onPageChange?: (page: number) => void
}

function DataTable<T>({
  columns,
  rows,
  rowKey,
  minWidth = "520px",
  maxHeight,
  page,
  pageSize,
  onPageChange,
}: DataTableProps<T>) {
  const shouldPaginate = page !== undefined && pageSize !== undefined && onPageChange
  const pageCount = pageSize ? Math.max(1, Math.ceil(rows.length / pageSize)) : 1
  const visibleRows = shouldPaginate
    ? rows.slice(page * pageSize, page * pageSize + pageSize)
    : rows

  return (
    <div className="overflow-hidden rounded-2xl border border-border/70">
      <div className="w-full max-w-full overflow-auto" style={{ maxHeight }}>
        <table className="w-full text-sm" style={{ minWidth }}>
          <thead>
            <tr className="border-b border-border/70 bg-muted/30">
              {columns.map((column) => (
                <th
                  key={column.id}
                  className={[
                    "px-4 py-3 text-left font-semibold text-foreground",
                    column.headerClassName,
                  ].filter(Boolean).join(" ")}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, index) => {
              const absoluteIndex = shouldPaginate ? page * pageSize + index : index
              return (
                <tr key={rowKey(row, absoluteIndex)} className="border-b border-border/40 last:border-0">
                  {columns.map((column) => (
                    <td
                      key={column.id}
                      className={[
                        "px-4 py-3 text-muted-foreground",
                        column.className,
                      ].filter(Boolean).join(" ")}
                    >
                      {column.cell(row, absoluteIndex)}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {shouldPaginate ? (
        <TablePagination
          page={page}
          pageCount={pageCount}
          total={rows.length}
          pageSize={pageSize}
          onPageChange={onPageChange}
        />
      ) : null}
    </div>
  )
}

export { DataTable, type DataTableColumn }
