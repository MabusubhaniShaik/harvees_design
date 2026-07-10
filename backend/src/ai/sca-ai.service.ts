import {
  AllocationRunModel,
  CourseModel,
  ScaAiHistoryModel,
  StudentModel,
} from "../models/index.js";
import { generateGeminiText, getGeminiConfig } from "./gemini-client.js";

type CategoryName = "General" | "OBC" | "SC" | "ST";

type LeanStudent = {
  student_id: string;
  student_name: string;
  category: CategoryName;
  marks: number;
  preferences: [string, string, string];
  allocated_course_name: string | null;
  allocated_preference: 1 | 2 | 3 | null;
};

type LeanCourse = {
  course_name: string;
  total_seats: number;
  reserved_seats: { general: number; obc: number; sc: number; st: number };
};

type LeanAllocationRun = {
  run_code: string;
  generated_at: Date;
  allocated_students: number;
  unallocated_students: number;
  first_preference_allocations: number;
  allocations: Array<{
    student_id: string;
    student_name: string;
    category: CategoryName;
    preferences: [string, string, string];
    allocated_course: string | null;
    allocated_preference: 1 | 2 | 3 | null;
    allocation_reason: string;
  }>;
  remaining_seats_by_course: Array<{
    course_name: string;
    remaining_seats: { general: number; obc: number; sc: number; st: number };
  }>;
};

type AiInsightSection = {
  title: string;
  rows: Record<string, unknown>[];
};

export type ScaAiHistoryEntry = {
  id: string;
  question: string;
  answer: string;
  runCode: string;
  generatedAt: Date;
  askedAt: Date;
};

export type ScaAiChatMessage = {
  id: string;
  exchangeId: string;
  role: "user" | "assistant";
  content: string;
  intent: string | null;
  runCode: string | null;
  generatedAt: Date | null;
  createdAt: Date;
};

type ScaAiIntent =
  | "allocations_by_course"
  | "first_preference_misses"
  | "highest_rejection_rate"
  | "category_summary"
  | "available_seats"
  | "overview";

const MAX_SAMPLE_ROWS = 20;
const MAX_HISTORY_ITEMS = 12;
const DEFAULT_SUGGESTIONS = [
  "How many students were allocated to each course?",
  "Which students did not receive their first preference?",
  "Which course had the highest rejection rate?",
  "Show category-wise allocation summary.",
];

const CATEGORY_NAMES: CategoryName[] = ["General", "OBC", "SC", "ST"];

const percent = (value: number, total: number) =>
  total > 0 ? Number(((value / total) * 100).toFixed(2)) : 0;

const createServiceError = (message: string, statusCode: number) =>
  Object.assign(new Error(message), { statusCode });

const buildCourseSummaries = (
  allocations: Array<{
    student_id: string;
    student_name: string;
    category: CategoryName;
    preferences: [string, string, string];
    allocated_course: string | null;
    allocated_preference: 1 | 2 | 3 | null;
  }>,
  courses: Array<{
    course_name: string;
    total_seats: number;
    reserved_seats: { general: number; obc: number; sc: number; st: number };
  }>,
  remainingSeatsByCourse: Map<string, { general: number; obc: number; sc: number; st: number }>
) => {
  return courses.map((course) => {
    const applicants = allocations.filter((allocation) =>
      allocation.preferences.includes(course.course_name)
    );
    const allocated = allocations.filter(
      (allocation) => allocation.allocated_course === course.course_name
    );
    const rejected = applicants.length - allocated.length;

    return {
      course: course.course_name,
      totalSeats: course.total_seats,
      applicants: applicants.length,
      allocated: allocated.length,
      rejected,
      rejectionRate: percent(rejected, applicants.length),
      firstPreferenceAllocations: allocations.filter(
        (allocation) =>
          allocation.preferences[0] === course.course_name &&
          allocation.allocated_course === course.course_name
      ).length,
      remainingSeats: remainingSeatsByCourse.get(course.course_name) || {
        general: 0,
        obc: 0,
        sc: 0,
        st: 0,
      },
    };
  });
};

