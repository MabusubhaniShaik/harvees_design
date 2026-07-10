import { Schema } from "mongoose";

const asaAiHistorySchema = new Schema(
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
    sql: {
      type: String,
      default: null,
      trim: true,
    },
    dataset_tables: {
      type: [String],
      default: [],
    },
    row_count: {
      type: Number,
      default: null,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: { createdAt: "created_date", updatedAt: "updated_date" },
    versionKey: false,
    collection: "asa_ai_histories",
  }
);

asaAiHistorySchema.index({ created_date: -1 });
asaAiHistorySchema.index({ exchange_id: 1, created_date: 1 });

export default asaAiHistorySchema;
