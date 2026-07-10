import * as React from "react"
import { createFileRoute } from "@tanstack/react-router"
import { ChevronDown, Eye, Loader2, Play, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { DataTable } from "@/components/ui/data-table"
import { TooltipButton } from "@/components/ui/tooltip-button"
import { Pagination } from "@/components/ui/pagination"
import { DEFAULT_PAGE_LIMIT } from "@/config/app-settings"
import {
  fetchLatestAllocation,
  runAllocation,
  type AllocationRunRecord,
} from "@/lib/services/allocations"
import { fetchStudents } from "@/lib/services/students"
import { fetchCourses, type CourseRecord } from "@/lib/services/courses"

type StudentCategory = "General" | "OBC" | "SC" | "ST"

type AllocationRecord = {
  studentId: string
  studentName: string
  category: StudentCategory
  marks: number
  allocatedCourse: string | null
  allocatedPreference: 1 | 2 | 3 | null
  allocationReason: string
}

type AllocationSummary = {
  allocations: AllocationRecord[]
  remainingSeatsByCourse: Record<string, Record<StudentCategory, number>>
  generatedAt: string
}

type ReservationTableRow = {
  courseName: string
  totalSeats: number
  reservedSeats: Record<string, number>
  cutoffs: Record<string, number>
  averageCutoffMark: number
  minimumCutoffMark: number
}

function formatCategoryLabel(categoryKey: string) {
  return categoryKey.toUpperCase()
}

function SummaryCard({
  label,
  value,
  helper,
}: {
  label: string
  value: string
  helper: string
}) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
      </CardContent>
    </Card>
  )
}

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

function transformAllocationResult(
  run: AllocationRunRecord,
): AllocationSummary {
  const remainingSeatsByCourse: Record<string, Record<StudentCategory, number>> =
    {}

  for (const course of run.remaining_seats_by_course) {
    remainingSeatsByCourse[course.course_name] = {
      General: course.remaining_seats.general,
      OBC: course.remaining_seats.obc,
      SC: course.remaining_seats.sc,
      ST: course.remaining_seats.st,
    }
  }

  return {
    allocations: run.allocations.map((a) => ({
      studentId: a.student_id,
      studentName: a.student_name,
      category: a.category as StudentCategory,
      marks: a.marks,
      allocatedCourse: a.allocated_course,
      allocatedPreference: a.allocated_preference,
      allocationReason: a.allocation_reason,
    })),
    remainingSeatsByCourse,
    generatedAt: run.generated_at,
  }
}

export const Route = createFileRoute(
  "/__maniLayout/sca/allocation-processing",
)({
  component: RouteComponent,
})