const buildCategorySummaries = (
  allocations: Array<{
    category: CategoryName;
    allocated_course: string | null;
    allocated_preference: 1 | 2 | 3 | null;
  }>
) => {
  return CATEGORY_NAMES.map((category) => {
    const rows = allocations.filter((allocation) => allocation.category === category);
    const allocated = rows.filter((allocation) => allocation.allocated_course !== null).length;
    const firstPreference = rows.filter(
      (allocation) => allocation.allocated_preference === 1
    ).length;

    return {
      category,
      totalStudents: rows.length,
      allocatedStudents: allocated,
      unallocatedStudents: rows.length - allocated,
      firstPreferenceAllocations: firstPreference,
      allocationRate: percent(allocated, rows.length),
    };
  });
};

const resolveIntent = (question: string): ScaAiIntent => {
  const normalizedQuestion = question.toLowerCase();

  if (
    normalizedQuestion.includes("available seat") ||
    normalizedQuestion.includes("still have seat") ||
    normalizedQuestion.includes("remaining seat")
  ) {
    return "available_seats";
  }

  if (normalizedQuestion.includes("rejection rate")) {
    return "highest_rejection_rate";
  }

  if (
    normalizedQuestion.includes("first preference") ||
    normalizedQuestion.includes("did not receive")
  ) {
    return "first_preference_misses";
  }

  if (
    normalizedQuestion.includes("category") ||
    normalizedQuestion.includes("allocation summary")
  ) {
    return "category_summary";
  }

  if (
    normalizedQuestion.includes("each course") ||
    normalizedQuestion.includes("allocated to each") ||
    normalizedQuestion.includes("by course")
  ) {
    return "allocations_by_course";
  }

  return "overview";
};

const buildSections = (
  intent: ScaAiIntent,
  allocations: Array<{
    student_id: string;
    student_name: string;
    category: CategoryName;
    preferences: [string, string, string];
    allocated_course: string | null;
    allocated_preference: 1 | 2 | 3 | null;
    allocation_reason: string;
  }>,
  courseSummaries: ReturnType<typeof buildCourseSummaries>,
  categorySummaries: ReturnType<typeof buildCategorySummaries>
): AiInsightSection[] => {
  if (intent === "allocations_by_course") {
    return [
      {
        title: "Course allocation summary",
        rows: courseSummaries.map((row) => ({
          course: row.course,
          allocated: row.allocated,
          applicants: row.applicants,
          rejectionRate: row.rejectionRate,
        })),
      },
    ];
  }

  if (intent === "first_preference_misses") {
    return [
      {
        title: "Students who did not receive first preference",
        rows: allocations
          .filter((allocation) => allocation.allocated_preference !== 1)
          .slice(0, MAX_SAMPLE_ROWS)
          .map((allocation) => ({
            studentId: allocation.student_id,
            studentName: allocation.student_name,
            category: allocation.category,
            requestedFirstPreference: allocation.preferences[0],
            allocatedCourse: allocation.allocated_course,
            allocatedPreference: allocation.allocated_preference,
            reason: allocation.allocation_reason,
          })),
      },
      {
        title: "Category summary",
        rows: categorySummaries,
      },
    ];
  }

  if (intent === "highest_rejection_rate") {
    const sortedCourses = [...courseSummaries].sort(
      (left, right) => right.rejectionRate - left.rejectionRate
    );

    return [
      {
        title: "Course rejection summary",
        rows: sortedCourses.map((row) => ({
          course: row.course,
          applicants: row.applicants,
          rejected: row.rejected,
          allocated: row.allocated,
          rejectionRate: row.rejectionRate,
        })),
      },
    ];
  }

  if (intent === "category_summary") {
    return [
      {
        title: "Category-wise allocation summary",
        rows: categorySummaries,
      },
    ];
  }

  if (intent === "available_seats") {
    return [
      {
        title: "Courses with available seats",
        rows: courseSummaries
          .filter(
            (row) =>
              row.remainingSeats.general +
                row.remainingSeats.obc +
                row.remainingSeats.sc +
                row.remainingSeats.st >
              0
          )
          .map((row) => ({
            course: row.course,
            availableSeats:
              row.remainingSeats.general +
              row.remainingSeats.obc +
              row.remainingSeats.sc +
              row.remainingSeats.st,
            general: row.remainingSeats.general,
            obc: row.remainingSeats.obc,
            sc: row.remainingSeats.sc,
            st: row.remainingSeats.st,
          })),
      },
    ];
  }

  return [
    {
      title: "Overall allocation summary",
      rows: categorySummaries,
    },
    {
      title: "Course summary",
      rows: courseSummaries.slice(0, 10).map((row) => ({
        course: row.course,
        allocated: row.allocated,
        applicants: row.applicants,
        rejectionRate: row.rejectionRate,
      })),
    },
  ];
};

