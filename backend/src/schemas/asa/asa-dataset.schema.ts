import { Schema } from "mongoose";

export const ColumnTypeDef = {
  name: { type: String, required: true },
  type: { type: String, required: true },
};

const columnDefSchema = new Schema(
  {
    name: { type: String, required: true },
    type: { type: String, required: true },
  },
  { _id: false }
);

const asaDatasetSchema = new Schema(
  {
    tableName: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    fileName: {
      type: String,
      default: null,
    },
    columns: {
      type: [columnDefSchema],
      required: true,
    },
    rowCount: {
      type: Number,
      required: true,
      min: 0,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    versionKey: false,
    collection: "asa_datasets",
  }
);

asaDatasetSchema.index({ tableName: 1 });

export default asaDatasetSchema;
