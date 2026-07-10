import { Schema } from "mongoose";

export const studentCategories = ["General", "OBC", "SC", "ST"] as const;

const seatAllocationSubSchema = new Schema(
  {
    allocation_run: {
      type: Schema.Types.ObjectId,
      ref: "AllocationRun",
      required: true,
    },
    run_code: {
      type: String,
      required: true,
    },
    allocated_course: {
      type: Schema.Types.ObjectId,
      ref: "Course",
      default: null,
    },
    allocated_course_name: {
      type: String,
      default: null,
    },
    allocated_preference: {
      type: Number,
      enum: [1, 2, 3, null],
      default: null,
    },
    allocation_status: {
      type: String,
      enum: ["allocated", "unallocated"],
      required: true,
    },
    allocation_reason: {
      type: String,
      default: null,
    },
    allocated_at: {
      type: Date,
      required: true,
    },
  },
  { _id: false }
);

const studentSchema = new Schema(
  {
    student_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    student_name: {
      type: String,
      required: true,
      trim: true,
    },
    marks: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    category: {
      type: String,
      enum: studentCategories,
      required: true,
    },
    application_date: {
      type: Date,
      required: true,
    },
    preferences: {
      type: [String],
      required: true,
      validate: [
        {
          validator(preferences: string[]) {
            return preferences.length === 3;
          },
          message: "Exactly three course preferences are required.",
        },
        {
          validator(preferences: string[]) {
            const normalized = preferences.map((p) => p.trim().toLowerCase());
            return normalized.every(Boolean) && new Set(normalized).size === normalized.length;
          },
          message: "Course preferences must be non-empty and unique.",
        },
      ],
    },
    preferred_courses: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: "Course",
        },
      ],
      default: [],
      validate: {
        validator(preferredCourses: string[]) {
          return preferredCourses.length === 0 || preferredCourses.length === 3;
        },
        message: "Preferred course foreign keys must be empty or contain exactly three courses.",
      },
    },
    allocation_status: {
      type: String,
      enum: ["pending", "allocated", "unallocated"],
      default: "pending",
    },
    allocated_course: {
      type: Schema.Types.ObjectId,
      ref: "Course",
      default: null,
    },
    allocated_course_name: {
      type: String,
      trim: true,
      default: null,
    },
    allocated_preference: {
      type: Number,
      enum: [1, 2, 3, null],
      default: null,
    },
    allocation_run: {
      type: Schema.Types.ObjectId,
      ref: "AllocationRun",
      default: null,
    },
    allocation_reason: {
      type: String,
      trim: true,
      default: null,
    },
    allocated_at: {
      type: Date,
      default: null,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    seat_allocation: {
      type: [seatAllocationSubSchema],
      default: [],
    },
  },
  {
    timestamps: { createdAt: "created_date", updatedAt: "updated_date" },
    versionKey: false,
    collection: "student",
  }
);

studentSchema.index({ student_name: "text", student_id: "text" });
studentSchema.index({ marks: -1, application_date: 1 });
studentSchema.index({ category: 1 });
studentSchema.index({ preferred_courses: 1 });
studentSchema.index({ allocation_status: 1, allocated_course: 1 });

export default studentSchema;
