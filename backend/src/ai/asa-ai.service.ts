import { generateGeminiText, getGeminiConfig } from "./gemini-client.ts";
import { getAsaAiHistoryModel } from "../models/index.ts";
import { getAsaMongoDb } from "../db/client.ts";
import {
  executeQuery,
  getTableSchema,
  listTables,
  validateQuery,
} from "../db/asa-db.ts";

type AsaAiChatResponse = {
  answer: string;
  sql: string;
  columns: string[];
  rows: unknown[][];
  rowCount: number;
  model: string;
  tables: string[];
};

export type AsaAiHistoryEntry = {
  id: string;
  question: string;
  answer: string;
  sql: string;
  rowCount: number;
  askedAt: Date;
};

export type AsaAiChatMessage = {
  id: string;
  exchangeId: string;
  role: "user" | "assistant";
  content: string;
  sql: string | null;
  tables: string[];
  rowCount: number | null;
  createdAt: Date;
};

const DEFAULT_SUGGESTIONS = [
  "Show the top 10 customers by revenue.",
  "Find duplicate orders by customer or order details.",
  "Which month generated the highest sales?",
  "Show records with missing values.",
  "Generate a sales summary for the last quarter.",
];

const createServiceError = (message: string, statusCode: number) =>
  Object.assign(new Error(message), { statusCode });

type PersistedHistoryRow = {
  id: string;
  exchange_id: string;
  role: "user" | "assistant";
  content: string;
  sql: string | null;
  dataset_tables: string[];
  row_count: number | null;
  created_date: Date;
};

const inMemoryHistory: PersistedHistoryRow[] = [];

const extractSql = (text: string): string => {
  const fenced = text.match(/```(?:sql)?\s*([\s\S]*?)```/i);
  const source = fenced?.[1] ?? text;
  const selectMatch = source.match(/select[\s\S]*?;/i) ?? source.match(/select[\s\S]*$/i);
  return (selectMatch?.[0] ?? source).trim();
};

const identifyColumn = (
  columns: Array<{ name: string; type: string }>,
  patterns: RegExp[],
  categories?: string[]
) =>
  columns.find((column) => {
    const matchesName = patterns.some((pattern) => pattern.test(column.name));
    const matchesCategory = !categories || categories.some((category) => column.type.toUpperCase().startsWith(category));
    return matchesName && matchesCategory;
  });

const selectPrimaryTable = async () => {
  const tables = await listTables();
  if (!tables.length) {
    throw createServiceError("Upload a dataset before using the AI SQL assistant.", 400);
  }

  const ranked = [...tables].sort((left, right) => right.rowCount - left.rowCount);
  const primary = ranked[0];
  const columns = await getTableSchema(primary.name);

  return { table: primary, columns };
};

const createMissingValueQuery = (tableName: string, columns: Array<{ name: string; type: string }>) => {
  const conditions = columns.map(
    (column) => `("${column.name}" IS NULL OR TRIM(CAST("${column.name}" AS TEXT)) = '')`
  );
  return `SELECT * FROM "${tableName}" WHERE ${conditions.join(" OR ")} LIMIT 100;`;
};

const createDuplicateQuery = (tableName: string, columns: Array<{ name: string; type: string }>) => {
  const preferredColumns = columns.filter((column) =>
    /(customer|email|phone|mobile|name|order|invoice|transaction|product)/i.test(column.name)
  );
  const groupingColumns = (preferredColumns.length ? preferredColumns : columns.slice(0, Math.min(columns.length, 4)))
    .map((column) => `"${column.name}"`);

  if (!groupingColumns.length) {
    return `SELECT COUNT(*) AS duplicate_count FROM "${tableName}";`;
  }

  return [
    `SELECT ${groupingColumns.join(", ")}, COUNT(*) AS duplicate_count`,
    `FROM "${tableName}"`,
    `GROUP BY ${groupingColumns.join(", ")}`,
    "HAVING COUNT(*) > 1",
    "ORDER BY duplicate_count DESC",
    "LIMIT 100;",
  ].join(" ");
};

const createTopByRevenueQuery = (
  tableName: string,
  columns: Array<{ name: string; type: string }>,
  limit: number
) => {
  const revenueColumn =
    identifyColumn(columns, [/revenue/i, /sales/i, /amount/i, /total/i], ["DECIMAL", "INT", "BIGINT", "FLOAT", "REAL"]) ??
    columns.find((column) => /^(DECIMAL|INT|BIGINT|FLOAT|REAL)/i.test(column.type));
  const dimensionColumn =
    identifyColumn(columns, [/customer/i, /client/i, /account/i, /name/i]) ??
    columns.find((column) => /^VARCHAR|TEXT/i.test(column.type));

  if (!revenueColumn || !dimensionColumn) return null;

  return [
    `SELECT "${dimensionColumn.name}" AS dimension, ROUND(SUM("${revenueColumn.name}"), 2) AS total_revenue`,
    `FROM "${tableName}"`,
    `GROUP BY "${dimensionColumn.name}"`,
    "ORDER BY total_revenue DESC",
    `LIMIT ${limit};`,
  ].join(" ");
};

