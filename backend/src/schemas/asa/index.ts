import { getAsaConnection } from "../../db/client.js";

import asaAiHistorySchema from "./asa-ai-history.schema.js";
import asaDatasetSchema from "./asa-dataset.schema.js";
import {
  registerSchemasWithChangeDetection,
  type SchemaRegistrationSummary,
} from "../registry.js";

const ASA_SCHEMAS = [
  { name: "AsaAiHistory", schema: asaAiHistorySchema, collection: "asa_ai_histories" },
  { name: "AsaDataset", schema: asaDatasetSchema, collection: "asa_datasets" },
] as const;

export function registerAsaSchemas(): SchemaRegistrationSummary {
  const connection = getAsaConnection();
  if (!connection) {
    return {
      registeredCollections: [],
      changedCollections: [],
      skippedCollections: [],
    };
  }

  return registerSchemasWithChangeDetection(connection, ASA_SCHEMAS);
}

export { asaAiHistorySchema, asaDatasetSchema };
