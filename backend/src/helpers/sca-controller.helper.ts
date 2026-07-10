import type {
  ICourse,
  ICourseSeatsByCategory,
  IStudent,
  StudentCategory,
} from "../models/index.ts";
import {
  ensureApplicationDate,
  formatApplicationDate,
} from "../utils/application-date.ts";

export type StudentPayload = Omit<IStudent, "is_active"> &
  Partial<Pick<IStudent, "is_active">>;
export type CoursePayload = Omit<ICourse, "is_active"> &
  Partial<Pick<ICourse, "is_active">>;

export interface ControllerError extends Error {
  statusCode: number;
  details?: unknown;
}

export const categoryToSeatKey: Record<
  StudentCategory,
  keyof ICourseSeatsByCategory
> = {
  General: "general",
  OBC: "obc",
  SC: "sc",
  ST: "st",
};

export const normalizePreferences = (
  preferences: unknown
): [string, string, string] => {
  if (!Array.isArray(preferences)) {
    return ["", "", ""];
  }

  return preferences.map((preference) => String(preference).trim()).slice(0, 3) as [
    string,
    string,
    string,
  ];
};

export const normalizeStudentPayload = <T extends Partial<StudentPayload>>(
  payload: T
): T => {
  const normalizedPayload = { ...payload };

  if (typeof normalizedPayload.student_id === "string") {
    normalizedPayload.student_id = normalizedPayload.student_id.trim().toUpperCase();
  }

  if (typeof normalizedPayload.student_name === "string") {
    normalizedPayload.student_name = normalizedPayload.student_name.trim();
  }

  if (normalizedPayload.application_date !== undefined) {
    normalizedPayload.application_date = ensureApplicationDate(
      normalizedPayload.application_date
    ) as T["application_date"];
  }

  if (normalizedPayload.preferences) {
    normalizedPayload.preferences = normalizePreferences(normalizedPayload.preferences);
  }

  return normalizedPayload;
};

export const normalizeCoursePayload = <T extends Partial<CoursePayload>>(
  payload: T
): T => {
  const normalizedPayload = { ...payload };

  if (typeof normalizedPayload.course_name === "string") {
    normalizedPayload.course_name = normalizedPayload.course_name.trim();
  }

  return normalizedPayload;
};

export const createControllerError = (
  statusCode: number,
  message: string,
  details?: unknown
): ControllerError => {
  const error = new Error(message) as ControllerError;
  error.statusCode = statusCode;
  error.details = details;
  return error;
};

export const serializeApplicationDateField = <
  T extends { application_date?: Date | string | null },
>(
  record: T
): T => {
  if (!record.application_date) {
    return record;
  }

  return {
    ...record,
    application_date: formatApplicationDate(record.application_date),
  };
};
