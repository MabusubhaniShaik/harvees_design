import mongoose from "mongoose";

import studentSchema from "./student.schema.js";
import courseSchema from "./course.schema.js";
import allocationRunSchema from "./allocation-run.schema.js";
import scaAiHistorySchema from "./sca-ai-history.schema.js";
import {
  registerSchemasWithChangeDetection,
  type SchemaRegistrationSummary,
} from "../registry.js";

const SCA_SCHEMAS = [
  { name: "Student", schema: studentSchema, collection: "student" },
  { name: "Course", schema: courseSchema, collection: "course" },
  { name: "AllocationRun", schema: allocationRunSchema, collection: "seat_allocation" },
  { name: "ScaAiHistory", schema: scaAiHistorySchema, collection: "sca_ai_historie" },
] as const;

export function registerScaSchemas(): SchemaRegistrationSummary {
  return registerSchemasWithChangeDetection(mongoose, SCA_SCHEMAS);
}

export {
  studentSchema,
  courseSchema,
  allocationRunSchema,
  scaAiHistorySchema,
};

export {
  studentCategories,
} from "./student.schema.js";
