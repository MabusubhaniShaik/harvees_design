import * as React from "react"
import { createFileRoute } from "@tanstack/react-router"
import {
  AlertCircle,
  BarChart3,
  Copy,
  Download,
  History,
  Lightbulb,
  Loader2,
  MessageSquare,
  Send,
  Sparkles,
  Terminal,
} from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RPieChart,
  Pie,
  Cell,
  Legend,
} from "recharts"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DataTable } from "@/components/ui/data-table"
import { Input } from "@/components/ui/input"
import { TooltipButton } from "@/components/ui/tooltip-button"
import {
  chatWithAsaAssistant,
  exportExcel,
  exportPdf,
  fetchAsaAiChatHistory,
  fetchAsaAiConfig,
  fetchAsaAiHistory,
  listTables,
  type AsaAiChatHistoryMessage,
  type AsaAiHistoryEntry,
  type TableInfo,
} from "@/lib/asa-api"
import { downloadBlob, timestampedFilename } from "@/lib/export-utils"

type MessageRole = "user" | "assistant"

type ChartConfig = {
  type: "bar" | "pie"
  labelCol: string
  valueCol: string
  data: Record<string, unknown>[]
}

type ResultData = {
  columns: string[]
  rows: Record<string, string>[]
  sql: string
  rowCount: number
  chart?: ChartConfig
}

type Message = {
  id: string
  role: MessageRole
  content: string
  result?: ResultData
  error?: string
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"]

function detectChart(cols: string[], rows: Record<string, string>[]): ChartConfig | null {
  if (rows.length < 2 || rows.length > 50) return null
  const numCols = cols.filter((c) => rows.every((r) => !isNaN(Number(r[c])) && r[c] !== ""))
  const strCols = cols.filter((c) => !numCols.includes(c))
  if (numCols.length === 0 || strCols.length === 0) return null
  const labelCol = strCols[0]
  const valueCol = numCols[0]
  const data = rows.map((r) => ({ [labelCol]: r[labelCol], [valueCol]: Number(r[valueCol]) }))
  const type = strCols.length >= 3 || data.length <= 8 ? "pie" : "bar"
  return { type, labelCol, valueCol, data }
}

function normalizeRows(columns: string[], rows: unknown[][]) {
  return rows.map((row) => {
    const obj: Record<string, string> = {}
    columns.forEach((col, index) => {
      obj[col] = String(row[index] ?? "")
    })
    return obj
  })
}

function historyToMessages(history: AsaAiChatHistoryMessage[]): Message[] {
  return history.map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
  }))
}

export const Route = createFileRoute("/__maniLayout/asa/sql-assistant")({
  component: RouteComponent,
})

