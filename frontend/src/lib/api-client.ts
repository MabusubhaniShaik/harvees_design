export type PaginationInfo = {
  count: number
  current_page: number
  total_page_count: number
  total_record_count: number
}

type ApiResponse<T> = {
  status: "success" | "fail"
  data: T[]
  message: string
  pagination?: PaginationInfo
}

export type PaginatedResult<T> = {
  data: T[]
  pagination: PaginationInfo
}

class ApiClient {
  private baseUrl: string

  constructor(
    baseUrl =
      `${import.meta.env.VITE_API_BASE_URL || "http://localhost:4001"}${
        import.meta.env.VITE_SCA_API_URL || "/api/sca"
      }`,
  ) {
    this.baseUrl = baseUrl
  }

  private async requestRaw<T>(
    endpoint: string,
    options?: RequestInit,
  ): Promise<ApiResponse<T>> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    })

    const result: ApiResponse<T> = await response.json()

    if (result.status === "fail") {
      throw new Error(result.message || "API request failed")
    }

    return result
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit,
  ): Promise<T[]> {
    const result = await this.requestRaw<T>(endpoint, options)
    return result.data
  }

  async get<T>(endpoint: string): Promise<T[]> {
    return this.request<T>(endpoint)
  }

  async getPaginated<T>(endpoint: string): Promise<PaginatedResult<T>> {
    const result = await this.requestRaw<T>(endpoint)

    return {
      data: result.data,
      pagination: result.pagination ?? {
        count: result.data.length,
        current_page: 1,
        total_page_count: 1,
        total_record_count: result.data.length,
      },
    }
  }

  async getById<T>(endpoint: string): Promise<T> {
    const data = await this.request<T>(endpoint)
    return data[0]
  }

  async post<T>(endpoint: string, body: unknown): Promise<T[]> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: JSON.stringify(body),
    })
  }

  async put<T>(endpoint: string, body: unknown): Promise<T[]> {
    return this.request<T>(endpoint, {
      method: "PUT",
      body: JSON.stringify(body),
    })
  }

  async patch<T>(endpoint: string, body: unknown): Promise<T[]> {
    return this.request<T>(endpoint, {
      method: "PATCH",
      body: JSON.stringify(body),
    })
  }

  async delete<T>(endpoint: string): Promise<T[]> {
    return this.request<T>(endpoint, { method: "DELETE" })
  }
}

export const api = new ApiClient()