function RouteComponent() {
  const [allocationSummary, setAllocationSummary] =
    React.useState<AllocationSummary | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [pendingStudentCount, setPendingStudentCount] = React.useState(0)
  const [courseCount, setCourseCount] = React.useState(0)
  const [courses, setCourses] = React.useState<CourseRecord[]>([])
  const [initialLoading, setInitialLoading] = React.useState(true)
  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const [viewingAllocation, setViewingAllocation] =
    React.useState<AllocationRecord | null>(null)
  const [page, setPage] = React.useState(1)
  const [reservationTableOpen, setReservationTableOpen] = React.useState(true)
  const PAGE_LIMIT = DEFAULT_PAGE_LIMIT

  const totalPages = allocationSummary
    ? Math.ceil(allocationSummary.allocations.length / PAGE_LIMIT)
    : 1

  const paginatedAllocations = allocationSummary
    ? allocationSummary.allocations.slice(
        (page - 1) * PAGE_LIMIT,
        page * PAGE_LIMIT,
      )
    : []

  const loadPageData = React.useCallback(async () => {
    const [students, courses, latestAllocation] = await Promise.all([
      fetchStudents(),
      fetchCourses(),
      fetchLatestAllocation(),
    ])
    setPendingStudentCount(
      students.filter((student) => (student.allocation_status ?? "pending") === "pending").length,
    )
    setCourses(courses)
    setCourseCount(courses.length)
    setAllocationSummary(
      latestAllocation ? transformAllocationResult(latestAllocation) : null,
    )
  }, [])

  React.useEffect(() => {
    loadPageData()
      .catch((err) => {
        console.error("Failed to load data counts:", err)
      })
      .finally(() => setInitialLoading(false))
  }, [loadPageData])

  const allocatedStudentsCount =
    allocationSummary?.allocations.filter(
      (allocation) => allocation.allocatedCourse !== null,
    ).length ?? 0

  const unallocatedStudentsCount =
    allocationSummary?.allocations.filter(
      (allocation) => allocation.allocatedCourse === null,
    ).length ?? 0

  const firstPreferenceAllocations =
    allocationSummary?.allocations.filter(
      (allocation) => allocation.allocatedPreference === 1,
    ).length ?? 0

  const reservationCategories = React.useMemo(() => {
    const keys = new Set<string>()

    for (const course of courses) {
      Object.keys(course.reserved_seats ?? {}).forEach((key) => keys.add(key))
      Object.keys(course.cutoffs ?? {}).forEach((key) => keys.add(key))
    }

    return Array.from(keys)
  }, [courses])

  const reservationTableRows: ReservationTableRow[] = React.useMemo(
    () =>
      courses.map((course) => {
        const reservedSeats = Object.fromEntries(
          reservationCategories.map((categoryKey) => [
            categoryKey,
            course.reserved_seats[
              categoryKey as keyof CourseRecord["reserved_seats"]
            ] ?? 0,
          ]),
        )
        const cutoffs = Object.fromEntries(
          reservationCategories.map((categoryKey) => [
            categoryKey,
            course.cutoffs[categoryKey as keyof CourseRecord["cutoffs"]] ?? 0,
          ]),
        )
        const cutoffValues = Object.values(cutoffs)

        return {
          courseName: course.course_name,
          totalSeats: course.total_seats,
          reservedSeats,
          cutoffs,
          averageCutoffMark:
            cutoffValues.length > 0
              ? cutoffValues.reduce((sum, value) => sum + value, 0) /
                cutoffValues.length
              : 0,
          minimumCutoffMark:
            cutoffValues.length > 0 ? Math.min(...cutoffValues) : 0,
        }
      }),
    [courses, reservationCategories],
  )

  async function handleRunAllocation() {
    setLoading(true)
    try {
      const result = await runAllocation()
      setAllocationSummary(transformAllocationResult(result))
      await loadPageData()
      setPage(1)
    } catch (err) {
      console.error("Allocation run failed:", err)
    } finally {
      setLoading(false)
    }
  }

  async function handleRefreshAllocation() {
    setLoading(true)
    try {
      await loadPageData()
      setPage(1)
    } catch (err) {
      console.error("Failed to refresh allocation results:", err)
    } finally {
      setLoading(false)
    }
  }

  function openViewDrawer(allocation: AllocationRecord) {
    setViewingAllocation(allocation)
    setDrawerOpen(true)
  }

  const preferenceLabel: Record<number, string> = {
    1: "1st Preference",
    2: "2nd Preference",
    3: "3rd Preference",
  }

  if (initialLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Allocation Processing</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Run the engine once per pending student set while preserving finalized allocations.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={handleRunAllocation}
            disabled={loading || pendingStudentCount === 0 || courseCount === 0}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Play className="size-4" />
            )}
            {loading ? "Running..." : "Run Allocation"}
          </Button>
          <Button
            variant="outline"
            onClick={handleRefreshAllocation}
            disabled={loading}
          >
            <RefreshCw className="size-4" />
            Refresh Results
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          label="Allocated Students"
          value={String(allocatedStudentsCount)}
          helper="Students who received one of their preferred courses"
        />
        <SummaryCard
          label="Unallocated Students"
          value={String(unallocatedStudentsCount)}
          helper="Students with no reserved seat left in their preferences"
        />
        <SummaryCard
          label="First Preference Wins"
          value={String(firstPreferenceAllocations)}
          helper="Students allocated on their first course preference"
        />
      </div>

      <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        {pendingStudentCount === 0
          ? "All students are already finalized. The allocation action is disabled to prevent duplicate allocations."
          : `${pendingStudentCount} pending student${pendingStudentCount === 1 ? "" : "s"} can still be processed without reallocating already-finalized students.`}
      </div>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="space-y-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Reservation, Seats & Cutoff Marks</CardTitle>
              <CardDescription>
                This table stays aligned with the course reservation data used by the allocation engine.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setReservationTableOpen((open) => !open)}
              className="shrink-0"
            >
              <ChevronDown
                className={[
                  "size-4 transition-transform",
                  reservationTableOpen ? "rotate-180" : "rotate-0",
                ].join(" ")}
              />
              {reservationTableOpen ? "Collapse" : "Expand"}
            </Button>
          </div>
        </CardHeader>
        {reservationTableOpen ? (
          <CardContent>
            <DataTable
              rows={reservationTableRows}
              rowKey={(row) => row.courseName}
              minWidth="1320px"
              columns={[
                {
                  id: "course",
                  header: "Course",
                  cell: (row) => (
                    <div>
                      <p className="font-medium text-foreground">{row.courseName}</p>
                      <p className="text-xs text-muted-foreground">
                        Total seats: {row.totalSeats}
                      </p>
                    </div>
                  ),
                },
                {
                  id: "average-cutoff",
                  header: "Average Mark",
                  cell: (row) => row.averageCutoffMark.toFixed(1),
                },
                {
                  id: "minimum-cutoff",
                  header: "Minimum Mark",
                  cell: (row) => row.minimumCutoffMark.toFixed(1),
                },
                ...reservationCategories.flatMap((categoryKey) => [
                  {
                    id: `${categoryKey}-seats`,
                    header: `${formatCategoryLabel(categoryKey)} Seats`,
                    cell: (row: ReservationTableRow) =>
                      `${row.reservedSeats[categoryKey] ?? 0}`,
                  },
                  {
                    id: `${categoryKey}-cutoff`,
                    header: `${formatCategoryLabel(categoryKey)} Cutoff`,
                    cell: (row: ReservationTableRow) =>
                      `${row.cutoffs[categoryKey] ?? 0}`,
                  },
                ]),
              ]}
            />
          </CardContent>
        ) : null}
      </Card>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="space-y-2">
          <CardTitle>Allocation Results</CardTitle>
          <CardDescription>
            Results feed dashboard modules such as allocated students,
            available seats, course statistics, and category summaries.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!allocationSummary ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-10 text-center">
              <p className="text-sm font-medium text-foreground">
                No stored allocation results yet.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Run the engine to allocate students and store the results in
                the database.
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                Stored allocation generated at{" "}
                {new Intl.DateTimeFormat("en-IN", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(allocationSummary.generatedAt))}
              </div>

              <div className="space-y-3">
                {paginatedAllocations.map((allocation) => (
                  <div
                    key={allocation.studentId}
                    className="flex w-full items-center justify-between rounded-2xl border border-border/70 bg-background p-4 transition-colors hover:bg-muted/30"
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-1 pr-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-foreground">
                          {allocation.studentName}
                        </p>
                        <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                          {allocation.studentId}
                        </span>
                        <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                          {allocation.category}
                        </span>
                        <span
                          className={[
                            "rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                            allocation.allocatedCourse
                              ? "bg-primary/10 text-primary"
                              : "bg-destructive/10 text-destructive",
                          ].join(" ")}
                        >
                          {allocation.allocatedCourse ? "Allocated" : "Unallocated"}
                        </span>
                      </div>
                      <p className="truncate text-sm text-muted-foreground">
                        Marks: {allocation.marks} •
                        {allocation.allocatedCourse
                          ? ` ${allocation.allocatedCourse}`
                          : " Not allocated"}
                        {allocation.allocatedPreference
                          ? ` (${preferenceLabel[allocation.allocatedPreference]})`
                          : ""}
                      </p>
                    </div>
                    <TooltipButton
                      variant="ghost"
                      size="icon"
                      onClick={() => openViewDrawer(allocation)}
                      tooltip="View allocation"
                    >
                      <Eye className="size-4" />
                    </TooltipButton>
                  </div>
                ))}
              </div>

              <Pagination
                pagination={{
                  count: PAGE_LIMIT,
                  current_page: page,
                  total_page_count: totalPages,
                  total_record_count: allocationSummary.allocations.length,
                }}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="space-y-2">
          <CardTitle>Remaining Seat Availability</CardTitle>
          <CardDescription>
            Category-wise remaining seats after the allocation run, ready for
            dashboards and reporting.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {allocationSummary
            ? Object.entries(allocationSummary.remainingSeatsByCourse).map(
                ([courseName, remainingSeats]) => {
                  const totalRemaining =
                    remainingSeats.General +
                    remainingSeats.OBC +
                    remainingSeats.SC +
                    remainingSeats.ST

                  return (
                    <div
                      key={courseName}
                      className="rounded-2xl border border-border/70 bg-background p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-foreground">
                            {courseName}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Remaining seats: {totalRemaining}
                          </p>
                        </div>
                        <span className="rounded-xl bg-muted px-3 py-2 text-sm font-medium text-foreground">
                          {totalRemaining}
                        </span>
                      </div>
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {(
                          ["General", "OBC", "SC", "ST"] as const
                        ).map((category) => (
                          <div
                            key={category}
                            className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2"
                          >
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">
                              {category}
                            </p>
                            <p className="mt-1 text-sm font-medium text-foreground">
                              {remainingSeats[category]}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                },
              )
            : null}
        </CardContent>
      </Card>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Allocation Details</DrawerTitle>
            <DrawerDescription>
              Full allocation breakdown for the selected student.
            </DrawerDescription>
          </DrawerHeader>
          {viewingAllocation ? (
            <div className="p-4 pt-0">
              <div className="mb-6 grid gap-4 md:grid-cols-2">
                <DetailField label="Student ID" value={viewingAllocation.studentId} />
                <DetailField label="Student Name" value={viewingAllocation.studentName} />
                <DetailField label="Category" value={viewingAllocation.category} />
                <DetailField label="Marks" value={String(viewingAllocation.marks)} />
              </div>
              <div className="mb-6 grid gap-4 md:grid-cols-2">
                <DetailField
                  label="Allocated Course"
                  value={viewingAllocation.allocatedCourse ?? "—"}
                  className={
                    viewingAllocation.allocatedCourse
                      ? "text-green-600 font-medium"
                      : "text-muted-foreground"
                  }
                />
                <DetailField
                  label="Preference Met"
                  value={
                    viewingAllocation.allocatedPreference
                      ? preferenceLabel[viewingAllocation.allocatedPreference]
                      : "—"
                  }
                />
              </div>
              <div className="rounded-xl border border-border/70 bg-background px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Allocation Reason
                </p>
                <p className="mt-1 text-sm leading-6 text-foreground">
                  {viewingAllocation.allocationReason}
                </p>
              </div>
            </div>
          ) : null}
        </DrawerContent>
      </Drawer>
    </div>
  )
}
