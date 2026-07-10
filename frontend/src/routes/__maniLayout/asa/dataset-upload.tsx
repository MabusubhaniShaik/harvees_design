import * as React from "react"
import { createFileRoute } from "@tanstack/react-router"
import {
  Database,
  Download,
  FileUp,
  Loader2,
  ScanSearch,
  Table2,
  UploadCloud,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DataTable, type DataTableColumn } from "@/components/ui/data-table"
import { DEFAULT_PAGE_LIMIT } from "@/config/app-settings"
import { detectDataset, exportExcel, exportPdf, uploadCsv, type ColumnInfo, type TableInfo } from "@/lib/asa-api"
import { downloadBlob, timestampedFilename } from "@/lib/export-utils"

export const Route = createFileRoute("/__maniLayout/asa/dataset-upload")({
  component: RouteComponent,
})

const SCHEMA_PAGE_SIZE = DEFAULT_PAGE_LIMIT
const PREVIEW_PAGE_SIZE = DEFAULT_PAGE_LIMIT

function RouteComponent() {
  const [result, setResult] = React.useState<TableInfo | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [creating, setCreating] = React.useState(false)
  const [exporting, setExporting] = React.useState<"excel" | "pdf" | null>(null)
  const [created, setCreated] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const selectedFileRef = React.useRef<File | null>(null)
  const [previewRows, setPreviewRows] = React.useState<Record<string, string>[]>([])
  const [schemaPage, setSchemaPage] = React.useState(0)
  const [previewPage, setPreviewPage] = React.useState(0)

  const typeBadge: Record<string, string> = {
    text: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    number: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    boolean: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    date: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  }

  async function handleFile(file: File | null) {
    if (!file) return
    setLoading(true)
    setError(null)
    setResult(null)
    setCreated(false)
    setPreviewRows([])
    setSchemaPage(0)
    setPreviewPage(0)
    selectedFileRef.current = file

    try {
      const table = await detectDataset(file)
      setResult(table)
      setPreviewRows(table.rows ?? [])
      setSchemaPage(0)
      setPreviewPage(0)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.")
    } finally {
      setLoading(false)
    }
  }

  function handleReset() {
    setResult(null)
    setPreviewRows([])
    setCreated(false)
    setError(null)
    selectedFileRef.current = null
    setSchemaPage(0)
    setPreviewPage(0)
    if (inputRef.current) inputRef.current.value = ""
  }

  async function handleCreateTable() {
    const file = selectedFileRef.current
    if (!file) return

    setCreating(true)
    setError(null)

    try {
      const table = await uploadCsv(file)
      setResult(table)
      setPreviewRows(table.rows ?? [])
      setCreated(true)
      setSchemaPage(0)
      setPreviewPage(0)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Table creation failed.")
    } finally {
      setCreating(false)
    }
  }

  async function handleExportExcel() {
    if (!result) return
    setExporting("excel")
    try {
      const blob = await exportExcel(`SELECT * FROM "${result.tableName}";`)
      downloadBlob(blob, timestampedFilename(result.tableName, "xlsx"))
    } finally {
      setExporting(null)
    }
  }

  async function handleExportPdf() {
    setExporting("pdf")
    try {
      const blob = await exportPdf()
      downloadBlob(blob, timestampedFilename("asa-dashboard", "pdf"))
    } finally {
      setExporting(null)
    }
  }

  const schemaRows = result?.columns ?? []
  const schemaColumns: DataTableColumn<ColumnInfo>[] = [
    {
      id: "index",
      header: "#",
      cell: (_col, rowIndex) => rowIndex + 1,
    },
    {
      id: "name",
      header: "Column Name",
      cell: (col) => col.name,
      className: "font-medium text-foreground",
    },
    {
      id: "type",
      header: "Inferred Type",
      cell: (col) => (
        <span className={["inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium", typeBadge[col.category ?? "text"] ?? typeBadge.text].join(" ")}>
          {col.type}
        </span>
      ),
    },
  ]
  const previewColumns: DataTableColumn<Record<string, string>>[] = schemaRows.map((col) => ({
    id: col.name,
    header: col.name,
    headerClassName: "whitespace-nowrap",
    className: "max-w-[200px] truncate",
    cell: (row) => row[col.name] || "—",
  }))

  return (
    <div className="w-full min-w-0 max-w-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dataset Upload</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload only `ecommerce_sales_data.xlsx` to detect the sales schema and create the analytics table.
          </p>
        </div>
      </div>

      {result ? (
        <div className="grid min-w-0 gap-4 md:grid-cols-3">
          <Card className="min-w-0 border-border/70 shadow-sm">
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">File</p>
              <p className="mt-2 truncate text-sm font-semibold text-foreground">{result.fileName}</p>
              <p className="mt-1 text-xs text-muted-foreground">Source dataset</p>
            </CardContent>
          </Card>
          <Card className="min-w-0 border-border/70 shadow-sm">
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">Rows</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{result.rowCount}</p>
              <p className="mt-1 text-xs text-muted-foreground">Data rows detected</p>
            </CardContent>
          </Card>
          <Card className="min-w-0 border-border/70 shadow-sm">
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">Columns</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{result.columnCount}</p>
              <p className="mt-1 text-xs text-muted-foreground">Fields in schema</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="h-fit min-w-0 border-border/70 shadow-sm">
          <CardHeader className="space-y-2">
            <CardTitle>Upload & Detect</CardTitle>
            <CardDescription>
              Select the provided `ecommerce_sales_data.xlsx` file. Column names and data types will be inferred automatically,
              then persisted for sales analytics.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <label className="block cursor-pointer rounded-3xl border border-dashed border-border bg-muted/20 p-8 text-center transition-colors hover:bg-muted/30">
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="sr-only"
                disabled={loading || creating}
                onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
              />
              <div className="mx-auto flex max-w-md flex-col items-center gap-4">
                <span className="flex size-14 items-center justify-center rounded-2xl bg-background shadow-sm">
                  <UploadCloud className="size-7" />
                </span>
                <div className="space-y-1">
                  <p className="text-base font-medium text-foreground">Upload ecommerce sales data</p>
                  <p className="text-sm text-muted-foreground">
                    Click to select `ecommerce_sales_data.xlsx`. Other datasets are intentionally blocked.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={loading || creating}
                  onClick={(event) => {
                    event.preventDefault()
                    inputRef.current?.click()
                  }}
                >
                  {loading ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
                  {loading ? "Detecting..." : "Choose File"}
                </Button>
              </div>
            </label>

            {error ? (
              <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            {created ? (
              <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary flex items-center gap-2">
                <Database className="size-4 shrink-0" />
                Sales dataset table created successfully.
              </div>
            ) : null}

            {result && !created ? (
              <Button className="w-full" onClick={handleCreateTable} disabled={creating}>
                {creating ? <Loader2 className="size-4 animate-spin" /> : <Database className="size-4" />}
                {creating ? "Creating Table..." : "Create Database Table"}
              </Button>
            ) : null}

            {result && created ? (
              <div className="grid gap-2 sm:grid-cols-3">
                <Button variant="outline" onClick={handleExportExcel} disabled={exporting === "excel"}>
                  {exporting === "excel" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                  Excel
                </Button>
                <Button variant="outline" onClick={handleExportPdf} disabled={exporting === "pdf"}>
                  {exporting === "pdf" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                  PDF
                </Button>
                <Button variant="outline" onClick={handleReset}>
                  Upload Another
                </Button>
              </div>
            ) : null}

            <div className="space-y-3 rounded-2xl border border-border/70 bg-background p-4">
              <p className="text-sm font-medium text-foreground">Workflow</p>
              <ul className="space-y-3 text-sm leading-6 text-muted-foreground">
                <li className="flex gap-3">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                  <span>Upload a CSV or Excel file to detect column names and infer data types.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                  <span>Review the detected schema and data preview.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                  <span>Persist the dataset and preview the first rows after upload completes.</span>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0 border-border/70 shadow-sm">
          <CardHeader className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                <Table2 className="size-5 text-primary" />
              </span>
              <div>
                <CardTitle>Detected Schema</CardTitle>
                <CardDescription>Column names with inferred data types</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
          {!result && !loading && !error ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/20 py-12 text-center">
                <ScanSearch className="size-12 text-muted-foreground/40" />
                <p className="mt-4 text-sm font-medium text-foreground">No schema detected yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Upload a CSV or Excel file to begin schema detection.
                </p>
            </div>
          ) : null}

          {loading ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-border/70 bg-muted/20 py-12 text-center">
                <Loader2 className="size-12 animate-spin text-muted-foreground/40" />
                <p className="mt-4 text-sm font-medium text-foreground">Uploading and parsing...</p>
                <p className="mt-1 text-sm text-muted-foreground">Processing file on server.</p>
            </div>
          ) : null}

          {result ? (
            <DataTable
              columns={schemaColumns}
              rows={schemaRows}
              rowKey={(col) => col.name}
              minWidth="520px"
              page={schemaPage}
              pageSize={SCHEMA_PAGE_SIZE}
              onPageChange={setSchemaPage}
            />
          ) : null}
          </CardContent>
        </Card>
      </div>

      {result && previewRows.length > 0 ? (
        <Card className="min-w-0 border-border/70 shadow-sm">
          <CardHeader className="space-y-2">
            <CardTitle>Data Preview</CardTitle>
            <CardDescription>First {previewRows.length} rows of parsed data</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={previewColumns}
              rows={previewRows}
              rowKey={(_row, rowIndex) => rowIndex}
              minWidth="max-content"
              maxHeight="420px"
              page={previewPage}
              pageSize={PREVIEW_PAGE_SIZE}
              onPageChange={setPreviewPage}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
