const BASE_URL = `${import.meta.env.VITE_API_BASE_URL || "http://localhost:4001"}${
  import.meta.env.VITE_ASA_API_URL || "/api/asa"
}`

export type ColumnInfo = { name: string; type: string; category?: string }

export type TableInfo = {
  tableName: string
  fileName?: string
  rowCount: number
  columnCount: number
  createdAt?: string
  updatedAt?: string
  columns: ColumnInfo[]
  rows?: Record<string, string>[]
  totalRows?: number
}

export type AsaDashboardMetric = {
  label: string
  value: number | string
  helper: string
}

export type AsaDashboardSeriesPoint = {
  label: string
  value: number
}

export type AsaDashboardSummary = {
  useCase: "ecommerce"
  metrics: AsaDashboardMetric[]
  insights: string[]
  primaryDataset: {
    tableName: string
    fileName?: string
    rowCount: number
    columnCount: number
    createdAt?: string
    updatedAt?: string
    columns: ColumnInfo[]
  } | null
  charts: {
    rowsByTable: AsaDashboardSeriesPoint[]
    schemaTypes: AsaDashboardSeriesPoint[]
    monthlyRevenue: AsaDashboardSeriesPoint[]
    revenueByCategory: AsaDashboardSeriesPoint[]
    paymentMethodMix: AsaDashboardSeriesPoint[]
    orderStatusMix: AsaDashboardSeriesPoint[]
  }
  queryHistory: AsaAiHistoryEntry[]
  tables: TableInfo[]
}

export type QueryResult = {
  columns: string[]
  rows: unknown[][]
  rowCount: number
  error?: string
}

export type AsaAiConfig = {
  enabled: boolean
  provider: string
  model: string
  endpoint: string
  dataset?: string
  suggestions: string[]
}

export type AsaAiChatResponse = {
  answer: string
  sql: string
  columns: string[]
  rows: unknown[][]
  rowCount: number
  model: string
  tables: string[]
}

export type AsaAiHistoryEntry = {
  id: string
  question: string
  answer: string
  sql: string
  rowCount: number
  askedAt: string
}

export type AsaAiChatHistoryMessage = {
  id: string
  exchangeId: string
  role: "user" | "assistant"
  content: string
  sql: string | null
  tables: string[]
  rowCount: number | null
  createdAt: string
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Request failed: ${res.statusText}`)
  }
  return res.json()
}

export async function uploadCsv(file: File): Promise<TableInfo> {
  const form = new FormData()
  form.append("file", file)
  const res = await fetch(`${BASE_URL}/upload`, { method: "POST", body: form })
  return handleResponse<TableInfo>(res)
}

export async function detectDataset(file: File): Promise<TableInfo> {
  const form = new FormData()
  form.append("file", file)
  const res = await fetch(`${BASE_URL}/detect`, { method: "POST", body: form })
  return handleResponse<TableInfo>(res)
}

export async function listTables(): Promise<TableInfo[]> {
  const res = await fetch(`${BASE_URL}/tables`)
  return handleResponse<TableInfo[]>(res)
}

export async function fetchAsaDashboardSummary(): Promise<AsaDashboardSummary> {
  const res = await fetch(`${BASE_URL}/dashboard/summary`)
  return handleResponse<AsaDashboardSummary>(res)
}

export async function getTableDetails(tableName: string): Promise<TableInfo> {
  const res = await fetch(`${BASE_URL}/tables/${encodeURIComponent(tableName)}`)
  return handleResponse<TableInfo>(res)
}

export async function deleteTable(tableName: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/tables/${encodeURIComponent(tableName)}`, { method: "DELETE" })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || "Delete failed")
  }
}

export async function queryTable(sql: string): Promise<QueryResult> {
  const res = await fetch(`${BASE_URL}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sql }),
  })
  return handleResponse<QueryResult>(res)
}

export async function exportExcel(sql: string): Promise<Blob> {
  const res = await fetch(`${BASE_URL}/export/excel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sql }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || "Export failed")
  }
  return res.blob()
}

export async function exportPdf(): Promise<Blob> {
  const res = await fetch(`${BASE_URL}/export/pdf`, { method: "POST" })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || "Export failed")
  }
  return res.blob()
}

export async function fetchAsaAiConfig(): Promise<AsaAiConfig> {
  const res = await fetch(`${BASE_URL}/ai/config`)
  return handleResponse<AsaAiConfig>(res)
}

export async function fetchAsaAiHistory(): Promise<AsaAiHistoryEntry[]> {
  const res = await fetch(`${BASE_URL}/ai/history`)
  return handleResponse<AsaAiHistoryEntry[]>(res)
}

export async function fetchAsaAiChatHistory(): Promise<AsaAiChatHistoryMessage[]> {
  const res = await fetch(`${BASE_URL}/ai/chat-history`)
  return handleResponse<AsaAiChatHistoryMessage[]>(res)
}

export async function chatWithAsaAssistant(
  message: string,
): Promise<AsaAiChatResponse> {
  const res = await fetch(`${BASE_URL}/ai/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  })
  return handleResponse<AsaAiChatResponse>(res)
}
