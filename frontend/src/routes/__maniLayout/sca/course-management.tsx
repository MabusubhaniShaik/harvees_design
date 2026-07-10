import * as React from "react"
import { createFileRoute } from "@tanstack/react-router"
import { BookOpenCheck, Eye, Loader2, PencilLine, Plus, Save, Search, Trash2, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  fetchCourses,
  fetchCoursesPaginated,
  fetchCourse,
  createCourse,
  updateCourse,
  deleteCourse,
  type CourseRecord,
} from "@/lib/services/courses"
import { Pagination } from "@/components/ui/pagination"
import { DEFAULT_PAGE_LIMIT } from "@/config/app-settings"

type CourseFormState = {
  courseName: string
  totalSeats: string
  generalSeats: string
  obcSeats: string
  scSeats: string
  stSeats: string
  generalCutoff: string
  obcCutoff: string
  scCutoff: string
  stCutoff: string
}

type CourseFormErrors = Partial<Record<keyof CourseFormState, string>>

const emptyFormState: CourseFormState = {
  courseName: "",
  totalSeats: "",
  generalSeats: "",
  obcSeats: "",
  scSeats: "",
  stSeats: "",
  generalCutoff: "",
  obcCutoff: "",
  scCutoff: "",
  stCutoff: "",
}

function toFormState(course?: CourseRecord): CourseFormState {
  if (!course) {
    return emptyFormState
  }

  return {
    courseName: course.course_name,
    totalSeats: String(course.total_seats),
    generalSeats: String(course.reserved_seats.general),
    obcSeats: String(course.reserved_seats.obc),
    scSeats: String(course.reserved_seats.sc),
    stSeats: String(course.reserved_seats.st),
    generalCutoff: String(course.cutoffs?.general ?? 0),
    obcCutoff: String(course.cutoffs?.obc ?? 0),
    scCutoff: String(course.cutoffs?.sc ?? 0),
    stCutoff: String(course.cutoffs?.st ?? 0),
  }
}

function parseSeatValue(value: string) {
  return Number(value)
}

function validateCourseForm(
  form: CourseFormState,
  courses: readonly CourseRecord[],
  editingCourseName: string | null,
): CourseFormErrors {
  const errors: CourseFormErrors = {}
  const normalizedCourseName = form.courseName.trim()
  const totalSeats = parseSeatValue(form.totalSeats)
  const seatValues = {
    generalSeats: parseSeatValue(form.generalSeats),
    obcSeats: parseSeatValue(form.obcSeats),
    scSeats: parseSeatValue(form.scSeats),
    stSeats: parseSeatValue(form.stSeats),
  }
  const cutoffFields = [
    "generalCutoff",
    "obcCutoff",
    "scCutoff",
    "stCutoff",
  ] as const

  if (!normalizedCourseName) {
    errors.courseName = "Course name is required."
  } else {
    const duplicateCourse = courses.find(
      (course) =>
        course.course_name.toLowerCase() === normalizedCourseName.toLowerCase() &&
        course.course_name !== editingCourseName,
    )

    if (duplicateCourse) {
      errors.courseName = "Course name must be unique."
    }
  }

  if (!form.totalSeats.trim()) {
    errors.totalSeats = "Total seats are required."
  } else if (!Number.isInteger(totalSeats) || totalSeats <= 0) {
    errors.totalSeats = "Total seats must be a positive whole number."
  }

  ;(
    ["generalSeats", "obcSeats", "scSeats", "stSeats"] as const
  ).forEach((fieldName) => {
    const value = seatValues[fieldName]
    if (!form[fieldName].trim()) {
      errors[fieldName] = "Seat count is required."
    } else if (!Number.isInteger(value) || value < 0) {
      errors[fieldName] = "Seat count must be zero or greater."
    }
  })

  cutoffFields.forEach((fieldName) => {
    const value = Number(form[fieldName])
    if (!form[fieldName].trim()) {
      errors[fieldName] = "Cutoff is required."
    } else if (!Number.isFinite(value) || value < 0 || value > 100) {
      errors[fieldName] = "Cutoff must be between 0 and 100."
    }
  })

  const totalReservedSeats =
    seatValues.generalSeats +
    seatValues.obcSeats +
    seatValues.scSeats +
    seatValues.stSeats

  if (
    Number.isInteger(totalSeats) &&
    totalSeats > 0 &&
    Object.values(seatValues).every((value) => Number.isInteger(value) && value >= 0) &&
    totalReservedSeats !== totalSeats
  ) {
    errors.totalSeats =
      "Total seats must exactly match the combined category seat allocation."
  }

  return errors
}

