import type { Request } from "express";

import RestController from "../rest.controller.js";
import { CourseModel, StudentModel } from "../../models/index.js";
import type { StudentPayload } from "../../helpers/sca-controller.helper.js";
import {
  createControllerError,
  normalizeStudentPayload,
  serializeApplicationDateField,
} from "../../helpers/sca-controller.helper.js";

const resolvePreferredCourses = async (
  preferences: [string, string, string]
): Promise<StudentPayload["preferred_courses"]> => {
  const courses = await CourseModel.find({
    course_name: { $in: preferences },
    is_active: true,
  })
    .select("_id course_name")
    .lean()
    .exec();

  const courseByName = new Map(
    courses.map((course) => [course.course_name.toLowerCase(), course._id])
  );
  const missingCourses = preferences.filter(
    (preference) => !courseByName.has(preference.toLowerCase())
  );

  if (missingCourses.length > 0) {
    throw createControllerError(400, "Course preferences are not configured", {
      missingCourses,
    });
  }

  return preferences.map((preference) => courseByName.get(preference.toLowerCase())) as
    StudentPayload["preferred_courses"];
};

class StudentController extends RestController<StudentPayload> {
  protected readonly model = StudentModel;

  constructor() {
    super({
      tableName: "Students",
      schema: "sca",
      lookupID: "student_id",
      searchable: true,
      orderBy: "-marks application_date",
      softDelete: true,
    });
  }

  protected override getSearchFields(): string[] {
    return ["student_id", "student_name", "category", "preferences"];
  }

  protected override async preSave(
    payload: StudentPayload | Partial<StudentPayload>
  ): Promise<StudentPayload | Partial<StudentPayload>> {
    const normalizedPayload = normalizeStudentPayload(payload);

    if (normalizedPayload.preferences) {
      normalizedPayload.preferred_courses = await resolvePreferredCourses(
        normalizedPayload.preferences
      );
    }

    return normalizedPayload;
  }

  protected override async serialize(
    data: unknown,
    _request: Request
  ): Promise<unknown> {
    if (Array.isArray(data)) {
      return data.map((record) => serializeApplicationDateField(record));
    }

    return serializeApplicationDateField(data as {
      application_date?: Date | string | null;
    });
  }
}

export const studentController = new StudentController();
