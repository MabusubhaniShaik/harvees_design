import { Schema } from "mongoose";

const scaAiHistorySchema = new Schema(
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
    timestamps: { createdAt: "created_date", updatedAt: "updated_date" },
    versionKey: false,
    collection: "sca_ai_historie",
  }
);

scaAiHistorySchema.index({ created_date: -1 });
scaAiHistorySchema.index({ exchange_id: 1, sequence: 1 });
scaAiHistorySchema.index({ role: 1, created_date: -1 });

export default scaAiHistorySchema;
