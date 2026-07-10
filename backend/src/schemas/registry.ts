import type { Connection, Model, Mongoose, Schema } from "mongoose";

type SchemaDefinition = {
  name: string;
  schema: Schema;
  collection: string;
};

type SchemaWithOptions = Schema & {
  options: unknown;
};

type SchemaRegistrationSummary = {
  registeredCollections: string[];
  changedCollections: string[];
  skippedCollections: string[];
};

type ModelRegistry = Pick<Mongoose, "models" | "deleteModel" | "model"> | Pick<
  Connection,
  "models" | "deleteModel" | "model"
>;

const registryState = new WeakMap<object, Map<string, string>>();
const MAX_SERIALIZE_DEPTH = 4;
const MAX_ARRAY_ITEMS = 20;
const MAX_OBJECT_KEYS = 50;

const serializeValue = (
  value: unknown,
  depth = 0,
  seen = new WeakSet<object>()
): unknown => {
  if (value == null) {
    return value;
  }

  if (depth >= MAX_SERIALIZE_DEPTH) {
    if (Array.isArray(value)) {
      return `[Array(${value.length})]`;
    }

    if (typeof value === "object") {
      return "[Object]";
    }
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => serializeValue(item, depth + 1, seen));
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "function") {
    return `[function:${value.name || "anonymous"}]`;
  }

  if (typeof value === "object") {
    if (seen.has(value)) {
      return "[Circular]";
    }

    seen.add(value);

    return Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .slice(0, MAX_OBJECT_KEYS)
      .reduce<Record<string, unknown>>((accumulator, [key, nestedValue]) => {
        accumulator[key] = serializeValue(nestedValue, depth + 1, seen);
        return accumulator;
      }, {});
  }

  return value;
};

const buildSchemaFingerprint = (definition: SchemaDefinition): string => {
  const pathMetadata = Object.entries(definition.schema.paths)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([path, schemaType]) => ({
      path,
      instance: schemaType.instance,
      options: serializeValue(schemaType.options),
    }));

  return JSON.stringify({
    name: definition.name,
    collection: definition.collection,
    options: serializeValue((definition.schema as SchemaWithOptions).options),
    indexes: serializeValue(definition.schema.indexes()),
    paths: pathMetadata,
  });
};

const getRegistryState = (registry: object): Map<string, string> => {
  const existing = registryState.get(registry);
  if (existing) {
    return existing;
  }

  const created = new Map<string, string>();
  registryState.set(registry, created);
  return created;
};

const hasModel = (registry: ModelRegistry, name: string): boolean => {
  return Boolean(registry.models[name]);
};

const createModel = (
  registry: ModelRegistry,
  definition: SchemaDefinition
): Model<unknown> => {
  return registry.model(definition.name, definition.schema, definition.collection);
};

export const registerSchemasWithChangeDetection = (
  registry: ModelRegistry,
  definitions: readonly SchemaDefinition[]
): SchemaRegistrationSummary => {
  const state = getRegistryState(registry as object);
  const summary: SchemaRegistrationSummary = {
    registeredCollections: [],
    changedCollections: [],
    skippedCollections: [],
  };

  for (const definition of definitions) {
    const fingerprint = buildSchemaFingerprint(definition);
    const existingFingerprint = state.get(definition.name);
    const modelExists = hasModel(registry, definition.name);
    const schemaChanged = existingFingerprint !== fingerprint;

    if (!modelExists || schemaChanged) {
      if (modelExists) {
        registry.deleteModel(definition.name);
      }

      createModel(registry, definition);
      summary.changedCollections.push(definition.collection);
      state.set(definition.name, fingerprint);
    } else {
      summary.skippedCollections.push(definition.collection);
    }

    summary.registeredCollections.push(definition.collection);
  }

  return summary;
};

export type { SchemaDefinition, SchemaRegistrationSummary };
