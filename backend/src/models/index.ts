export {
  StudentModel,
  studentCategories,
  type IStudent,
  type ISeatAllocation,
  type StudentCategory,
  type StudentDocument,
} from "./student.model.ts";
export {
  CourseModel,
  type ICourse,
  type ICourseCutoffsByCategory,
  type ICourseSeatsByCategory,
  type CourseDocument,
} from "./course.model.ts";
export {
  AllocationRunModel,
  type AllocationPreference,
  type AllocationRunDocument,
  type AllocationStatus,
  type IAllocationResult,
  type IAllocationRun,
  type IRemainingCourseSeats,
  type IRemainingSeatsByCategory,
} from "./allocation-run.model.ts";
export {
  ScaAiHistoryModel,
  type IScaAiHistory,
  type ScaAiHistoryDocument,
  type ScaAiHistoryRole,
} from "./sca-ai-history.model.ts";
export {
  getAsaAiHistoryModel,
  type IAsaAiHistory,
  type AsaAiHistoryDocument,
  type AsaAiHistoryRole,
} from "./asa-ai-history.model.ts";
