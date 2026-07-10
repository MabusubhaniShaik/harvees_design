import * as React from "react"
import { createFileRoute } from "@tanstack/react-router"
import { Database, Loader2, Table2, Trash2, Download, Eye } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DataTable, type DataTableColumn } from "@/components/ui/data-table"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { DEFAULT_PAGE_LIMIT } from "@/config/app-settings"
import {
  listTables,
  getTableDetails,
  deleteTable,
  exportExcel,
  exportPdf,
  type ColumnInfo,
  type TableInfo,
} from "@/lib/asa-api"
import { downloadBlob, timestampedFilename } from "@/lib/export-utils"
import { TooltipButton } from "@/components/ui/tooltip-button"

export const Route = createFileRoute("/__maniLayout/asa/dynamic-table-creation")({
  component: RouteComponent,
  loader: async () => {
    const tables = await listTables()
    return { tables }
  },
  pendingComponent: () => (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="size-8 animate-spin text-muted-foreground/60" />
    </div>
  ),
  errorComponent: ({ error }) => (
    <Card className="border-destructive/30 mx-auto mt-10 max-w-md">
      <CardContent className="p-6 text-center">
        <p className="text-sm text-destructive">Failed to load tables: {(error as Error).message}</p>
      </CardContent>
    </Card>
  ),
})

const typeBadge: Record<string, string> = {
  text: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  number: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  boolean: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  date: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
}

const SCHEMA_PAGE_SIZE = DEFAULT_PAGE_LIMIT
const PREVIEW_PAGE_SIZE = DEFAULT_PAGE_LIMIT
const PREVIEW_COLUMN_LIMIT = 4

function formatPreviewValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "—"
  }

  return String(value)
}

function truncatePreviewValue(value: unknown, maxLength = 40) {
  const normalizedValue = formatPreviewValue(value)
  if (normalizedValue.length <= maxLength) {
    return normalizedValue
  }

  return `${normalizedValue.slice(0, maxLength)}...`
}

