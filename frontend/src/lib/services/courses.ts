import { api, type PaginatedResult } from "@/lib/api-client"
import { DEFAULT_PAGE_LIMIT } from "@/config/app-settings"

export type CourseSeatsByCategory = {
  general: number
  obc: number
  sc: number
  st: number
}

export type CourseCutoffsByCategory = CourseSeatsByCategory

export type CourseRecord = {
  _id?: string
  course_name: string
  total_seats: number
  reserved_seats: CourseSeatsByCategory
  cutoffs: CourseCutoffsByCategory
}

export async function fetchCourses(): Promise<CourseRecord[]> {
  return api.get<CourseRecord>("/courses?is_active=true")
}

export async function fetchCoursesPaginated(
  page = 1,
  limit = DEFAULT_PAGE_LIMIT,
  search?: string,
): Promise<PaginatedResult<CourseRecord>> {
  const params = new URLSearchParams({ is_active: "true", page: String(page), page_count: String(limit) })
  if (search) params.set("q", search)
  return api.getPaginated<CourseRecord>(`/courses?${params.toString()}`)
}

export async function fetchCourse(
  courseName: string,
): Promise<CourseRecord> {
  return api.getById<CourseRecord>(
    `/courses/${encodeURIComponent(courseName)}?is_active=true`,
  )
}

export async function createCourse(
  course: Omit<CourseRecord, "_id">,
): Promise<CourseRecord> {
  const data = await api.post<CourseRecord>("/courses", course)
  return data[0]
}

export async function updateCourse(
  courseName: string,
  course: Partial<CourseRecord>,
): Promise<CourseRecord> {
  const data = await api.patch<CourseRecord>(
    `/courses/${encodeURIComponent(courseName)}`,
    course,
  )
  return data[0]
}

export async function deleteCourse(courseName: string): Promise<void> {
  await api.delete(`/courses/${encodeURIComponent(courseName)}`)
}