function RouteComponent() {
  const [messages, setMessages] = React.useState<Message[]>([])
  const [input, setInput] = React.useState("")
  const [processing, setProcessing] = React.useState(false)
  const [tab, setTab] = React.useState<"chart" | "table">("table")
  const [chartMsgId, setChartMsgId] = React.useState<string | null>(null)
  const [tables, setTables] = React.useState<TableInfo[]>([])
  const [queryHistory, setQueryHistory] = React.useState<AsaAiHistoryEntry[]>([])
  const [aiEnabled, setAiEnabled] = React.useState(true)
  const messagesEndRef = React.useRef<HTMLDivElement | null>(null)
  const safeQueryHistory = Array.isArray(queryHistory) ? queryHistory : []

  React.useEffect(() => {
    Promise.all([
      listTables().catch(() => []),
      fetchAsaAiHistory().catch(() => []),
      fetchAsaAiChatHistory().catch(() => []),
      fetchAsaAiConfig().catch(() => null),
    ]).then(([tableData, historyData, chatHistory, config]) => {
      setTables(tableData)
      setQueryHistory(historyData)
      setMessages(historyToMessages(chatHistory))
      setAiEnabled(config?.enabled ?? false)
    })
  }, [])

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, processing])

  function addMessage(role: MessageRole, content: string, result?: ResultData, error?: string) {
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role, content, result, error },
    ])
  }

  async function refreshHistory() {
    const [historyData, chatHistory] = await Promise.all([
      fetchAsaAiHistory().catch(() => []),
      fetchAsaAiChatHistory().catch(() => []),
    ])
    setQueryHistory(historyData)
    setMessages((current) => {
      const currentResults = new Map(
        current
          .filter((message) => message.result || message.error)
          .map((message) => [message.content + message.role, message]),
      )

      return historyToMessages(chatHistory).map((message) => {
        const matched = currentResults.get(message.content + message.role)
        return matched ? { ...message, result: matched.result, error: matched.error } : message
      })
    })
  }

  async function handleSend(query: string) {
    const trimmed = query.trim()
    if (!trimmed || processing) return

    addMessage("user", trimmed)
    setInput("")
    setProcessing(true)

    try {
      const response = await chatWithAsaAssistant(trimmed)
      const rows = normalizeRows(response.columns, response.rows)
      const chart = detectChart(response.columns, rows)

      addMessage("assistant", response.answer, {
        columns: response.columns,
        rows,
        sql: response.sql,
        rowCount: response.rowCount,
        chart: chart ?? undefined,
      })

      await refreshHistory()
    } catch (err) {
      addMessage(
        "assistant",
        "",
        undefined,
        err instanceof Error ? err.message : "Unknown error",
      )
    } finally {
      setProcessing(false)
    }
  }

  function handleExport(sql: string) {
    exportExcel(sql).then((blob) => {
      downloadBlob(blob, timestampedFilename("query-results", "xlsx"))
    })
  }

  const lastResult = [...messages].reverse().find((m) => m.result)?.result

  return (
    <div className="w-full min-w-0 max-w-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AI SQL Assistant</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ask sales questions about `ecommerce_sales_data.xlsx`, generate validated SQL, execute it, and inspect the results.
          </p>
        </div>
        <div className="flex gap-2">
          {tables.length > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                exportPdf().then((blob) =>
                  downloadBlob(blob, timestampedFilename("asa-dashboard", "pdf")),
                )
              }
            >
              <Download className="size-4" /> PDF
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <Card className="min-w-0 border-border/70 shadow-sm">
            <CardContent className="flex flex-col p-0">
              <div className="flex items-center justify-between border-b border-border/70 px-5 py-3">
                <div className="flex items-center gap-2">
                  <Terminal className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Chat</span>
                </div>
                {lastResult?.chart ? (
                  <div className="flex gap-1">
                    <Button
                      variant={tab === "table" ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => setTab("table")}
                    >
                      Table
                    </Button>
                    <Button
                      variant={tab === "chart" ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => setTab("chart")}
                    >
                      <BarChart3 className="size-3.5" /> Chart
                    </Button>
                  </div>
                ) : null}
              </div>

              <div className="h-[500px] space-y-4 overflow-y-auto overflow-x-hidden p-5">
                {messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <Sparkles className="size-10 text-muted-foreground/40" />
                    <p className="mt-4 text-sm font-medium text-foreground">Ask a question about your data</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Use natural language or direct SQL. Every query is validated before execution.
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id}>
                      <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                            msg.role === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted/50 text-foreground"
                          }`}
                        >
                          <p className="text-sm leading-6 whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      </div>

                      {msg.result ? (
                        <div className="mt-3 min-w-0 space-y-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <code className="rounded-md bg-muted px-3 py-1.5 text-xs text-muted-foreground font-mono flex-1 truncate">
                              {msg.result.sql}
                            </code>
                            <TooltipButton
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => navigator.clipboard.writeText(msg.result!.sql)}
                              tooltip="Copy SQL"
                            >
                              <Copy className="size-3.5" />
                            </TooltipButton>
                            <Button variant="ghost" size="sm" onClick={() => handleExport(msg.result!.sql)}>
                              <Download className="size-3.5" /> Excel
                            </Button>
                          </div>

                          {msg.result.chart && tab === "chart" && chartMsgId === msg.id ? (
                            <div className="rounded-2xl border border-border/70 p-4">
                              {msg.result.chart.type === "bar" ? (
                                <div className="h-[300px]">
                                  <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={msg.result.chart.data}>
                                      <CartesianGrid strokeDasharray="3 3" />
                                      <XAxis dataKey={msg.result.chart.labelCol} tick={{ fontSize: 11 }} />
                                      <YAxis tick={{ fontSize: 11 }} />
                                      <Tooltip />
                                      <Bar dataKey={msg.result.chart.valueCol} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                  </ResponsiveContainer>
                                </div>
                              ) : (
                                <div className="h-[300px]">
                                  <ResponsiveContainer width="100%" height="100%">
                                    <RPieChart>
                                      <Pie
                                        data={msg.result.chart.data}
                                        dataKey={msg.result.chart.valueCol}
                                        nameKey={msg.result.chart.labelCol}
                                        cx="50%"
                                        cy="50%"
                                        outerRadius={100}
                                        label={({ name, percent }) =>
                                          `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`
                                        }
                                      >
                                        {msg.result.chart.data.map((_, i) => (
                                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                        ))}
                                      </Pie>
                                      <Tooltip />
                                      <Legend />
                                    </RPieChart>
                                  </ResponsiveContainer>
                                </div>
                              )}
                            </div>
                          ) : null}

                          <DataTable
                            columns={msg.result.columns.map((col) => ({
                              id: col,
                              header: col,
                              headerClassName: "whitespace-nowrap py-2.5",
                              className: "max-w-[200px] truncate py-2.5",
                              cell: (row: Record<string, string>) => row[col] ?? "—",
                            }))}
                            rows={msg.result.rows}
                            rowKey={(_row, rowIndex) => rowIndex}
                            minWidth="max-content"
                            maxHeight="360px"
                          />

                          {msg.result.chart ? (
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setTab("chart")
                                  setChartMsgId(msg.id)
                                }}
                              >
                                <BarChart3 className="size-3.5" /> View Chart
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      {msg.error && !msg.result ? (
                        <div className="mt-3 flex items-start gap-2 rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                          <AlertCircle className="mt-0.5 size-4 shrink-0" />
                          <span>{msg.error}</span>
                        </div>
                      ) : null}
                    </div>
                  ))
                )}

                {processing ? (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-2 rounded-2xl bg-muted/50 px-4 py-3">
                      <Loader2 className="size-4 animate-spin text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Generating and validating SQL...</span>
                    </div>
                  </div>
                ) : null}
                <div ref={messagesEndRef} />
              </div>

              <div className="border-t border-border/70 p-4">
                {!aiEnabled ? (
                  <div className="mb-3 rounded-2xl border border-border/70 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                    Gemini is not enabled. Set `GEMINI_API_KEY` or `API_KEY` in the backend environment to activate the AI SQL assistant.
                  </div>
                ) : null}
                <div className="flex items-center gap-3">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        void handleSend(input)
                      }
                    }}
                    placeholder="Enter SQL directly or ask in plain English..."
                    className="h-10 font-mono text-sm"
                    disabled={processing}
                  />
                  <Button onClick={() => void handleSend(input)} disabled={!input.trim() || processing}>
                    <Send className="size-4" /> Send
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {messages.length === 0 ? (
            <Card className="border-border/70 shadow-sm">
              <CardHeader className="space-y-1 p-4 pb-2">
                <div className="flex items-center gap-2">
                  <Lightbulb className="size-4 text-amber-500" />
                  <CardTitle className="text-sm">Example Queries</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                <div className="grid gap-2 sm:grid-cols-2">
                  {(safeQueryHistory.length > 0
                    ? safeQueryHistory.slice(0, 4).map((item) => ({
                        label: item.question,
                        query: item.question,
                      }))
                    : [
                        { label: "Top customers by revenue", query: "Show the top 10 customers by revenue." },
                        { label: "Find duplicates", query: "Find duplicate records." },
                        { label: "Best sales month", query: "Which month generated the highest sales?" },
                        { label: "Missing values", query: "Show records with missing values." },
                      ]).map((ex) => (
                    <button
                      key={ex.label}
                      type="button"
                      onClick={() => void handleSend(ex.query)}
                      className="flex items-center gap-2 rounded-xl border border-border/60 px-3 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:border-border hover:bg-muted/30"
                    >
                      <BarChart3 className="size-3.5 shrink-0" />
                      <span>{ex.label}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card className="border-border/70 shadow-sm">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="size-4 text-muted-foreground" />
                <CardTitle className="text-sm">Available Tables</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              {tables.length === 0 ? (
                <p className="text-xs text-muted-foreground">No tables uploaded yet.</p>
              ) : (
                <div className="space-y-2">
                  {tables.map((t) => (
                    <button
                      key={t.tableName}
                      type="button"
                      onClick={() => void handleSend(`SELECT * FROM "${t.tableName}" LIMIT 50;`)}
                      className="flex w-full items-center gap-2 rounded-xl border border-border/60 px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-border hover:bg-muted/30"
                    >
                      <span className="font-mono text-foreground">{t.tableName}</span>
                      <span className="ml-auto text-[10px]">{t.rowCount} rows</span>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-sm">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center gap-2">
                <History className="size-4 text-muted-foreground" />
                <CardTitle className="text-sm">Query History</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              {safeQueryHistory.length === 0 ? (
                <p className="text-xs text-muted-foreground">No queries yet.</p>
              ) : (
                <div className="max-h-[240px] space-y-2 overflow-y-auto">
                  {safeQueryHistory.slice(0, 20).map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => void handleSend(entry.question)}
                      className="flex w-full flex-col items-start gap-1 rounded-xl border border-border/60 px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-border hover:bg-muted/30"
                    >
                      <span className="w-full truncate text-foreground">{entry.question}</span>
                      <span className="w-full truncate">{entry.sql}</span>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setMessages([])}>
              <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M9 12h6M10 18h4" />
              </svg>
              Clear Chat
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
