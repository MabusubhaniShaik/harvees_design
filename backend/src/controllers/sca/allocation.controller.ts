import type { NextFunction, Request, Response } from "express";

import {
  AllocationRunModel,
  CourseModel,
  StudentModel,
  type ICourseSeatsByCategory,
  type StudentCategory,
} from "../../models/index.js";
import {
  formatFailResponse,
  formatSuccessResponse,
} from "../../helpers/response-formatter.js";
import { logger } from "../../utils/logger.js";
import {
  categoryToSeatKey,
  serializeApplicationDateField,
} from "../../helpers/sca-controller.helper.js";

const buildRunCode = () => {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, "")
    .slice(0, 14);
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();

  return `ALLOC-${timestamp}-${suffix}`;
};

const buildAllocationSnapshot = (
  allocations: Array<{
    student_id: string;
    allocated_course: string | null;
    allocated_preference: 1 | 2 | 3 | null;
    category: StudentCategory;
  }>,
  remainingSeatMap: Map<
    string,
    { general: number; obc: number; sc: number; st: number }
  >
) =>
  JSON.stringify({
    allocations: allocations.map((allocation) => ({
      student_id: allocation.student_id,
      allocated_course: allocation.allocated_course,
      allocated_preference: allocation.allocated_preference,
      category: allocation.category,
    })),
    remaining_seats_by_course: Array.from(remainingSeatMap.entries()).map(
      ([course_name, remaining_seats]) => ({
        course_name,
        remaining_seats,
      })
    ),
  });

type LatestAllocationSnapshot = {
  allocations: Array<{
    student_id: string;
    allocated_course: string | null;
    allocated_preference: 1 | 2 | 3 | null;
    category: StudentCategory;
  }>;
  remaining_seats_by_course: Array<{
    course_name: string;
    remaining_seats: { general: number; obc: number; sc: number; st: number };
  }>;
};

const serializeAllocationPayload = <T extends { allocations?: unknown[] }>(
  record: T
): T => ({
  ...record,
  allocations: Array.isArray(record.allocations)
    ? record.allocations.map((allocation) =>
        serializeApplicationDateField(
          allocation as { application_date?: Date | string | null }
        )
      )
    : record.allocations,
});

