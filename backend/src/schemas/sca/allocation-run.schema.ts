import { Schema } from "mongoose";

import { studentCategories } from "./student.schema.js";

const remainingSeatsByCategorySchema = new Schema(
  {
    general: { type: Number, required: true, min: 0, default: 0 },
    obc: { type: Number, required: true, min: 0, default: 0 },
    sc: { type: Number, required: true, min: 0, default: 0 },
    st: { type: Number, required: true, min: 0, default: 0 },
  },
  { _id: false }
);

const allocationResultSchema = new Schema(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    student_id: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    student_name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: studentCategories,
      required: true,
    },
    marks: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    application_date: {
      type: Date,
      required: true,
    },
    preferences: {
      type: [String],
      required: true,
      validate: {
        validator(preferences: string[]) {
          return preferences.length === 3 && preferences.every(Boolean);
        },
        message: "Allocation snapshots require exactly three preferences.",
      },
    },
    allocated_course: {
      type: String,
      trim: true,
      default: null,
    },
    allocated_course_id: {
      type: Schema.Types.ObjectId,
      ref: "Course",
      default: null,
    },
    allocated_preference: {
      type: Number,
      enum: [1, 2, 3, null],
      default: null,
    },
    allocation_reason: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

const remainingCourseSeatsSchema = new Schema(
  {
    course_name: {
      type: String,
      required: true,
      trim: true,
    },
    remaining_seats: {
      type: remainingSeatsByCategorySchema,
      required: true,
    },
  },
  { _id: false }
);

const allocationRunSchema = new Schema(
  {
    run_code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    status: {
      type: String,
      enum: ["preview", "completed", "cancelled"],
      default: "preview",
    },
    generated_at: {
      type: Date,
      default: Date.now,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    rules: {
      sort_by: {
        type: String,
        enum: ["marks_desc_application_date_asc"],
        default: "marks_desc_application_date_asc",
      },
      preference_order: {
        type: String,
        enum: ["first_to_third"],
        default: "first_to_third",
      },
      category_seat_policy: {
        type: String,
        enum: ["strict_reserved_category"],
        default: "strict_reserved_category",
      },
    },
    total_students: {
      type: Number,
      required: true,
      min: 0,
    },
    allocated_students: {
      type: Number,
      required: true,
      min: 0,
    },
    unallocated_students: {
      type: Number,
      required: true,
      min: 0,
    },
    first_preference_allocations: {
      type: Number,
      required: true,
      min: 0,
    },
    allocations: {
      type: [allocationResultSchema],
      default: [],
    },
    remaining_seats_by_course: {
      type: [remainingCourseSeatsSchema],
      default: [],
    },
  },
  {
    timestamps: { createdAt: "created_date", updatedAt: "updated_date" },
    versionKey: false,
    collection: "seat_allocation",
  }
);

allocationRunSchema.index({ generated_at: -1 });
allocationRunSchema.index({ status: 1, generated_at: -1 });

export default allocationRunSchema;