const createHighestMonthQuery = (
  tableName: string,
  columns: Array<{ name: string; type: string }>
) => {
  const dateColumn =
    identifyColumn(columns, [/date/i, /month/i, /created/i, /sale/i], ["DATE", "DATETIME"]) ??
    columns.find((column) => /^(DATE|DATETIME)/i.test(column.type));
  const revenueColumn =
    identifyColumn(columns, [/revenue/i, /sales/i, /amount/i, /total/i], ["DECIMAL", "INT", "BIGINT", "FLOAT", "REAL"]) ??
    columns.find((column) => /^(DECIMAL|INT|BIGINT|FLOAT|REAL)/i.test(column.type));

  if (!dateColumn || !revenueColumn) return null;

  return [
    `SELECT substr(CAST("${dateColumn.name}" AS TEXT), 1, 7) AS month,`,
    `ROUND(SUM("${revenueColumn.name}"), 2) AS total_revenue`,
    `FROM "${tableName}"`,
    `WHERE "${dateColumn.name}" IS NOT NULL AND TRIM(CAST("${dateColumn.name}" AS TEXT)) <> ''`,
    "GROUP BY month",
    "ORDER BY total_revenue DESC",
    "LIMIT 1;",
  ].join(" ");
};

const createLastQuarterSummaryQuery = (
  tableName: string,
  columns: Array<{ name: string; type: string }>
) => {
  const dateColumn =
    identifyColumn(columns, [/date/i, /month/i, /created/i, /sale/i], ["DATE", "DATETIME"]) ??
    columns.find((column) => /^(DATE|DATETIME)/i.test(column.type));
  const revenueColumn =
    identifyColumn(columns, [/revenue/i, /sales/i, /amount/i, /total/i], ["DECIMAL", "INT", "BIGINT", "FLOAT", "REAL"]) ??
    columns.find((column) => /^(DECIMAL|INT|BIGINT|FLOAT|REAL)/i.test(column.type));

  if (!dateColumn || !revenueColumn) return null;

  return [
    `SELECT COUNT(*) AS record_count,`,
    `ROUND(COALESCE(SUM("${revenueColumn.name}"), 0), 2) AS total_revenue,`,
    `ROUND(COALESCE(AVG("${revenueColumn.name}"), 0), 2) AS average_revenue`,
    `FROM "${tableName}"`,
    `WHERE date(CAST("${dateColumn.name}" AS TEXT)) >= date((SELECT MAX(date(CAST("${dateColumn.name}" AS TEXT))) FROM "${tableName}"), '-3 months');`,
  ].join(" ");
};

const createOverviewQuery = (
  tableName: string,
  columns: Array<{ name: string; type: string }>
) => {
  const numericColumns = columns.filter((column) => /^(DECIMAL|INT|BIGINT|FLOAT|REAL)/i.test(column.type));
  if (!numericColumns.length) {
    return `SELECT COUNT(*) AS total_rows FROM "${tableName}";`;
  }

  const aggregateColumns = numericColumns
    .slice(0, 3)
    .map(
      (column) =>
        `ROUND(COALESCE(SUM("${column.name}"), 0), 2) AS sum_${column.name}`
    );

  return `SELECT COUNT(*) AS total_rows, ${aggregateColumns.join(", ")} FROM "${tableName}";`;
};

