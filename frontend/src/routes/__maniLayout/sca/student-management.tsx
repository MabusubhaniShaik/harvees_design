import * as React from "react"
import { createFileRoute } from "@tanstack/react-router"
import {
  Eye,
  Loader2,
  PencilLine,
  Plus,
  Save,
  Search,
  Trash2,
  UserRound,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { TooltipButton } from "@/components/ui/tooltip-button"
import {
  fetchStudents,
  fetchStudentsPaginated,
  fetchStudentById,
  createStudent,
  updateStudent,
  deleteStudent,
  type StudentCategory,
  type StudentRecord,
} from "@/lib/services/students"
import { fetchCourses } from "@/lib/services/courses"
import { Pagination } from "@/components/ui/pagination"
import { DEFAULT_PAGE_LIMIT } from "@/config/app-settings"

type StudentFormState = {
  studentId: string
  studentName: string
  marks: string
  category: StudentCategory
  applicationDate: string
  preference1: string
  preference2: string
  preference3: string
}

type StudentFormErrors = Partial<Record<keyof StudentFormState, string>>

const studentCategories: readonly StudentCategory[] = [
  "General",
  "OBC",
  "SC",
  "ST",
]

const preferenceFields = [
  "preference1",
  "preference2",
  "preference3",
] as const
const duplicatePreferenceMessage = "This course has already been selected."

const emptyFormState: StudentFormState = {
  studentId: "",
  studentName: "",
  marks: "",
  category: "General",
  applicationDate: "",
  preference1: "",
  preference2: "",
  preference3: "",
}

const monthLookup: Record<string, string> = {
  Jan: "01",
  Feb: "02",
  Mar: "03",
  Apr: "04",
  May: "05",
  Jun: "06",
  Jul: "07",
  Aug: "08",
  Sep: "09",
  Oct: "10",
  Nov: "11",
  Dec: "12",
}

function toDateInputValue(value: string) {
  const trimmedValue = value.trim()
  if (!trimmedValue) return ""

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmedValue)) {
    return trimmedValue
  }

  const dayMonthYearMatch = trimmedValue.match(
    /^(\d{2})[-/ ]([A-Za-z]{3})[-/ ](\d{4})$/
  )
  if (dayMonthYearMatch) {
    const [, day, monthName, year] = dayMonthYearMatch
    const normalizedMonth =
      monthLookup[
        monthName.charAt(0).toUpperCase() + monthName.slice(1).toLowerCase()
      ]

    if (normalizedMonth) {
      return `${year}-${normalizedMonth}-${day}`
    }
  }

  const parsedDate = new Date(trimmedValue)
  if (Number.isNaN(parsedDate.getTime())) {
    return ""
  }

  const year = parsedDate.getUTCFullYear()
  const month = String(parsedDate.getUTCMonth() + 1).padStart(2, "0")
  const day = String(parsedDate.getUTCDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

function toFormState(student?: StudentRecord): StudentFormState {
  if (!student) {
    return emptyFormState
  }

  return {
    studentId: student.student_id,
    studentName: student.student_name,
    marks: String(student.marks),
    category: student.category,
    applicationDate: toDateInputValue(student.application_date),
    preference1: student.preferences[0],
    preference2: student.preferences[1],
    preference3: student.preferences[2],
  }
}

function validateStudentForm(
  form: StudentFormState,
  students: readonly StudentRecord[],
  editingStudentId: string | null
): StudentFormErrors {
  const errors: StudentFormErrors = {}
  const normalizedStudentId = form.studentId.trim()
  const normalizedStudentName = form.studentName.trim()
  const normalizedPreferences = [
    form.preference1.trim(),
    form.preference2.trim(),
    form.preference3.trim(),
  ]
  const marks = Number(form.marks)

  if (!normalizedStudentId) {
    errors.studentId = "Student ID is required."
  } else {
    const duplicateStudent = students.find(
      (student) =>
        student.student_id.toLowerCase() ===
          normalizedStudentId.toLowerCase() &&
        student.student_id !== editingStudentId
    )

    if (duplicateStudent) {
      errors.studentId = "Student ID must be unique."
    }
  }

  if (!normalizedStudentName) {
    errors.studentName = "Student name is required."
  }

  if (!form.marks.trim()) {
    errors.marks = "Marks are required."
  } else if (Number.isNaN(marks) || marks < 0 || marks > 100) {
    errors.marks = "Marks must be a number between 0 and 100."
  }

  if (!form.applicationDate) {
    errors.applicationDate = "Application date is required."
  }

  normalizedPreferences.forEach((preference, index) => {
    const fieldName = `preference${index + 1}` as keyof StudentFormState
    if (!preference) {
      errors[fieldName] = `Preference ${index + 1} is required.`
    }
  })

  const seenPreferences = new Set<string>()
  normalizedPreferences.forEach((preference, index) => {
    if (!preference) return

    const normalizedPreference = preference.toLowerCase()
    const fieldName = `preference${index + 1}` as keyof StudentFormState

    if (seenPreferences.has(normalizedPreference)) {
      errors[fieldName] = duplicatePreferenceMessage
      return
    }

    seenPreferences.add(normalizedPreference)
  })

  return errors
}

function buildStudentRecord(
  form: StudentFormState
): Omit<StudentRecord, "_id"> {
  return {
    student_id: form.studentId.trim(),
    student_name: form.studentName.trim(),
    marks: Number(form.marks),
    category: form.category,
    application_date: form.applicationDate,
    preferences: [
      form.preference1.trim(),
      form.preference2.trim(),
      form.preference3.trim(),
    ],
  }
}

function formatDate(date: string) {
  if (!date) return "—"
  const d = new Date(date)
  if (isNaN(d.getTime())) return "—"
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d)
}