export const runAllocation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const [students, courses] = await Promise.all([
      StudentModel.find({ is_active: true })
        .sort({ marks: -1, application_date: 1, student_id: 1 })
        .lean()
        .exec(),
      CourseModel.find({ is_active: true }).sort({ course_name: 1 }).lean().exec(),
    ]);

    if (students.length === 0 || courses.length === 0) {
      logger.warn("Allocation run blocked due to missing active data", {
        event: "api.sca.allocation_blocked",
        requestId: res.locals.requestId,
        api: req.originalUrl,
        studentCount: students.length,
        courseCount: courses.length,
      });
      return res.status(400).json(
        formatFailResponse({
          message: "Active students and courses are required before allocation.",
          data: [{ students: students.length, courses: courses.length }],
        })
      );
    }

    const remainingSeatMap = new Map(
      courses.map((course) => [
        course.course_name,
        {
          general: course.reserved_seats.general,
          obc: course.reserved_seats.obc,
          sc: course.reserved_seats.sc,
          st: course.reserved_seats.st,
        },
      ])
    );
    const courseByName = new Map(
      courses.map((course) => [course.course_name, course])
    );

    // Merit order is marks descending, then application date ascending.
    // Student ID provides a deterministic order only when both values tie.
    // Every run recomputes all active students from the current source data.
    const allocations = students.map((student) => {
      for (
        let preferenceIndex = 0;
        preferenceIndex < student.preferences.length;
        preferenceIndex += 1
      ) {
        const preferredCourse = student.preferences[preferenceIndex];
        const courseSeats = remainingSeatMap.get(preferredCourse) as
          | ICourseSeatsByCategory
          | undefined;

        if (!courseSeats) {
          continue;
        }

        const studentCategory = student.category as StudentCategory;
        const seatKey = categoryToSeatKey[studentCategory];
        const cutoffs = courseByName.get(preferredCourse)?.cutoffs ?? {
          general: 0,
          obc: 0,
          sc: 0,
          st: 0,
        };
        const qualifiesForOpenMerit = student.marks >= cutoffs.general;
        const qualifiesForReservedSeat = student.marks >= cutoffs[seatKey];
        const allocatedSeatKey =
          qualifiesForOpenMerit && courseSeats.general > 0
            ? "general"
            : studentCategory !== "General" &&
                qualifiesForReservedSeat &&
                courseSeats[seatKey] > 0
              ? seatKey
              : null;

        if (allocatedSeatKey) {
          courseSeats[allocatedSeatKey] -= 1;
          const allocationBasis =
            allocatedSeatKey === "general"
              ? "open merit"
              : `${studentCategory} reservation`;

          return {
            student: student._id,
            student_id: student.student_id,
            student_name: student.student_name,
            category: studentCategory,
            marks: student.marks,
            application_date: student.application_date,
            preferences: student.preferences,
            allocated_course_id: courseByName.get(preferredCourse)?._id ?? null,
            allocated_course: preferredCourse,
            allocated_preference: (preferenceIndex + 1) as 1 | 2 | 3,
            allocation_reason: `Allocated through preference ${
              preferenceIndex + 1
            } based on ${allocationBasis}; marks ${student.marks} met the ${
              cutoffs[allocatedSeatKey]
            } cutoff.`,
          };
        }
      }

      return {
        student: student._id,
        student_id: student.student_id,
        student_name: student.student_name,
        category: student.category as StudentCategory,
        marks: student.marks,
        application_date: student.application_date,
        preferences: student.preferences,
        allocated_course_id: null,
        allocated_course: null,
        allocated_preference: null,
        allocation_reason:
          "No preferred course had both an eligible category cutoff and an available seat.",
      };
    });

    const allocatedStudents = allocations.filter(
      (allocation) => allocation.allocated_course !== null
    ).length;
    const firstPreferenceAllocations = allocations.filter(
      (allocation) => allocation.allocated_preference === 1
    ).length;
    const snapshot = buildAllocationSnapshot(allocations, remainingSeatMap);
    const latestRunResult = await AllocationRunModel.findOne({ is_active: true })
      .sort({ generated_at: -1 })
      .lean()
      .exec();
    const latestRun = latestRunResult as unknown as LatestAllocationSnapshot | null;

    if (latestRun) {
      const latestSnapshot = JSON.stringify({
        allocations: latestRun.allocations.map((allocation) => ({
          student_id: allocation.student_id,
          allocated_course: allocation.allocated_course,
          allocated_preference: allocation.allocated_preference,
          category: allocation.category,
        })),
        remaining_seats_by_course: latestRun.remaining_seats_by_course,
      });

      if (latestSnapshot === snapshot) {
        logger.info("Allocation run skipped because latest snapshot is current", {
          event: "api.sca.allocation_up_to_date",
          requestId: res.locals.requestId,
          api: req.originalUrl,
          studentCount: students.length,
          allocatedStudents,
        });
        return res.status(200).json(
          formatSuccessResponse({
            data: serializeAllocationPayload(latestRun),
            message: "Allocation run already up to date",
          })
        );
      }
    }

    await StudentModel.updateMany(
      { is_active: true, allocation_status: { $in: ["pending", "allocated", "unallocated"] } },
      {
        $set: {
          allocation_status: "pending",
          allocated_course: null,
          allocated_course_name: null,
          allocated_preference: null,
          allocation_run: null,
          allocation_reason: null,
          allocated_at: null,
        },
      }
    ).exec();

    const runCode = buildRunCode();
    const generatedAt = new Date();
    const allocationResults = allocations.map((allocation) => ({
      student: allocation.student,
      student_id: allocation.student_id,
      student_name: allocation.student_name,
      category: allocation.category,
      marks: allocation.marks,
      application_date: allocation.application_date,
      preferences: allocation.preferences,
      allocated_course_id: allocation.allocated_course_id,
      allocated_course: allocation.allocated_course,
      allocated_preference: allocation.allocated_preference,
      allocation_reason: allocation.allocation_reason,
    }));

    const createdRun = await AllocationRunModel.create({
      run_code: runCode,
      status: "completed",
      generated_at: generatedAt,
      is_active: true,
      rules: {
        sort_by: "marks_desc_application_date_asc",
        preference_order: "first_to_third",
        category_seat_policy: "strict_reserved_category",
      },
      total_students: students.length,
      allocated_students: allocatedStudents,
      unallocated_students: students.length - allocatedStudents,
      first_preference_allocations: firstPreferenceAllocations,
      allocations: allocationResults,
      remaining_seats_by_course: Array.from(remainingSeatMap.entries()).map(
        ([course_name, remaining_seats]) => ({
          course_name,
          remaining_seats,
        })
      ),
    });

    await Promise.all(
      allocations.map((allocation) =>
        StudentModel.updateOne(
          { _id: allocation.student },
          {
            $set: {
              allocation_status: allocation.allocated_course ? "allocated" : "unallocated",
              allocated_course: allocation.allocated_course_id,
              allocated_course_name: allocation.allocated_course,
              allocated_preference: allocation.allocated_preference,
              allocation_run: createdRun._id,
              allocation_reason: allocation.allocation_reason,
              allocated_at: generatedAt,
            },
            $push: {
              seat_allocation: {
                allocation_run: createdRun._id,
                run_code: runCode,
                allocated_course: allocation.allocated_course_id,
                allocated_course_name: allocation.allocated_course,
                allocated_preference: allocation.allocated_preference,
                allocation_status: allocation.allocated_course ? "allocated" : "unallocated",
                allocation_reason: allocation.allocation_reason,
                allocated_at: generatedAt,
              },
            },
          }
        ).exec()
      )
    );

    const responsePayload = serializeAllocationPayload(createdRun.toObject());

    logger.success("Allocation run completed successfully", {
      event: "api.sca.allocation_completed",
      requestId: res.locals.requestId,
      api: req.originalUrl,
      runCode,
      studentCount: students.length,
      allocatedStudents,
    });

    return res.status(201).json(
      formatSuccessResponse({
        data: responsePayload,
        message: "Allocation run completed successfully",
      })
    );
  } catch (error) {
    next(error);
  }
};

export const getLatestAllocation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const latestRunResult = await AllocationRunModel.findOne({
      is_active: true,
      status: "completed",
    })
      .sort({ generated_at: -1 })
      .lean()
      .exec();
    const latestRun = latestRunResult as unknown as
      | ({ allocations?: unknown[] } & Record<string, unknown>)
      | null;

    logger.info("Latest allocation result fetched", {
      event: "api.sca.allocation_latest_fetched",
      requestId: res.locals.requestId,
      api: req.originalUrl,
      found: Boolean(latestRun),
    });

    return res.status(200).json(
      formatSuccessResponse({
        data: latestRun ? serializeAllocationPayload(latestRun) : [],
        message: latestRun
          ? "Latest allocation result fetched successfully"
          : "No completed allocation result found",
      })
    );
  } catch (error) {
    next(error);
  }
};
