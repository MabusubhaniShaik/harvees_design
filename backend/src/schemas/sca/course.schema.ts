import { Schema } from "mongoose";

const seatsByCategorySchema = new Schema(
  {
    general: { type: Number, required: true, min: 0, default: 0 },
    obc: { type: Number, required: true, min: 0, default: 0 },
    sc: { type: Number, required: true, min: 0, default: 0 },
    st: { type: Number, required: true, min: 0, default: 0 },
  },
  { _id: false }
);

const cutoffsByCategorySchema = new Schema(
  {
    general: { type: Number, required: true, min: 0, max: 100, default: 0 },
    obc: { type: Number, required: true, min: 0, max: 100, default: 0 },
    sc: { type: Number, required: true, min: 0, max: 100, default: 0 },
    st: { type: Number, required: true, min: 0, max: 100, default: 0 },
  },
  { _id: false }
);

const courseSchema = new Schema(
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
    timestamps: { createdAt: "created_date", updatedAt: "updated_date" },
    versionKey: false,
    collection: "course",
  }
);

courseSchema
  .path("reserved_seats")
  .validate(function (reservedSeats: {
    general: number;
    obc: number;
    sc: number;
    st: number;
  }) {
    const total =
      reservedSeats.general +
      reservedSeats.obc +
      reservedSeats.sc +
      reservedSeats.st;
    return total === this.total_seats;
  }, "Total seats must match the sum of category-wise reserved seats.");

courseSchema.index({ course_name: "text" });

export default courseSchema;
