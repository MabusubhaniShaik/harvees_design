import RestController from "../rest.controller.js";
import { CourseModel } from "../../models/index.js";
import type { CoursePayload } from "../../helpers/sca-controller.helper.js";
import { normalizeCoursePayload } from "../../helpers/sca-controller.helper.js";

class CourseController extends RestController<CoursePayload> {
  protected readonly model = CourseModel;

  constructor() {
    super({
      tableName: "Courses",
      schema: "sca",
      lookupID: "course_name",
      searchable: true,
      orderBy: "course_name",
      softDelete: true,
    });
  }

  protected override getSearchFields(): string[] {
    return ["course_name"];
  }

  protected override async preSave(
    payload: CoursePayload | Partial<CoursePayload>
  ): Promise<CoursePayload | Partial<CoursePayload>> {
    return normalizeCoursePayload(payload);
  }
}

export const courseController = new CourseController();