const buildLocalSql = async (question: string) => {
  const normalized = question.trim().toLowerCase();
  const { table, columns } = await selectPrimaryTable();
  const limitMatch = normalized.match(/\btop\s+(\d+)\b/);
  const limit = Math.min(Number(limitMatch?.[1] ?? 10), 100);

  if (/\bduplicate\b/.test(normalized)) {
    return { sql: createDuplicateQuery(table.name, columns), tables: [table.name], model: "local-heuristic" };
  }

  if (/\bmissing\b|\bnull\b|\bblank\b|\bempty\b/.test(normalized)) {
    return { sql: createMissingValueQuery(table.name, columns), tables: [table.name], model: "local-heuristic" };
  }

  if ((/\btop\b/.test(normalized) || /\brevenue\b|\bsales\b/.test(normalized)) && /\bcustomer\b|\bclient\b/.test(normalized)) {
    const sql = createTopByRevenueQuery(table.name, columns, limit);
    if (sql) {
      return { sql, tables: [table.name], model: "local-heuristic" };
    }
  }

  if ((/\bwhich month\b|\bhighest sales\b|\bhighest revenue\b|\btop month\b/.test(normalized))) {
    const sql = createHighestMonthQuery(table.name, columns);
    if (sql) {
      return { sql, tables: [table.name], model: "local-heuristic" };
    }
  }

  if ((/\blast quarter\b|\bquarter\b/.test(normalized)) && (/\bsummary\b|\brevenue\b|\bsales\b/.test(normalized))) {
    const sql = createLastQuarterSummaryQuery(table.name, columns);
    if (sql) {
      return { sql, tables: [table.name], model: "local-heuristic" };
    }
  }

  if (/\bsummary\b|\boverview\b|\btotal\b/.test(normalized)) {
    return { sql: createOverviewQuery(table.name, columns), tables: [table.name], model: "local-heuristic" };
  }

  const matchedColumn = columns.find((column) => normalized.includes(column.name.toLowerCase()));
  if (matchedColumn) {
    return {
      sql: `SELECT "${matchedColumn.name}", COUNT(*) AS record_count FROM "${table.name}" GROUP BY "${matchedColumn.name}" ORDER BY record_count DESC LIMIT ${limit};`,
      tables: [table.name],
      model: "local-heuristic",
    };
  }

  throw createServiceError(
    "The assistant could not infer a safe SQL query from that request. Rephrase it or provide a SELECT query directly.",
    400
  );
};

const buildPrompt = async (question: string) => {
  const tables = await listTables();
  const tableSchemas = await Promise.all(
    tables.map(async (table) => ({
      tableName: table.name,
      rowCount: table.rowCount,
      columns: await getTableSchema(table.name),
    }))
  );

  if (tableSchemas.length === 0) {
    throw createServiceError("Upload a dataset before using the AI SQL assistant.", 400);
  }

  return {
    prompt: [
      "You generate a single SQLite SELECT query for an analytics platform.",
      "The dataset is ecommerce sales data only.",
      "Return SQL only.",
      "Do not include explanations.",
      "Do not include markdown fences unless necessary.",
      "Only produce one SELECT statement.",
      "Never use INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, TRUNCATE, ATTACH, or PRAGMA.",
      "",
      `Question: ${question}`,
      "",
      `Available tables: ${JSON.stringify(tableSchemas)}`,
    ].join("\n"),
    tables: tableSchemas.map((table) => table.tableName),
  };
};

const readHistoryRows = async (): Promise<PersistedHistoryRow[]> => {
  if (!getAsaMongoDb()) {
    return [...inMemoryHistory].sort(
      (left, right) => left.created_date.getTime() - right.created_date.getTime()
    );
  }

  const historyModel = getAsaAiHistoryModel();
  if (!historyModel) {
    return [...inMemoryHistory].sort(
      (left, right) => left.created_date.getTime() - right.created_date.getTime()
    );
  }

  const rows = await historyModel.find({ is_active: true })
    .sort({ created_date: 1 })
    .lean()
    .exec();

  return (rows as unknown as Array<{
    _id: { toString(): string };
    exchange_id: string;
    role: "user" | "assistant";
    content: string;
    sql: string | null;
    dataset_tables: string[];
    row_count: number | null;
    created_date: Date;
  }>).map((row) => ({
    id: row._id.toString(),
    exchange_id: row.exchange_id,
    role: row.role,
    content: row.content,
    sql: row.sql,
    dataset_tables: row.dataset_tables,
    row_count: row.row_count,
    created_date: new Date(row.created_date),
  }));
};

const appendHistoryRows = async (
  rows: Array<Omit<PersistedHistoryRow, "id" | "created_date">>
) => {
  const createdAt = new Date();

  if (!getAsaMongoDb()) {
    for (const row of rows) {
      inMemoryHistory.push({
        id: `${row.exchange_id}-${row.role}-${Math.random().toString(36).slice(2, 8)}`,
        created_date: createdAt,
        ...row,
      });
    }
    return;
  }

  const historyModel = getAsaAiHistoryModel();
  if (!historyModel) {
    for (const row of rows) {
      inMemoryHistory.push({
        id: `${row.exchange_id}-${row.role}-${Math.random().toString(36).slice(2, 8)}`,
        created_date: createdAt,
        ...row,
      });
    }
    return;
  }

  await historyModel.insertMany(
    rows.map((row) => ({
      ...row,
      is_active: true,
    }))
  );
};

