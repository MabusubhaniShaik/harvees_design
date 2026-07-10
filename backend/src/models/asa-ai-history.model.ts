import { Schema, type HydratedDocument } from "mongoose";
import { getAsaConnection } from "../db/client.ts";

export type AsaAiHistoryRole = "user" | "assistant";

export interface IAsaAiHistory {
  exchange_id: string;
  role: AsaAiHistoryRole;
  content: string;
  sql: string | null;
  dataset_tables: string[];
  row_count: number | null;
  is_active: boolean;
}

export type AsaAiHistoryDocument = HydratedDocument<IAsaAiHistory>;

const asaAiHistorySchema = new Schema<IAsaAiHistory>(
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
    timestamps: {
      createdAt: "created_date",
      updatedAt: "updated_date",
    },
    versionKey: false,
  }
);

asaAiHistorySchema.index({ created_date: -1 });
asaAiHistorySchema.index({ exchange_id: 1, created_date: 1 });

export const getAsaAiHistoryModel = () => {
  const connection = getAsaConnection();
  if (!connection) {
    return null;
  }

  return (
    connection.models.AsaAiHistory ||
    connection.model<IAsaAiHistory>("AsaAiHistory", asaAiHistorySchema)
  );
};
