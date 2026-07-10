import { api, type PaginatedResult } from "@/lib/api-client"
import { DEFAULT_PAGE_LIMIT } from "@/config/app-settings"

export type StudentCategory = "General" | "OBC" | "SC" | "ST"

export type StudentRecord = {
  _id?: string
  student_id: string
  student_name: string
  marks: number
  category: StudentCategory
  application_date: string
  preferences: [string, string, string]
  allocation_status?: "pending" | "allocated" | "unallocated"
  allocated_course_name?: string | null
  allocated_preference?: 1 | 2 | 3 | null
}

export async function fetchStudents(): Promise<StudentRecord[]> {
  return api.get<StudentRecord>("/students?is_active=true")
}

export async function fetchStudentsPaginated(
  page = 1,
  limit = DEFAULT_PAGE_LIMIT,
  search?: string,
): Promise<PaginatedResult<StudentRecord>> {
  const params = new URLSearchParams({ is_active: "true", page: String(page), page_count: String(limit) })
  if (search) params.set("q", search)
  return api.getPaginated<StudentRecord>(`/students?${params.toString()}`)
}

export async function fetchStudentById(id: string): Promise<StudentRecord> {
  return api.getById<StudentRecord>(
    `/students/${encodeURIComponent(id)}?is_active=true`,
  )
}

export async function createStudent(
  student: Omit<StudentRecord, "_id">,
): Promise<StudentRecord> {
  const data = await api.post<StudentRecord>("/students", student)
  return data[0]
}

export async function updateStudent(
  studentId: string,
  student: Partial<StudentRecord>,
): Promise<StudentRecord> {
  const data = await api.patch<StudentRecord>(
    `/students/${encodeURIComponent(studentId)}`,
    student,
  )
  return data[0]
}

export async function deleteStudent(studentId: string): Promise<void> {
  await api.delete(`/students/${encodeURIComponent(studentId)}`)
}