function RouteComponent() {
  const [tables, setTables] = React.useState<TableInfo[]>([])
  const [loading, setLoading] = React.useState(true)
  const [expandedId, setExpandedId] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = React.useState<string | null>(null)
  const [schemaPages, setSchemaPages] = React.useState<Record<string, number>>({})
  const [previewPages, setPreviewPages] = React.useState<Record<string, number>>({})
  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const [selectedTableName, setSelectedTableName] = React.useState<string | null>(null)
  const [selectedRow, setSelectedRow] = React.useState<Record<string, string> | null>(null)

  React.useEffect(() => {
    listTables()
      .then(setTables)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  async function handleDelete(name: string) {
    try {
      await deleteTable(name)
      setTables((prev) => prev.filter((t) => t.tableName !== name))
      setSchemaPages((prev) => {
        const next = { ...prev }
        delete next[name]
        return next
      })
      setPreviewPages((prev) => {
        const next = { ...prev }
        delete next[name]
        return next
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed.")
    }
  }

  async function handleToggle(name: string) {
    if (expandedId === name) {
      setExpandedId(null)
      return
    }

    setExpandedId(name)
    setPreviewPages((prev) => ({ ...prev, [name]: prev[name] ?? 0 }))
    const current = tables.find((t) => t.tableName === name)
    if (current?.rows) return

    setPreviewLoading(name)
    setError(null)
    try {
      const details = await getTableDetails(name)
      setTables((prev) => prev.map((table) => table.tableName === name ? { ...table, ...details } : table))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load table preview.")
    } finally {
      setPreviewLoading(null)
    }
  }

  async function handleExportExcel() {
    try {
      const blob = await exportExcel("SELECT * FROM sqlite_master WHERE type='table' ORDER BY name;")
      downloadBlob(blob, timestampedFilename("asa-tables", "xlsx"))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.")
    }
  }

  async function handleExportPdf() {
    try {
      const blob = await exportPdf()
      downloadBlob(blob, timestampedFilename("asa-dashboard", "pdf"))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.")
    }
  }

  function setSchemaPage(tableName: string, page: number) {
    setSchemaPages((prev) => ({ ...prev, [tableName]: page }))
  }

  function setPreviewPage(tableName: string, page: number) {
    setPreviewPages((prev) => ({ ...prev, [tableName]: page }))
  }

  function openRowDrawer(tableName: string, row: Record<string, string>) {
    setSelectedTableName(tableName)
    setSelectedRow(row)
    setDrawerOpen(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 animate-spin text-muted-foreground/60" />
      </div>
    )
  }

  return (
    <div className="w-full min-w-0 max-w-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dynamic Tables</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            View all database tables created from uploaded datasets.
          </p>
        </div>
        {tables.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportExcel}>
              <Download className="size-4" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPdf}>
              <Download className="size-4" /> PDF
            </Button>
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>
      ) : null}

      {tables.length === 0 ? (
        <Card className="border-border/70 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Database className="size-12 text-muted-foreground/40" />
            <p className="mt-4 text-sm font-medium text-foreground">No tables created yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload a dataset and create a table from the Dataset Upload page.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="min-w-0 space-y-6">
          <div className="grid min-w-0 gap-4 md:grid-cols-3">
            <Card className="min-w-0 border-border/70 shadow-sm">
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">Total Tables</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{tables.length}</p>
                <p className="mt-1 text-xs text-muted-foreground">Created from datasets</p>
              </CardContent>
            </Card>
            <Card className="min-w-0 border-border/70 shadow-sm">
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">Total Rows</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">
                  {tables.reduce((s, t) => s + t.rowCount, 0)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Across all tables</p>
              </CardContent>
            </Card>
            <Card className="min-w-0 border-border/70 shadow-sm">
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">Total Columns</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">
                  {tables.reduce((s, t) => s + t.columnCount, 0)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Across all tables</p>
              </CardContent>
            </Card>
          </div>

          {tables.map((table) => {
            const schemaPage = schemaPages[table.tableName] ?? 0
            const previewRows = table.rows ?? []
            const previewPage = previewPages[table.tableName] ?? 0
            const schemaColumns: DataTableColumn<ColumnInfo>[] = [
              {
                id: "index",
                header: "#",
                cell: (_col, rowIndex) => rowIndex + 1,
              },
              {
                id: "name",
                header: "Column",
                cell: (col) => col.name,
                className: "font-medium text-foreground",
              },
              {
                id: "type",
                header: "Type",
                cell: (col) => (
                  <span className={["inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium", typeBadge[col.category ?? "text"] ?? typeBadge.text].join(" ")}>
                    {col.type}
                  </span>
                ),
              },
            ]
            const previewColumns: DataTableColumn<Record<string, string>>[] = [
              ...table.columns.slice(0, PREVIEW_COLUMN_LIMIT).map((col) => ({
                id: col.name,
                header: col.name,
                headerClassName: "whitespace-nowrap",
                className: "max-w-[180px] truncate",
                cell: (row: Record<string, string>) => truncatePreviewValue(row[col.name]),
              })),
              {
                id: "actions",
                header: "View",
                headerClassName: "whitespace-nowrap text-right",
                className: "w-16 text-right",
                cell: (row: Record<string, string>) => (
                  <div className="flex justify-end">
                    <TooltipButton
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => openRowDrawer(table.tableName, row)}
                      tooltip="View record"
                      aria-label={`View ${table.tableName} record`}
                    >
                      <Eye className="size-4" />
                    </TooltipButton>
                  </div>
                ),
              },
            ]

            return (
            <Card key={table.tableName} className="min-w-0 border-border/70 shadow-sm">
              <CardHeader className="space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                      <Table2 className="size-5 text-primary" />
                    </span>
                    <div>
                      <CardTitle className="font-mono text-base">{table.tableName}</CardTitle>
                      <CardDescription>
                        {table.rowCount} rows &middot; {table.columnCount} columns
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggle(table.tableName)}
                    >
                      {previewLoading === table.tableName ? <Loader2 className="size-4 animate-spin" /> : expandedId === table.tableName ? "Hide" : "View"}
                    </Button>
                    <TooltipButton
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleDelete(table.tableName)}
                      aria-label={`Delete ${table.tableName}`}
                      tooltip="Delete table"
                    >
                      <Trash2 className="size-4" />
                    </TooltipButton>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <DataTable
                  columns={schemaColumns}
                  rows={table.columns}
                  rowKey={(col) => col.name}
                  minWidth="520px"
                  page={schemaPage}
                  pageSize={SCHEMA_PAGE_SIZE}
                  onPageChange={(page) => setSchemaPage(table.tableName, page)}
                />

                {expandedId === table.tableName && table.rows ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">Record Preview</p>
                        <p className="text-xs text-muted-foreground">
                          Showing compact data preview. Use the view icon for full record details.
                        </p>
                      </div>
                    </div>
                    <DataTable
                      columns={previewColumns}
                      rows={previewRows}
                      rowKey={(_row, rowIndex) => rowIndex}
                      minWidth="880px"
                      maxHeight="420px"
                      page={previewPage}
                      pageSize={PREVIEW_PAGE_SIZE}
                      onPageChange={(page) => setPreviewPage(table.tableName, page)}
                    />
                  </div>
                ) : null}
              </CardContent>
            </Card>
            )
          })}
        </div>
      )}

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Record Details</DrawerTitle>
            <DrawerDescription>
              {selectedTableName
                ? `Complete row details for ${selectedTableName}.`
                : "Complete row details."}
            </DrawerDescription>
          </DrawerHeader>
          {selectedRow ? (
            <div className="grid gap-4 p-4 pt-0 md:grid-cols-2">
              {Object.entries(selectedRow).map(([key, value]) => (
                <div
                  key={key}
                  className="rounded-xl border border-border/70 bg-background px-4 py-3"
                >
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {key}
                  </p>
                  <p className="mt-1 break-words font-medium text-foreground">
                    {formatPreviewValue(value)}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </DrawerContent>
      </Drawer>
    </div>
  )
}