function buildCourseRecord(form: CourseFormState): Omit<CourseRecord, "_id"> {
  return {
    course_name: form.courseName.trim(),
    total_seats: Number(form.totalSeats),
    reserved_seats: {
      general: Number(form.generalSeats),
      obc: Number(form.obcSeats),
      sc: Number(form.scSeats),
      st: Number(form.stSeats),
    },
    cutoffs: {
      general: Number(form.generalCutoff),
      obc: Number(form.obcCutoff),
      sc: Number(form.scCutoff),
      st: Number(form.stCutoff),
    },
  }
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
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={["mt-1 font-medium text-foreground", className].filter(Boolean).join(" ")}>
        {value}
      </p>
    </div>
  )
}

export const Route = createFileRoute("/__maniLayout/sca/course-management")({
  component: RouteComponent,
})

function RouteComponent() {
  const [courses, setCourses] = React.useState<CourseRecord[]>([])
  const [displayCourses, setDisplayCourses] = React.useState<CourseRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [pageLoading, setPageLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [formState, setFormState] = React.useState<CourseFormState>(emptyFormState)
  const [formErrors, setFormErrors] = React.useState<CourseFormErrors>({})
  const [editingCourseName, setEditingCourseName] = React.useState<string | null>(
    null,
  )
  const [selectedCourseName, setSelectedCourseName] = React.useState<string | null>(
    null,
  )
  const [searchTerm, setSearchTerm] = React.useState("")
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const [drawerLoading, setDrawerLoading] = React.useState(false)
  const [viewingCourse, setViewingCourse] = React.useState<CourseRecord | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<string | null>(null)
  const [page, setPage] = React.useState(1)
  const [totalPages, setTotalPages] = React.useState(1)
  const [totalRecords, setTotalRecords] = React.useState(0)
  const PAGE_LIMIT = DEFAULT_PAGE_LIMIT

  const loadCoursesForValidation = React.useCallback(async () => {
    const allCourses = await fetchCourses()
    setCourses(allCourses)
    return allCourses
  }, [])

  const loadCoursePage = React.useCallback(async () => {
    const search = searchTerm.trim() || undefined
    const paginated = await fetchCoursesPaginated(page, PAGE_LIMIT, search)
    setDisplayCourses(paginated.data)
    setTotalPages(paginated.pagination.total_page_count)
    setTotalRecords(paginated.pagination.total_record_count)
  }, [page, searchTerm, PAGE_LIMIT])

  React.useEffect(() => {
    loadCoursesForValidation()
      .catch((err) => console.error("Failed to load courses for validation:", err))
  }, [loadCoursesForValidation])

  React.useEffect(() => {
    if (displayCourses.length > 0) {
      setSelectedCourseName((current) => {
        if (!current || !displayCourses.find((c) => c.course_name === current)) {
          return displayCourses[0].course_name
        }
        return current
      })
    }
  }, [displayCourses])

  React.useEffect(() => {
    setPageLoading(true)
    loadCoursePage()
      .catch((err) => {
        console.error("Failed to load courses:", err)
      })
      .finally(() => {
        setPageLoading(false)
        setLoading(false)
      })
  }, [loadCoursePage])

  const totalCourses = courses.length
  const totalSeats = courses.reduce((sum, course) => sum + course.total_seats, 0)
  const averageSeats =
    totalCourses === 0 ? "0" : (totalSeats / totalCourses).toFixed(0)

  function handleInputChange(field: keyof CourseFormState, value: string) {
    setFormState((current) => ({
      ...current,
      [field]: value,
    }))

    setFormErrors((current) => ({
      ...current,
      [field]: undefined,
    }))
  }

  function resetForm() {
    setFormState(emptyFormState)
    setFormErrors({})
    setEditingCourseName(null)
  }

  function openCreateDialog() {
    resetForm()
    setDialogOpen(true)
  }

  function openEditDialog(course: CourseRecord) {
    setEditingCourseName(course.course_name)
    setSelectedCourseName(course.course_name)
    setFormState(toFormState(course))
    setFormErrors({})
    setDialogOpen(true)
  }

  function openViewDrawer(course: CourseRecord) {
    setViewingCourse(null)
    setDrawerOpen(true)
    setDrawerLoading(true)

    fetchCourse(course.course_name)
      .then((data) => setViewingCourse(data))
      .catch((err) => console.error("Failed to load course:", err))
      .finally(() => setDrawerLoading(false))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const errors = validateCourseForm(formState, courses, editingCourseName)
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    setSaving(true)
    try {
      const nextCourse = buildCourseRecord(formState)

      if (editingCourseName) {
        await updateCourse(editingCourseName, nextCourse)
      } else {
        const created = await createCourse(nextCourse)
        setSelectedCourseName(created.course_name)
        if (page !== 1) {
          setPage(1)
        }
      }

      await Promise.all([loadCoursesForValidation(), loadCoursePage()])
      resetForm()
      setDialogOpen(false)
    } catch (err) {
      console.error("Failed to save course:", err)
    } finally {
      setSaving(false)
    }
  }

  async function confirmDeleteCourse() {
    if (!deleteTarget) return

    try {
      await deleteCourse(deleteTarget)
      const remainingCourses = await loadCoursesForValidation()
      await loadCoursePage()

      if (selectedCourseName === deleteTarget) {
        setSelectedCourseName(remainingCourses[0]?.course_name ?? null)
      }

      if (editingCourseName === deleteTarget) {
        resetForm()
      }

      if (viewingCourse?.course_name === deleteTarget) {
        setDrawerOpen(false)
        setViewingCourse(null)
      }
    } catch (err) {
      console.error("Failed to delete course:", err)
    } finally {
      setDeleteTarget(null)
    }
  }

  const combinedReservedSeats =
    Number(formState.generalSeats || 0) +
    Number(formState.obcSeats || 0) +
    Number(formState.scSeats || 0) +
    Number(formState.stSeats || 0)

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
          <h1 className="text-2xl font-semibold tracking-tight">Course Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure course capacities and category-wise reservations.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/70 shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Configured Courses</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{totalCourses}</p>
            <p className="mt-1 text-xs text-muted-foreground">Courses ready for allocation planning</p>
          </CardContent>
        </Card>
        <Card className="border-border/70 shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Total Seat Capacity</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{totalSeats}</p>
            <p className="mt-1 text-xs text-muted-foreground">Combined seats across all configured courses</p>
          </CardContent>
        </Card>
        <Card className="border-border/70 shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Average Seats per Course</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{averageSeats}</p>
            <p className="mt-1 text-xs text-muted-foreground">Helps keep seat distribution balanced</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <CardTitle>Course Registry</CardTitle>
            <CardDescription>
              Review current course setup before editing seats and reservations.
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative w-full md:max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search course name"
                className="h-10 pl-9"
              />
            </div>
            <Button onClick={openCreateDialog}>
              <Plus className="size-4" />
              Create Course
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {pageLoading ? (
            <div className="space-y-3">
              {Array.from({ length: PAGE_LIMIT }).map((_, i) => (
                <Skeleton key={i} className="h-[72px] w-full rounded-2xl" />
              ))}
            </div>
          ) : totalRecords === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-10 text-center">
              <p className="text-sm font-medium text-foreground">
                No courses found.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Adjust the search or create a new course configuration.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {displayCourses.map((course) => {
                const isSelected = course.course_name === selectedCourseName
                const reservedTotal =
                  course.reserved_seats.general +
                  course.reserved_seats.obc +
                  course.reserved_seats.sc +
                  course.reserved_seats.st

                return (
                  <div
                    key={course.course_name}
                    className={[
                      "flex w-full items-center justify-between rounded-2xl border p-4 transition-colors",
                      isSelected
                        ? "border-primary/30 bg-primary/5"
                        : "border-border/70 bg-card hover:bg-muted/40",
                    ].join(" ")}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedCourseName(course.course_name)}
                      className="flex flex-1 flex-col gap-1 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-foreground">
                          {course.course_name}
                        </p>
                        <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                          {course.total_seats} total seats
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Reserved distribution: General {course.reserved_seats.general} •
                        OBC {course.reserved_seats.obc} • SC {course.reserved_seats.sc} •
                        ST {course.reserved_seats.st}
                      </p>
                    </button>
                    <div className="ml-4 flex items-center gap-1">
                      <span className="mr-2 rounded-xl bg-muted px-3 py-2 text-sm font-semibold text-foreground">
                        {reservedTotal}/{course.total_seats}
                      </span>
                      <TooltipButton
                        variant="ghost"
                        size="icon"
                        onClick={() => openViewDrawer(course)}
                        tooltip="View details"
                      >
                        <Eye className="size-4" />
                      </TooltipButton>
                      <TooltipButton
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(course)}
                        tooltip="Edit course"
                      >
                        <PencilLine className="size-4" />
                      </TooltipButton>
                      <TooltipButton
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteTarget(course.course_name)}
                        tooltip="Delete course"
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
              pagination={{ count: PAGE_LIMIT, current_page: page, total_page_count: totalPages, total_record_count: totalRecords }}
              onPageChange={setPage}
            />
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            resetForm()
            setDialogOpen(false)
            return
          }
          setDialogOpen(true)
        }}
      >
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingCourseName ? "Update Course" : "Create Course"}
            </DialogTitle>
            <DialogDescription>
              Define total capacity and exact category-wise reservation counts.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel label="Course Name" required />
                <Input
                  value={formState.courseName}
                  onChange={(event) =>
                    handleInputChange("courseName", event.target.value)
                  }
                  placeholder="Enter course name"
                  className={dialogInputClassName}
                />
                <FieldMessage message={formErrors.courseName} />
              </div>

              <div className="space-y-2">
                <FieldLabel label="Total Seats" required />
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={formState.totalSeats}
                  onChange={(event) =>
                    handleInputChange("totalSeats", event.target.value)
                  }
                  placeholder="Enter total seat capacity"
                  className={dialogInputClassName}
                />
                <FieldMessage message={formErrors.totalSeats} />
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Reserved Seats by Category
                </p>
                <p className="text-sm text-muted-foreground">
                  The sum of category seat allocations must equal the total seat
                  capacity for consistent allocation logic.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {[
                  ["generalSeats", "General Seats"],
                  ["obcSeats", "OBC Seats"],
                  ["scSeats", "SC Seats"],
                  ["stSeats", "ST Seats"],
                ].map(([fieldName, label]) => {
                  const typedFieldName = fieldName as keyof CourseFormState

                  return (
                    <div key={fieldName} className="space-y-2">
                      <FieldLabel label={label} required />
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={formState[typedFieldName]}
                        onChange={(event) =>
                          handleInputChange(typedFieldName, event.target.value)
                        }
                        placeholder={`Enter ${label.toLowerCase()}`}
                        className={dialogInputClassName}
                      />
                      <FieldMessage message={formErrors[typedFieldName]} />
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Category Cutoffs
                </p>
                <p className="text-sm text-muted-foreground">
                  Minimum marks required for open merit and each reserved category.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {[
                  ["generalCutoff", "General Cutoff"],
                  ["obcCutoff", "OBC Cutoff"],
                  ["scCutoff", "SC Cutoff"],
                  ["stCutoff", "ST Cutoff"],
                ].map(([fieldName, label]) => {
                  const typedFieldName = fieldName as keyof CourseFormState

                  return (
                    <div key={fieldName} className="space-y-2">
                      <FieldLabel label={label} required />
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={formState[typedFieldName]}
                        onChange={(event) =>
                          handleInputChange(typedFieldName, event.target.value)
                        }
                        placeholder={`Enter ${label.toLowerCase()}`}
                        className={dialogInputClassName}
                      />
                      <FieldMessage message={formErrors[typedFieldName]} />
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="rounded-xl border border-border/70 bg-muted/30 px-3.5 py-3.5">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-background shadow-sm">
                  <BookOpenCheck className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Reservation Validation
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Reserved seats total: {combinedReservedSeats || 0} /{" "}
                    {formState.totalSeats || 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : editingCourseName ? (
                  <Save className="size-4" />
                ) : (
                  <Plus className="size-4" />
                )}
                {saving
                  ? "Saving..."
                  : editingCourseName
                    ? "Save Changes"
                    : "Create Course"}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={resetForm}>
                <X className="size-4" />
                Reset Form
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Course Details</DrawerTitle>
            <DrawerDescription>
              Reservation-ready course data for accurate seat availability
              checks during allocation.
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
          ) : viewingCourse ? (
            <div className="p-4 pt-0">
              <div className="grid gap-4 md:grid-cols-2">
                <DetailField label="Course Name" value={viewingCourse.course_name} />
                <DetailField label="Total Seats" value={String(viewingCourse.total_seats)} />
                <DetailField label="General Seats" value={String(viewingCourse.reserved_seats.general)} />
                <DetailField label="OBC Seats" value={String(viewingCourse.reserved_seats.obc)} />
                <DetailField label="SC Seats" value={String(viewingCourse.reserved_seats.sc)} />
                <DetailField label="ST Seats" value={String(viewingCourse.reserved_seats.st)} />
                <DetailField label="General Cutoff" value={String(viewingCourse.cutoffs?.general ?? 0)} />
                <DetailField label="OBC Cutoff" value={String(viewingCourse.cutoffs?.obc ?? 0)} />
                <DetailField label="SC Cutoff" value={String(viewingCourse.cutoffs?.sc ?? 0)} />
                <DetailField label="ST Cutoff" value={String(viewingCourse.cutoffs?.st ?? 0)} />
              </div>
            </div>
          ) : null}
        </DrawerContent>
      </Drawer>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Course</AlertDialogTitle>

            <AlertDialogDescription>
              This action cannot be undone. The course will be permanently removed
              from the active list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDeleteCourse}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
