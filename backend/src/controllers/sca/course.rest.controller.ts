import RestController from "../rest.controller.ts";
import { CourseModel } from "../../models/index.ts";
import type { CoursePayload } from "../../helpers/sca-controller.helper.ts";
import { normalizeCoursePayload } from "../../helpers/sca-controller.helper.ts";

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
