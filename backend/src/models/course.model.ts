import mongoose, { Schema, model, type HydratedDocument } from "mongoose";

export interface ICourseSeatsByCategory {
  general: number;
  obc: number;
  sc: number;
  st: number;
}

export type ICourseCutoffsByCategory = ICourseSeatsByCategory;

export interface ICourse {
  course_name: string;
  total_seats: number;
  reserved_seats: ICourseSeatsByCategory;
  cutoffs: ICourseCutoffsByCategory;
  is_active: boolean;
}

export type CourseDocument = HydratedDocument<ICourse>;

const seatsByCategorySchema = new Schema<ICourseSeatsByCategory>(
  {
    general: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    obc: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    sc: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    st: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
  },
  {
    _id: false,
  }
);

const cutoffsByCategorySchema = new Schema<ICourseCutoffsByCategory>(
  {
    general: { type: Number, required: true, min: 0, max: 100, default: 0 },
    obc: { type: Number, required: true, min: 0, max: 100, default: 0 },
    sc: { type: Number, required: true, min: 0, max: 100, default: 0 },
    st: { type: Number, required: true, min: 0, max: 100, default: 0 },
  },
  { _id: false }
);

const courseSchema = new Schema<ICourse>(
  {
    course_name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    total_seats: {
      type: Number,
      required: true,
      min: 1,
    },
    reserved_seats: {
      type: seatsByCategorySchema,
      required: true,
    },
    cutoffs: {
      type: cutoffsByCategorySchema,
      required: true,
      default: () => ({ general: 0, obc: 0, sc: 0, st: 0 }),
    },
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: {
      createdAt: "created_date",
      updatedAt: "updated_date",
    },
    versionKey: false,
  }
);

courseSchema.path("reserved_seats").validate(function validateReservedSeatTotal(
  reservedSeats: ICourseSeatsByCategory
) {
  const reservedSeatTotal =
    reservedSeats.general + reservedSeats.obc + reservedSeats.sc + reservedSeats.st;

  return reservedSeatTotal === this.total_seats;
}, "Total seats must match the sum of category-wise reserved seats.");

courseSchema.index({ course_name: "text" });

export const CourseModel =
  mongoose.models.Course || model<ICourse>("Course", courseSchema, "course");