const buildPrompt = ({
  question,
  intent,
  metadata,
  sections,
}: {
  question: string;
  intent: ScaAiIntent;
  metadata: Record<string, unknown>;
  sections: AiInsightSection[];
}) => {
  return [
    "You are an AI assistant for a student course allocation system.",
    "Answer only from the supplied facts.",
    "Do not invent data or mention information that is not present.",
    "Keep the answer concise, businesslike, and easy to scan.",
    "If the question asks for a list, provide the list exactly from the facts.",
    "The backend has already mapped the user question to a predefined reporting intent.",
    "",
    `Question: ${question}`,
    `Intent: ${intent}`,
    "",
    `Metadata: ${JSON.stringify(metadata)}`,
    "",
    ...sections.flatMap((section) => [
      `${section.title}:`,
      JSON.stringify(section.rows),
      "",
    ]),
  ].join("\n");
};

export const getScaAiConfig = () => {
  const config = getGeminiConfig();

  return {
    ...config,
    suggestions: DEFAULT_SUGGESTIONS,
  };
};

export const getScaQueryHistory = async (): Promise<ScaAiHistoryEntry[]> => {
  const rows = await ScaAiHistoryModel.find({ is_active: true })
    .sort({ created_date: -1 })
    .lean()
    .exec();

  const exchangeMap = new Map<
    string,
    {
      question?: string;
      answer?: string;
      runCode?: string | null;
      generatedAt?: Date | null;
      askedAt?: Date;
      createdAt?: Date;
    }
  >();

  for (const row of rows as unknown as Array<{
    exchange_id: string;
    role: "user" | "assistant";
    content: string;
    run_code: string | null;
    allocation_generated_at: Date | null;
    created_date: Date;
  }>) {
    const current = exchangeMap.get(row.exchange_id) || {};

    if (row.role === "user") {
      current.question = row.content;
      current.askedAt = row.created_date;
    } else {
      current.answer = row.content;
      current.runCode = row.run_code;
      current.generatedAt = row.allocation_generated_at;
    }

    current.createdAt = current.createdAt || row.created_date;
    exchangeMap.set(row.exchange_id, current);
  }

  return Array.from(exchangeMap.entries())
    .map(([exchangeId, value]) => ({
      id: exchangeId,
      question: value.question || "",
      answer: value.answer || "",
      runCode: value.runCode || "",
      generatedAt: value.generatedAt || value.askedAt || new Date(),
      askedAt: value.askedAt || value.createdAt || new Date(),
    }))
    .filter((entry) => entry.question && entry.answer)
    .sort((left, right) => right.askedAt.getTime() - left.askedAt.getTime())
    .slice(0, MAX_HISTORY_ITEMS);
};

export const getScaChatHistory = async (): Promise<ScaAiChatMessage[]> => {
  const rows = await ScaAiHistoryModel.find({ is_active: true })
    .sort({ created_date: 1 })
    .limit(100)
    .lean()
    .exec();

  return (rows as unknown as Array<{
    _id: { toString(): string };
    exchange_id: string;
    role: "user" | "assistant";
    content: string;
    intent: string | null;
    run_code: string | null;
    allocation_generated_at: Date | null;
    created_date: Date;
  }>).map((row) => ({
    id: row._id.toString(),
    exchangeId: row.exchange_id,
    role: row.role,
    content: row.content,
    intent: row.intent,
    runCode: row.run_code,
    generatedAt: row.allocation_generated_at,
    createdAt: row.created_date,
  }));
};

