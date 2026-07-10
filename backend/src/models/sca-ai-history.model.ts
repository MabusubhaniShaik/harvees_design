import mongoose, { Schema, model, type HydratedDocument } from "mongoose";

export type ScaAiHistoryRole = "user" | "assistant";

export interface IScaAiHistory {
  exchange_id: string;
  role: ScaAiHistoryRole;
  content: string;
  intent: string | null;
  run_code: string | null;
  allocation_generated_at: Date | null;
  sequence: number;
  is_active: boolean;
}

export type ScaAiHistoryDocument = HydratedDocument<IScaAiHistory>;

const scaAiHistorySchema = new Schema<IScaAiHistory>(
  {
    exchange_id: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    intent: {
      type: String,
      default: null,
      trim: true,
    },
    run_code: {
      type: String,
      default: null,
      trim: true,
    },
    allocation_generated_at: {
      type: Date,
      default: null,
    },
    sequence: {
      type: Number,
      required: true,
      min: 0,
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

scaAiHistorySchema.index({ created_date: -1 });
scaAiHistorySchema.index({ exchange_id: 1, sequence: 1 });
scaAiHistorySchema.index({ role: 1, created_date: -1 });

export const ScaAiHistoryModel =
  mongoose.models.ScaAiHistory ||
  model<IScaAiHistory>("ScaAiHistory", scaAiHistorySchema, "sca_ai_historie");
