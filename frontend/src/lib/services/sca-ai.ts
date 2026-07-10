import { api } from "@/lib/api-client"

export type ScaAiSection = {
  title: string
  rows: Record<string, unknown>[]
}

export type ScaAiConfig = {
  enabled: boolean
  provider: string
  model: string
  endpoint: string
  suggestions: string[]
}

export type ScaAiChatResponse = {
  answer: string
  runCode: string | null
  generatedAt: string | null
  model: string
  intent: string
  sections: ScaAiSection[]
}

export type ScaAiHistoryEntry = {
  id: string
  question: string
  answer: string
  runCode: string
  generatedAt: string
  askedAt: string
}

export type ScaAiChatHistoryMessage = {
  id: string
  exchangeId: string
  role: "user" | "assistant"
  content: string
  intent: string | null
  runCode: string | null
  generatedAt: string | null
  createdAt: string
}

export async function fetchScaAiConfig(): Promise<ScaAiConfig> {
  const data = await api.get<ScaAiConfig>("/ai/config")
  return data[0]
}

export async function sendScaAiMessage(
  message: string,
): Promise<ScaAiChatResponse> {
  const data = await api.post<ScaAiChatResponse>("/ai/chat", { message })
  return data[0]
}

export async function fetchScaAiHistory(): Promise<ScaAiHistoryEntry[]> {
  return api.get<ScaAiHistoryEntry>("/ai/history")
}

export async function fetchScaAiChatHistory(): Promise<ScaAiChatHistoryMessage[]> {
  return api.get<ScaAiChatHistoryMessage>("/ai/chat-history")
}