function formatAllocatedPreference(preference?: 1 | 2 | 3 | null) {
  if (!preference) return "—"
  return `${preference}${preference === 1 ? "st" : preference === 2 ? "nd" : "rd"} Preference`
}

function FieldLabel({
  label,
  required = false,
}: {
  label: string
  required?: boolean
}) {
  return (
    <label className="text-sm font-medium text-foreground">
      {label}
      {required ? <span className="ml-1 text-destructive">*</span> : null}
    </label>
  )
}

function FieldMessage({ message }: { message?: string }) {
  if (!message) {
    return null
  }

  return <p className="text-xs text-destructive">{message}</p>
}

const dialogInputClassName =
  "h-9 rounded-md px-3 text-sm shadow-none transition-none focus-visible:ring-2"

const dialogSelectClassName =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-none outline-none transition-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"

function DetailField({
  label,
  value,
  className,
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-background px-4 py-3">
      <p className="text-xs tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={["mt-1 font-medium text-foreground", className]
          .filter(Boolean)
          .join(" ")}
      >
        {value}
      </p>
    </div>
  )
}

export const Route = createFileRoute("/__maniLayout/sca/student-management")({
  component: RouteComponent,
})

function RouteComponent() {
  const [students, setStudents] = React.useState<StudentRecord[]>([])
  const [displayStudents, setDisplayStudents] = React.useState<StudentRecord[]>(
    []
  )
  const [availableCourses, setAvailableCourses] = React.useState<string[]>([])
  const [loading, setLoading] = React.useState(true)
  const [pageLoading, setPageLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [formState, setFormState] =
    React.useState<StudentFormState>(emptyFormState)
  const [formErrors, setFormErrors] = React.useState<StudentFormErrors>({})
  const [editingStudentId, setEditingStudentId] = React.useState<string | null>(
    null
  )
  const [selectedStudentId, setSelectedStudentId] = React.useState<
    string | null
  >(null)
  const [searchTerm, setSearchTerm] = React.useState("")
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const [drawerLoading, setDrawerLoading] = React.useState(false)
  const [viewingStudent, setViewingStudent] =
    React.useState<StudentRecord | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<string | null>(null)
  const [page, setPage] = React.useState(1)
  const [totalPages, setTotalPages] = React.useState(1)
  const [totalRecords, setTotalRecords] = React.useState(0)
  const PAGE_LIMIT = DEFAULT_PAGE_LIMIT

  const loadStudentPage = React.useCallback(async () => {
    const search = searchTerm.trim() || undefined
    const [paginated, coursesData] = await Promise.all([
      fetchStudentsPaginated(page, PAGE_LIMIT, search),
      fetchCourses(),
    ])

    setDisplayStudents(paginated.data)
    setTotalPages(paginated.pagination.total_page_count)
    setTotalRecords(paginated.pagination.total_record_count)
    setAvailableCourses(coursesData.map((course) => course.course_name))
  }, [page, searchTerm, PAGE_LIMIT])

  const loadStudentsForValidation = React.useCallback(async () => {
    const allStudents = await fetchStudents()
    setStudents(allStudents)
    return allStudents
  }, [])

  React.useEffect(() => {
    setPageLoading(true)
    loadStudentPage()
      .catch((err) => {
        console.error("Failed to load students:", err)
      })
      .finally(() => {
        setPageLoading(false)
        setLoading(false)
      })
  }, [loadStudentPage])

  React.useEffect(() => {
    loadStudentsForValidation().catch((err) =>
      console.error("Failed to load student list for validation:", err)
    )
  }, [loadStudentsForValidation])

  React.useEffect(() => {
    if (displayStudents.length > 0) {
      setSelectedStudentId((current) => {
        if (
          !current ||
          !displayStudents.find((s) => s.student_id === current)
        ) {
          return displayStudents[0].student_id
        }
        return current
      })
    }
  }, [displayStudents])

  const totalStudents = students.length
  const reservedCategoryStudents = students.filter(
    (student) => student.category !== "General"
  ).length
  const averageMarks =
    totalStudents === 0
      ? "0"
      : (
          students.reduce((sum, student) => sum + student.marks, 0) /
          totalStudents
        ).toFixed(1)

  function resetForm() {
    setFormState(emptyFormState)
    setFormErrors({})
    setEditingStudentId(null)
  }

  function handleInputChange(
    field: keyof StudentFormState,
    value: string | StudentCategory
  ) {
    const nextFormState = {
      ...formState,
      [field]: value,
    }
    setFormState(nextFormState)

    setFormErrors((current) => {
      const nextErrors = { ...current, [field]: undefined }

      if (preferenceFields.includes(field as (typeof preferenceFields)[number])) {
        preferenceFields.forEach((preferenceField) => {
          if (nextErrors[preferenceField] === duplicatePreferenceMessage) {
            nextErrors[preferenceField] = undefined
          }
        })

        const seenPreferences = new Set<string>()
        preferenceFields.forEach((preferenceField) => {
          const preference = nextFormState[preferenceField].trim().toLowerCase()
          if (!preference) return

          if (seenPreferences.has(preference)) {
            nextErrors[preferenceField] = duplicatePreferenceMessage
          } else {
            seenPreferences.add(preference)
          }
        })
      }

      return nextErrors
    })
  }

  function openRegisterDialog() {
    resetForm()
    setDialogOpen(true)
  }

  function openEditDialog(student: StudentRecord) {
    setEditingStudentId(student.student_id)
    setSelectedStudentId(student.student_id)
    setFormState(toFormState(student))
    setFormErrors({})
    setDialogOpen(true)
  }

  async function openViewDrawer(student: StudentRecord) {
    setDrawerOpen(true)
    setDrawerLoading(true)
    setViewingStudent(null)
    try {
      const data = await fetchStudentById(student._id!)
      setViewingStudent(data)
    } catch (err) {
      console.error("Failed to fetch student details:", err)
    } finally {
      setDrawerLoading(false)
    }
  }

  function closeDialog() {
    setDialogOpen(false)
    resetForm()
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const errors = validateStudentForm(formState, students, editingStudentId)
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    setSaving(true)
    try {
      const nextStudent = buildStudentRecord(formState)

      if (editingStudentId) {
        await updateStudent(editingStudentId, nextStudent)
      } else {
        const created = await createStudent(nextStudent)
        setSelectedStudentId(created.student_id)
        if (page !== 1) {
          setPage(1)
        }
      }

      await Promise.all([loadStudentsForValidation(), loadStudentPage()])
      closeDialog()
    } catch (err) {
      console.error("Failed to save student:", err)
    } finally {
      setSaving(false)
    }
  }

  async function confirmDeleteStudent() {
    if (!deleteTarget) return

    try {
      await deleteStudent(deleteTarget)
      await Promise.all([loadStudentsForValidation(), loadStudentPage()])

      if (selectedStudentId === deleteTarget) {
        setSelectedStudentId(null)
      }

      if (editingStudentId === deleteTarget) {
        resetForm()
      }
    } catch (err) {
      console.error("Failed to delete student:", err)
    } finally {
      setDeleteTarget(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-56" />
            <Skeleton className="mt-2 h-4 w-72" />
          </div>
        </div>
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1">
              <Skeleton className="h-7 w-40" />
              <Skeleton className="h-5 w-72" />
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-64 rounded-lg" />
              <Skeleton className="h-10 w-36 rounded-lg" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: PAGE_LIMIT }).map((_, i) => (
              <Skeleton key={i} className="h-[72px] w-full rounded-2xl" />
            ))}
            <Skeleton className="h-10 w-full rounded-lg" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Student Management
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Register, review, update, and remove student applications.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/70 shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Total Students</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {totalStudents}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              All active student applications
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/70 shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">
              Reserved Category Students
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {reservedCategoryStudents}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Applications under OBC, SC, and ST
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/70 shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Average Marks</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {averageMarks}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Helps validate merit-ready data quality
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <CardTitle>Student Registry</CardTitle>
            <CardDescription>
              Search and inspect existing students before running allocation.
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative w-full md:max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by ID, name, category, course"
                className="h-10 pl-9"
              />
            </div>
            <Button onClick={openRegisterDialog}>
              <Plus className="size-4" />
              Register Student
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {pageLoading ? (
            <div className="space-y-3">
              {Array.from({ length: PAGE_LIMIT }).map((_, i) => (
                <Skeleton key={i} className="h-[72px] w-full rounded-2xl" />
              ))}
            </div>
          ) : totalRecords === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-10 text-center">
              <p className="text-sm font-medium text-foreground">
                No students found.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Adjust the search or register a new student entry.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {displayStudents.map((student) => {
                const isSelected = student.student_id === selectedStudentId
                const isAllocated = student.allocation_status === "allocated"

                return (
                  <div
                    key={student.student_id}
                    className={[
                      "flex w-full items-center justify-between rounded-2xl border p-4 transition-colors",
                      isAllocated
                        ? "border-green-200 bg-green-50 opacity-70 dark:border-green-900 dark:bg-green-950/20"
                        : isSelected
                          ? "border-primary/30 bg-primary/5"
                          : "border-border/70 bg-card",
                    ].join(" ")}
                  >
                    <div className="flex flex-1 flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-foreground">
                          {student.student_name}
                        </p>
                        <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                          {student.category}
                        </span>
                        {isAllocated ? (
                          <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-[11px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            Allocated
                          </span>
                        ) : student.allocation_status === "unallocated" ? (
                          <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                            Unallocated
                          </span>
                        ) : null}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {student.student_id} • Applied on{" "}
                        {formatDate(student.application_date)}
                      </p>
                      {isAllocated ? (
                        <p className="text-sm text-muted-foreground">
                          Allocated Course:{" "}
                          {student.allocated_course_name ?? "—"}
                          {student.allocated_preference ? (
                            <span>
                              {" "}
                              ({formatAllocatedPreference(
                                student.allocated_preference
                              )})
                            </span>
                          ) : null}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Preferences: {student.preferences.join(" → ")}
                        </p>
                      )}
                    </div>
                    <div className="ml-4 flex items-center gap-1">
                      <span className="mr-2 rounded-xl bg-muted px-3 py-2 text-sm font-semibold text-foreground">
                        {student.marks}%
                      </span>
                      <TooltipButton
                        variant="ghost"
                        size="icon"
                        onClick={() => openViewDrawer(student)}
                        tooltip="View details"
                      >
                        <Eye className="size-4" />
                      </TooltipButton>
                      <TooltipButton
                        variant="ghost"
                        size="icon"
                        disabled={isAllocated}
                        onClick={() => openEditDialog(student)}
                        tooltip="Edit student"
                      >
                        <PencilLine className="size-4" />
                      </TooltipButton>
                      <TooltipButton
                        variant="ghost"
                        size="icon"
                        disabled={isAllocated}
                        onClick={() => setDeleteTarget(student.student_id)}
                        tooltip="Delete student"
                      >
                        <Trash2 className="size-4" />
                      </TooltipButton>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="mt-4">
            <Pagination
              pagination={{
                count: PAGE_LIMIT,
                current_page: page,
                total_page_count: totalPages,
                total_record_count: totalRecords,
              }}
              onPageChange={setPage}
            />
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeDialog()
            return
          }
          setDialogOpen(true)
        }}
      >
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingStudentId ? "Update Student" : "Register Student"}
            </DialogTitle>
            <DialogDescription>
              Capture student identity, merit data, reservation category, and
              ordered course preferences.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel label="Student ID" required />
                <Input
                  value={formState.studentId}
                  onChange={(event) =>
                    handleInputChange("studentId", event.target.value)
                  }
                  placeholder="e.g. STU-1003"
                  className={dialogInputClassName}
                />
                <FieldMessage message={formErrors.studentId} />
              </div>

              <div className="space-y-2">
                <FieldLabel label="Student Name" required />
                <Input
                  value={formState.studentName}
                  onChange={(event) =>
                    handleInputChange("studentName", event.target.value)
                  }
                  placeholder="Enter full name"
                  className={dialogInputClassName}
                />
                <FieldMessage message={formErrors.studentName} />
              </div>

              <div className="space-y-2">
                <FieldLabel label="Marks" required />
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={formState.marks}
                  onChange={(event) =>
                    handleInputChange("marks", event.target.value)
                  }
                  placeholder="Enter marks"
                  className={dialogInputClassName}
                />
                <FieldMessage message={formErrors.marks} />
              </div>

              <div className="space-y-2">
                <FieldLabel label="Category" required />
                <select
                  value={formState.category}
                  onChange={(event) =>
                    handleInputChange(
                      "category",
                      event.target.value as StudentCategory
                    )
                  }
                  className={dialogSelectClassName}
                >
                  {studentCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <FieldLabel label="Application Date" required />
                <Input
                  type="date"
                  value={formState.applicationDate}
                  onChange={(event) =>
                    handleInputChange("applicationDate", event.target.value)
                  }
                  className={dialogInputClassName}
                />
                <FieldMessage message={formErrors.applicationDate} />
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Course Preferences
                </p>
                <p className="text-sm text-muted-foreground">
                  Preserve preference order exactly so allocation can evaluate
                  course choices from first to third.
                </p>
              </div>

              <div className="grid gap-3">
                {(["preference1", "preference2", "preference3"] as const).map(
                  (fieldName, index) => (
                    <div key={fieldName} className="space-y-2">
                      <FieldLabel label={`Preference ${index + 1}`} required />
                      <select
                        value={formState[fieldName]}
                        onChange={(event) =>
                          handleInputChange(fieldName, event.target.value)
                        }
                        className={dialogSelectClassName}
                      >
                        <option value="">Select a course</option>
                        {availableCourses.map((course) => (
                          <option key={course} value={course}>
                            {course}
                          </option>
                        ))}
                      </select>
                      <FieldMessage message={formErrors[fieldName]} />
                    </div>
                  )
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : editingStudentId ? (
                  <Save className="size-4" />
                ) : (
                  <Plus className="size-4" />
                )}
                {saving
                  ? "Saving..."
                  : editingStudentId
                    ? "Save Changes"
                    : "Register Student"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={closeDialog}
              >
                <UserRound className="size-4" />
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Student Details</DrawerTitle>
            <DrawerDescription>
              Verified student information for consistent downstream allocation
              and analytics.
            </DrawerDescription>
          </DrawerHeader>
          {drawerLoading ? (
            <div className="p-4 pt-0">
              <div className="grid gap-4 md:grid-cols-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-[73px] rounded-xl" />
                ))}
              </div>
            </div>
          ) : viewingStudent ? (
            <div className="p-4 pt-0">
              <div className="grid gap-4 md:grid-cols-2">
                <DetailField
                  label="Student ID"
                  value={viewingStudent.student_id}
                />
                <DetailField
                  label="Student Name"
                  value={viewingStudent.student_name}
                />
                <DetailField
                  label="Marks"
                  value={String(viewingStudent.marks)}
                />
                <DetailField label="Category" value={viewingStudent.category} />
                <DetailField
                  label="Application Date"
                  value={formatDate(viewingStudent.application_date)}
                />
                <DetailField
                  label="Allocated Course"
                  value={viewingStudent.allocated_course_name ?? "—"}
                />
                <DetailField
                  label="Allocated Preference"
                  value={formatAllocatedPreference(
                    viewingStudent.allocated_preference
                  )}
                />
                {viewingStudent.allocation_status ? (
                  <DetailField
                    label="Allocation Status"
                    value={
                      viewingStudent.allocation_status.charAt(0).toUpperCase() +
                      viewingStudent.allocation_status.slice(1)
                    }
                    className={
                      viewingStudent.allocation_status === "allocated"
                        ? "font-medium text-green-600"
                        : viewingStudent.allocation_status === "unallocated"
                          ? "text-red-600 dark:text-red-400"
                          : ""
                    }
                  />
                ) : null}
              </div>
              <div className="mt-6">
                <h4 className="mb-3 text-sm font-semibold text-foreground">
                  Course Preferences
                </h4>
                <div className="grid gap-4 md:grid-cols-3">
                  {viewingStudent.preferences.map((pref, idx) => (
                    <div
                      key={idx}
                      className="flex flex-col gap-1 rounded-xl border border-border/70 bg-background px-4 py-3"
                    >
                      <p className="text-xs tracking-wide text-muted-foreground uppercase">
                        Preference {idx + 1}
                      </p>
                      <p className="font-medium text-foreground">
                        {pref || "—"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </DrawerContent>
      </Drawer>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Student</AlertDialogTitle>

            <AlertDialogDescription>
              This action cannot be undone. The student will be permanently
              removed from the active list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={confirmDeleteStudent}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
