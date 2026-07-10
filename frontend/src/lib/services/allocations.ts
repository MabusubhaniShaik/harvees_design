import { api } from "@/lib/api-client"

export type AllocationRecord = {
  student: string
  student_id: string
  student_name: string
  category: string
  marks: number
  application_date: string
  preferences: [string, string, string]
  allocated_course_id: string | null
  allocated_course: string | null
  allocated_preference: 1 | 2 | 3 | null
  allocation_reason: string
}

export type RemainingCourseSeats = {
  course_name: string
  remaining_seats: {
    general: number
    obc: number
    sc: number
    st: number
  }
}

export type AllocationRunRecord = {
  _id: string
  run_code: string
  status: "preview" | "completed" | "cancelled"
  generated_at: string
  total_students: number
  allocated_students: number
  unallocated_students: number
  first_preference_allocations: number
  allocations: AllocationRecord[]
  remaining_seats_by_course: RemainingCourseSeats[]
}

export async function runAllocation(): Promise<AllocationRunRecord> {
  const data = await api.post<AllocationRunRecord>("/allocations/run", {})
  return data[0]
}

export async function fetchAllocationRuns(): Promise<AllocationRunRecord[]> {
  return api.get<AllocationRunRecord>("/allocations?is_active=true")
}

export async function fetchLatestAllocation(): Promise<AllocationRunRecord | null> {
  const data = await api.get<AllocationRunRecord>("/allocations/latest")
  return data[0] ?? null
}

export async function fetchAllocationRun(
  runCode: string,
): Promise<AllocationRunRecord> {
  return api.getById<AllocationRunRecord>(
    `/allocations/${encodeURIComponent(runCode)}?is_active=true`,
  )
}
