import * as React from "react"
import { createFileRoute } from "@tanstack/react-router"
import { Download, Loader2, Sparkles } from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { ChartCard, MetricCard } from "@/components/dashboard/dashboard-card"
import { Button } from "@/components/ui/button"
import { fetchAllocationRuns } from "@/lib/services/allocations"
import { fetchCourses } from "@/lib/services/courses"
import { fetchScaAiHistory } from "@/lib/services/sca-ai"
import { fetchStudents } from "@/lib/services/students"
import { downloadJson } from "@/lib/export-utils"

export const Route = createFileRoute("/__maniLayout/sca/home")({
  component: RouteComponent,
})

const COLORS = ["#111827", "#2563eb", "#059669", "#d97706", "#dc2626", "#7c3aed"]

function RouteComponent() {
  const [loading, setLoading] = React.useState(true)
  const [students, setStudents] = React.useState<Awaited<ReturnType<typeof fetchStudents>>>([])
  const [courses, setCourses] = React.useState<Awaited<ReturnType<typeof fetchCourses>>>([])
  const [runs, setRuns] = React.useState<Awaited<ReturnType<typeof fetchAllocationRuns>>>([])
  const [queryHistory, setQueryHistory] = React.useState<Awaited<ReturnType<typeof fetchScaAiHistory>>>([])

  React.useEffect(() => {
    Promise.all([fetchStudents(), fetchCourses(), fetchAllocationRuns(), fetchScaAiHistory()])
      .then(([studentData, courseData, runData, historyData]) => {
        setStudents(studentData)
        setCourses(courseData)
        setRuns(runData)
        setQueryHistory(historyData)
      })
      .catch((err) => console.error("Failed to load SCA dashboard:", err))
      .finally(() => setLoading(false))
  }, [])

  const latestRun = runs[0]
  const allocated = latestRun?.allocated_students ?? students.filter((s) => s.allocation_status === "allocated").length
  const unallocated = latestRun?.unallocated_students ?? students.filter((s) => s.allocation_status === "unallocated").length
  const totalSeats = courses.reduce((sum, course) => sum + course.total_seats, 0)
  const availableSeats =
    latestRun?.remaining_seats_by_course.reduce(
      (sum, course) =>
        sum +
        course.remaining_seats.general +
        course.remaining_seats.obc +
        course.remaining_seats.sc +
        course.remaining_seats.st,
      0,
    ) ?? 0
  const categoryData = ["General", "OBC", "SC", "ST"].map((category) => ({
    category,
    students: students.filter((student) => student.category === category).length,
  }))
  const courseSeatData = courses.map((course) => ({
    course: course.course_name,
    seats: course.total_seats,
  }))
  const courseStats =
    latestRun?.remaining_seats_by_course.map((course) => {
      const applicants = latestRun.allocations.filter((allocation) =>
        allocation.preferences.includes(course.course_name),
      ).length
      const allocatedCount = latestRun.allocations.filter(
        (allocation) => allocation.allocated_course === course.course_name,
      ).length

      return {
        course: course.course_name,
        applicants,
        allocated: allocatedCount,
        remaining:
          course.remaining_seats.general +
          course.remaining_seats.obc +
          course.remaining_seats.sc +
          course.remaining_seats.st,
      }
    }) ?? []
  const allocationData = [
    { label: "Allocated", value: allocated },
    { label: "Unallocated", value: unallocated },
  ]
  const dashboardData = { students, courses, latestRun, generatedAt: new Date().toISOString() }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="w-full min-w-0 max-w-full space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">SCA Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Allocation readiness, category mix, seat capacity, and latest allocation outcomes.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => downloadJson(dashboardData, "sca-dashboard.json")}>
          <Download className="size-4" />
          Export
        </Button>
      </div>

      <div className="grid min-w-0 gap-4 md:grid-cols-4">
        <MetricCard label="Students" value={students.length} helper="Active applications" />
        <MetricCard label="Courses" value={courses.length} helper="Configured programs" />
        <MetricCard label="Total Seats" value={totalSeats} helper="Available capacity" />
        <MetricCard label="Allocated" value={allocated} helper="Latest allocation run" />
      </div>

      <div className="grid min-w-0 gap-4 md:grid-cols-4">
        <MetricCard label="Available Seats" value={availableSeats} helper="Seats still open in latest run" />
        <MetricCard label="Unallocated" value={unallocated} helper="Students without a seat" />
        <MetricCard
          label="AI Queries"
          value={queryHistory.length}
          helper="Recent assistant requests"
        />
        <MetricCard
          label="Latest Run"
          value={latestRun ? "Ready" : "Pending"}
          helper="Allocation snapshot status"
        />
      </div>

      <div className="grid min-w-0 gap-6 xl:grid-cols-2">
        <ChartCard title="Category-wise Student Summary">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="students" fill="#111827" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Allocation Outcome">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={allocationData} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={100} label>
                  {allocationData.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <ChartCard title="Course Seat Capacity">
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={courseSeatData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="course" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="seats" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <div className="grid min-w-0 gap-6 xl:grid-cols-2">
        <ChartCard title="Available Seats by Course">
          <div className="space-y-3">
            {courseStats.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Run allocation to inspect course-wise remaining seats.
              </p>
            ) : (
              courseStats.map((entry) => (
                <div
                  key={entry.course}
                  className="flex items-center justify-between rounded-2xl border border-border/70 bg-muted/20 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{entry.course}</p>
                    <p className="text-xs text-muted-foreground">
                      Applicants {entry.applicants} • Allocated {entry.allocated}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-foreground">{entry.remaining}</p>
                    <p className="text-xs text-muted-foreground">remaining seats</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </ChartCard>

        <ChartCard title="Course Statistics">
          <div className="space-y-3">
            {courseStats.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Course statistics appear after the latest allocation run is generated.
              </p>
            ) : (
              courseStats.map((entry) => (
                <div
                  key={`${entry.course}-stats`}
                  className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3"
                >
                  <p className="text-sm font-medium text-foreground">{entry.course}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {entry.allocated} allocated from {entry.applicants} applicants.
                  </p>
                </div>
              ))
            )}
          </div>
        </ChartCard>
      </div>

      <ChartCard title="AI Query History">
        <div className="space-y-3">
          {queryHistory.length === 0 ? (
            <div className="flex min-h-[160px] items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/20 p-6 text-center">
              <div className="space-y-2">
                <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-muted">
                  <Sparkles className="size-4 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">No assistant queries yet</p>
                <p className="text-sm text-muted-foreground">
                  Recent AI assistant questions will appear here after you use the assistant.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {queryHistory.slice(0, 6).map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3"
                >
                  <p className="text-sm font-medium text-foreground">{entry.question}</p>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                    {entry.answer}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </ChartCard>
    </div>
  )
}