const buildAnswer = (columns: string[], rows: unknown[][]): string => {
  if (rows.length === 0) {
    return "The query ran successfully but returned no rows.";
  }

  if (rows.length === 1 && columns.length === 1) {
    return `${columns[0]}: ${String(rows[0][0] ?? "")}`;
  }

  const primaryColumn = columns[0];
  const secondaryColumn = columns[1];
  if (rows.length > 0 && primaryColumn && secondaryColumn) {
    const firstRow = rows[0];
    return `Returned ${rows.length} row(s). Top result: ${primaryColumn} = ${String(firstRow[0] ?? "")}, ${secondaryColumn} = ${String(firstRow[1] ?? "")}.`;
  }

  return `The query ran successfully and returned ${rows.length} row(s).`;
};

export const getAsaAiConfig = () => {
  const config = getGeminiConfig();
  return {
    ...config,
    dataset: "ecommerce_sales_data.xlsx",
    suggestions: DEFAULT_SUGGESTIONS,
  };
};

export const getAsaQueryHistory = async (): Promise<AsaAiHistoryEntry[]> => {
  const exchangeMap = new Map<
    string,
    {
      question?: string;
      answer?: string;
      sql?: string | null;
      rowCount?: number | null;
      askedAt?: Date;
      createdAt?: Date;
    }
  >();

  for (const row of await readHistoryRows()) {
    const current = exchangeMap.get(row.exchange_id) || {};
    if (row.role === "user") {
      current.question = row.content;
      current.askedAt = row.created_date;
    } else {
      current.answer = row.content;
      current.sql = row.sql;
      current.rowCount = row.row_count;
    }
    current.createdAt = current.createdAt || row.created_date;
    exchangeMap.set(row.exchange_id, current);
  }

  return Array.from(exchangeMap.entries())
    .map(([exchangeId, value]) => ({
      id: exchangeId,
      question: value.question || "",
      answer: value.answer || "",
      sql: value.sql || "",
      rowCount: value.rowCount ?? 0,
      askedAt: value.askedAt || value.createdAt || new Date(),
    }))
    .filter((entry) => entry.question && entry.answer)
    .sort((left, right) => right.askedAt.getTime() - left.askedAt.getTime())
    .slice(0, 50);
};

export const getAsaChatHistory = async (): Promise<AsaAiChatMessage[]> => {
  return (await readHistoryRows()).slice(-100).map((row) => ({
    id: row.id,
    exchangeId: row.exchange_id,
    role: row.role,
    content: row.content,
    sql: row.sql,
    tables: row.dataset_tables,
    rowCount: row.row_count,
    createdAt: row.created_date,
  }));
};

export const answerAsaQuestion = async (
  message: string
): Promise<AsaAiChatResponse> => {
  const trimmedMessage = message.trim();
  if (!trimmedMessage) {
    throw createServiceError("A question is required for the AI SQL assistant.", 400);
  }

  const generation: { model: string; text: string; tables: string[] } = /^\s*SELECT\s/i.test(trimmedMessage)
    ? {
        model: "manual-sql",
        text: trimmedMessage,
        tables: [],
      }
    : await (async () => {
        const config = getGeminiConfig();
        if (config.enabled) {
          try {
            const { prompt, tables } = await buildPrompt(trimmedMessage);
            const response = await generateGeminiText(prompt);
            return {
              model: response.model,
              text: response.text,
              tables,
            };
          } catch {
            const local = await buildLocalSql(trimmedMessage);
            return { model: local.model, text: local.sql, tables: local.tables };
          }
        }

        const local = await buildLocalSql(trimmedMessage);
        return { model: local.model, text: local.sql, tables: local.tables };
      })();

  const sql = extractSql(generation.text);
  const validation = validateQuery(sql);
  if (!validation.valid) {
    throw createServiceError(validation.error || "Generated SQL is invalid.", 400);
  }

  const result = executeQuery(sql);
  const rowCount = result.rows.length;
  const answer = buildAnswer(result.columns, result.rows);
  const exchangeId = `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  await appendHistoryRows([
    {
      exchange_id: exchangeId,
      role: "user",
      content: trimmedMessage,
      sql,
      dataset_tables: generation.tables,
      row_count: rowCount,
    },
    {
      exchange_id: exchangeId,
      role: "assistant",
      content: answer,
      sql,
      dataset_tables: generation.tables,
      row_count: rowCount,
    },
  ]);

  return {
    answer,
    sql,
    columns: result.columns,
    rows: result.rows,
    rowCount,
    model: generation.model,
    tables: generation.tables,
  };
};