export const answerScaQuestion = async (question: string) => {
  const trimmedQuestion = question.trim();

  if (!trimmedQuestion) {
    throw createServiceError("A question is required for the SCA assistant.", 400);
  }

  const [studentsResult, coursesResult, latestRunResult] = await Promise.all([
    StudentModel.find({ is_active: true })
      .select("student_id student_name category marks preferences allocated_course_name allocated_preference")
      .lean()
      .exec(),
    CourseModel.find({ is_active: true })
      .select("course_name total_seats reserved_seats")
      .lean()
      .exec(),
    AllocationRunModel.findOne({ is_active: true })
      .sort({ generated_at: -1 })
      .lean()
      .exec(),
  ]);

  const students = studentsResult as unknown as LeanStudent[];
  const courses = coursesResult as unknown as LeanCourse[];
  const latestRun = latestRunResult as unknown as LeanAllocationRun | null;

  if (!latestRun) {
    const intent = resolveIntent(trimmedQuestion);
    const answer =
      students.length === 0
        ? "No student data is available. Add students before running an allocation."
        : courses.length === 0
          ? "No course data is available. Add courses before running an allocation."
          : "No students have been allocated yet. Run an allocation to generate allocation reports.";
    const exchangeId = `${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    await ScaAiHistoryModel.insertMany([
      {
        exchange_id: exchangeId,
        role: "user",
        content: trimmedQuestion,
        intent,
        run_code: null,
        allocation_generated_at: null,
        sequence: 0,
        is_active: true,
      },
      {
        exchange_id: exchangeId,
        role: "assistant",
        content: answer,
        intent,
        run_code: null,
        allocation_generated_at: null,
        sequence: 1,
        is_active: true,
      },
    ]);

    return {
      answer,
      runCode: null,
      generatedAt: null,
      model: "system",
      intent,
      sections: [],
    };
  }

  const allocations = latestRun.allocations.map((allocation) => ({
    student_id: allocation.student_id,
    student_name: allocation.student_name,
    category: allocation.category,
    preferences: allocation.preferences,
    allocated_course: allocation.allocated_course,
    allocated_preference: allocation.allocated_preference,
    allocation_reason: allocation.allocation_reason,
  }));

  const remainingSeatsByCourse = new Map(
    latestRun.remaining_seats_by_course.map((entry) => [
      entry.course_name,
      entry.remaining_seats,
    ])
  );

  const courseSummaries = buildCourseSummaries(
    allocations,
    courses,
    remainingSeatsByCourse
  );
  const categorySummaries = buildCategorySummaries(allocations);
  const intent = resolveIntent(trimmedQuestion);
  const sections = buildSections(
    intent,
    allocations,
    courseSummaries,
    categorySummaries
  );

  const prompt = buildPrompt({
    question: trimmedQuestion,
    intent,
    metadata: {
      activeStudents: students.length,
      activeCourses: courses.length,
      runCode: latestRun.run_code,
      generatedAt: latestRun.generated_at,
      allocatedStudents: latestRun.allocated_students,
      unallocatedStudents: latestRun.unallocated_students,
      firstPreferenceAllocations: latestRun.first_preference_allocations,
    },
    sections,
  });

  const generation = await generateGeminiText(prompt);
  const exchangeId = `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  const result = {
    answer: generation.text,
    runCode: latestRun.run_code,
    generatedAt: latestRun.generated_at,
    model: generation.model,
    intent,
    sections,
  };

  await ScaAiHistoryModel.insertMany([
    {
      exchange_id: exchangeId,
      role: "user",
      content: trimmedQuestion,
      intent,
      run_code: latestRun.run_code,
      allocation_generated_at: latestRun.generated_at,
      sequence: 0,
      is_active: true,
    },
    {
      exchange_id: exchangeId,
      role: "assistant",
      content: generation.text,
      intent,
      run_code: latestRun.run_code,
      allocation_generated_at: latestRun.generated_at,
      sequence: 1,
      is_active: true,
    },
  ]);

  return result;
};
