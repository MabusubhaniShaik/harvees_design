import * as React from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { BarChart3, Download, Loader2, Sparkles, UploadCloud } from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { ChartCard, MetricCard } from "@/components/dashboard/dashboard-card"
import { Button } from "@/components/ui/button"
import { DataTable, type DataTableColumn } from "@/components/ui/data-table"
import { DEFAULT_PAGE_LIMIT } from "@/config/app-settings"
import {
  exportPdf,
  fetchAsaDashboardSummary,
  type AsaAiHistoryEntry,
  type AsaDashboardSeriesPoint,
} from "@/lib/asa-api"
import { downloadBlob, timestampedFilename } from "@/lib/export-utils"

export const Route = createFileRoute("/__maniLayout/asa/home")({
  component: RouteComponent,
})

const COLORS = ["#111827", "#2563eb", "#059669", "#d97706", "#dc2626", "#7c3aed"]

function QueryHistoryTable({ rows }: { rows: AsaAiHistoryEntry[] }) {
  const [page, setPage] = React.useState(0)

  const columns: DataTableColumn<AsaAiHistoryEntry>[] = [
    {
      id: "question",
      header: "Question",
      className: "max-w-[320px] align-top",
      cell: (row) => <p className="line-clamp-2 text-foreground">{row.question}</p>,
    },
    {
      id: "sql",
      header: "SQL",
      className: "max-w-[340px] font-mono text-xs align-top",
      cell: (row) => <p className="line-clamp-2">{row.sql}</p>,
    },
    {
      id: "rowCount",
      header: "Rows",
      cell: (row) => row.rowCount,
    },
    {
      id: "askedAt",
      header: "Asked",
      className: "whitespace-nowrap",
      cell: (row) =>
        new Intl.DateTimeFormat("en-IN", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(row.askedAt)),
    },
  ]

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      page={page}
      pageSize={DEFAULT_PAGE_LIMIT}
      onPageChange={setPage}
      minWidth="920px"
    />
  )
}

function SeriesBarChart({
  data,
  color,
  xKey = "label",
}: {
  data: AsaDashboardSeriesPoint[]
  color: string
  xKey?: string
}) {
  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function SeriesPieChart({ data }: { data: AsaDashboardSeriesPoint[] }) {
  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="label" outerRadius={105} label>
            {data.map((_, index) => (
              <Cell key={`${index}-${data[index]?.label ?? "slice"}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

function RouteComponent() {
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [summary, setSummary] = React.useState<Awaited<ReturnType<typeof fetchAsaDashboardSummary>> | null>(null)

  React.useEffect(() => {
    fetchAsaDashboardSummary()
      .then(setSummary)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load dashboard"))
      .finally(() => setLoading(false))
  }, [])

  async function handleExportPdf() {
    const blob = await exportPdf()
    downloadBlob(blob, timestampedFilename("asa-dashboard", "pdf"))
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !summary) {
    return (
      <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        {error ?? "Dashboard data is unavailable."}
      </div>
    )
  }

  return (
    <div className="w-full min-w-0 max-w-full space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">ASA Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sales dataset health, AI query activity, insights, and visual analytics for `ecommerce_sales_data.xlsx`.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/asa/dataset-upload">
              <UploadCloud className="size-4" />
              Upload Dataset
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => void handleExportPdf()}>
            <Download className="size-4" />
            Export PDF
          </Button>
        </div>
      </div>

      <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summary.metrics.map((metric) => (
          <MetricCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            helper={metric.helper}
          />
        ))}
      </div>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
        <ChartCard title="Assistant Insights">
          {summary.insights.length === 0 ? (
            <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/20 p-6 text-center">
              <div className="space-y-2">
                <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-muted">
                  <Sparkles className="size-4 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">Insights will appear after upload</p>
                  <p className="text-sm text-muted-foreground">
                    Upload `ecommerce_sales_data.xlsx` to generate sales summaries and analytics suggestions.
                  </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {summary.insights.map((insight, index) => (
                <div
                  key={`${index}-${insight}`}
                  className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3"
                >
                  <p className="text-sm text-foreground">{insight}</p>
                </div>
              ))}
            </div>
          )}
        </ChartCard>

        <ChartCard title="Primary Dataset">
          {summary.primaryDataset ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
                <p className="font-mono text-sm font-medium text-foreground">
                  {summary.primaryDataset.tableName}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {summary.primaryDataset.rowCount} rows • {summary.primaryDataset.columnCount} columns
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-border/70 px-4 py-3">
                  <p className="text-xs text-muted-foreground">Use case</p>
                  <p className="mt-1 text-sm font-medium capitalize text-foreground">
                    {summary.useCase}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/70 px-4 py-3">
                  <p className="text-xs text-muted-foreground">AI Queries</p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {summary.queryHistory.length}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/20 p-6 text-center">
              <div className="space-y-2">
                <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-muted">
                  <BarChart3 className="size-4 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">No dataset yet</p>
                  <p className="text-sm text-muted-foreground">
                  Start by uploading `ecommerce_sales_data.xlsx`.
                  </p>
              </div>
            </div>
          )}
        </ChartCard>
      </div>

      <div className="grid min-w-0 gap-6 xl:grid-cols-2">
        <ChartCard title="Rows by Dataset">
          {summary.charts.rowsByTable.length > 0 ? (
            <SeriesBarChart data={summary.charts.rowsByTable} color="#2563eb" />
          ) : (
            <p className="text-sm text-muted-foreground">Upload data to visualize dataset size.</p>
          )}
        </ChartCard>

        <ChartCard title="Schema Type Distribution">
          {summary.charts.schemaTypes.length > 0 ? (
            <SeriesPieChart data={summary.charts.schemaTypes} />
          ) : (
            <p className="text-sm text-muted-foreground">Detected column types will appear here.</p>
          )}
        </ChartCard>
      </div>

      <div className="grid min-w-0 gap-6 xl:grid-cols-2">
        <ChartCard title="Monthly Revenue">
          <SeriesBarChart data={summary.charts.monthlyRevenue} color="#059669" />
        </ChartCard>
        <ChartCard title="Revenue by Category">
          <SeriesBarChart data={summary.charts.revenueByCategory} color="#d97706" />
        </ChartCard>
        <ChartCard title="Payment Method Mix">
          <SeriesPieChart data={summary.charts.paymentMethodMix} />
        </ChartCard>
        <ChartCard title="Order Status Mix">
          <SeriesPieChart data={summary.charts.orderStatusMix} />
        </ChartCard>
      </div>

      <ChartCard title="Query History">
        {summary.queryHistory.length > 0 ? (
          <QueryHistoryTable rows={summary.queryHistory} />
        ) : (
          <div className="flex min-h-[180px] items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/20 p-6 text-center">
            <div className="space-y-2">
              <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-muted">
                <Sparkles className="size-4 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">No query history yet</p>
              <p className="text-sm text-muted-foreground">
                Run a few AI SQL queries and they will appear here automatically.
              </p>
            </div>
          </div>
        )}
      </ChartCard>
    </div>
  )
}
