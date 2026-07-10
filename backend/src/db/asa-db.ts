import initSqlJs, { type Database as SqlJsDatabase, type SqlJsStatic } from "sql.js";
import { getAsaMongoDb } from "./client.js";

type ColumnDef = { name: string; type: string };
type RowData = Record<string, string>;
type TableSummary = {
  name: string;
  columnCount: number;
  rowCount: number;
  fileName?: string;
  createdAt?: Date;
  updatedAt?: Date;
};
type DatasetMeta = {
  tableName: string;
  fileName?: string;
  columns: ColumnDef[];
  rowCount: number;
  createdAt: Date;
  updatedAt: Date;
};

let SQL: SqlJsStatic | null = null;
let db: SqlJsDatabase | null = null;

const META_COLLECTION = "asa_datasets";

export async function initAsaDb(): Promise<void> {
  SQL = await initSqlJs();
  db = new SQL.Database();
  db.run("PRAGMA journal_mode=WAL;");
  db.run("PRAGMA foreign_keys=ON;");
  await restoreMongoDatasets();
}

export function getDb(): SqlJsDatabase {
  if (!db) throw new Error("ASA database not initialized");
  return db;
}

const dateColumnPatterns = [
  /date/i, /dob/i, /birth/i, /hire/i, /login/i,
  /created/i, /updated/i, /timestamp/i, /time/i,
  /joined/i, /start/i, /end/i, /expir/i, /due/i,
];

const identifierPatterns = [
  /id$/i, /code$/i, /zip/i, /postal/i, /pin/i,
  /account/i, /aadhaar/i, /phone/i, /mobile/i,
  /pan$/i, /ifsc/i, /ssn/i, /tax/i, /no$/i,
  /number$/i,
];

function isDateColumn(name: string): boolean {
  return dateColumnPatterns.some((p) => p.test(name));
}

function isIdentifierColumn(name: string): boolean {
  return identifierPatterns.some((p) => p.test(name));
}

function isExcelSerialDate(val: string): boolean {
  const num = Number(val);
  return !isNaN(num) && num > 10000 && num < 500000;
}

function excelSerialToIso(val: string): string {
  const num = Number(val);
  if (isNaN(num) || num < 1 || num > 500000) return val;
  const date = new Date((num - 25569) * 86400 * 1000);
  return date.toISOString().replace("T", " ").slice(0, 19);
}

function isDateTime(val: string): boolean {
  const d = new Date(val);
  return !isNaN(d.getTime()) && val.includes(" ") && val.length >= 16;
}

function detectSqlType(name: string, values: string[]): string {
  const nonEmpty = values.filter((v) => v !== "" && v !== null && v !== undefined);
  if (nonEmpty.length === 0) return "TEXT";

  if (isIdentifierColumn(name)) {
    const maxLen = Math.max(...nonEmpty.map((v) => v.length));
    const len = Math.min(Math.ceil(maxLen * 1.2 / 5) * 5 + 5, 255);
    return `VARCHAR(${len})`;
  }

  if (isDateColumn(name)) {
    const serials = nonEmpty.filter((v) => isExcelSerialDate(v));
    if (serials.length > nonEmpty.length * 0.5) {
      const converted = serials.map(excelSerialToIso);
      const hasTime = converted.some((v) => isDateTime(v));
      return hasTime ? "DATETIME" : "DATE";
    }
    const dates = nonEmpty.filter((v) => !isNaN(Date.parse(v)));
    if (dates.length > nonEmpty.length * 0.5) {
      const hasTime = dates.some((v) => isDateTime(v));
      return hasTime ? "DATETIME" : "DATE";
    }
  }

  const booleans = nonEmpty.filter((v) => /^(true|false|yes|no|0|1)$/i.test(v.trim()));
  if (booleans.length === nonEmpty.length && nonEmpty.length > 0) {
    return "BOOLEAN";
  }

  const numbers = nonEmpty.filter((v) => !isNaN(Number(v.trim())) && v.trim() !== "");
  if (numbers.length === 0) {
    const maxLen = Math.max(...nonEmpty.map((v) => v.length));
    if (maxLen > 255) return "TEXT";
    const len = Math.min(Math.ceil(maxLen * 1.2 / 5) * 5 + 5, 255);
    return `VARCHAR(${len})`;
  }

  const hasDecimal = numbers.some((v) => v.includes(".") || v.includes("e") || v.includes("E"));
  const allInts = numbers.every((v) => {
    const n = Number(v);
    return Number.isInteger(n) && !v.includes(".");
  });

  if (allInts) {
    const maxAbs = Math.max(...numbers.map((v) => Math.abs(Number(v))));
    if (maxAbs <= 2147483647) return "INT";
    return "BIGINT";
  }

  if (hasDecimal) {
    let maxIntDigits = 0;
    let maxDecDigits = 0;
    for (const v of numbers) {
      const parts = v.replace("-", "").split(".");
      const intLen = parts[0].length;
      const decLen = parts.length > 1 ? parts[1].length : 0;
      if (intLen > maxIntDigits) maxIntDigits = intLen;
      if (decLen > maxDecDigits) maxDecDigits = decLen;
    }
    const precision = Math.min(maxIntDigits + maxDecDigits + 2, 38);
    const scale = Math.min(maxDecDigits + 1, precision - 1);
    return `DECIMAL(${Math.max(precision, scale + 1)},${Math.max(scale, 1)})`;
  }

  const maxLen = Math.max(...nonEmpty.map((v) => v.length));
  if (maxLen > 255) return "TEXT";
  const len = Math.min(Math.ceil(maxLen * 1.2 / 5) * 5 + 5, 255);
  return `VARCHAR(${len})`;
}

function isNumericType(t: string): boolean {
  return /^(INT|BIGINT|DECIMAL|FLOAT|REAL|BOOLEAN)\b/.test(t);
}

function isDecimalType(t: string): boolean {
  return /^DECIMAL/i.test(t);
}

export function inferColumns(headers: string[], rows: RowData[]): ColumnDef[] {
  const allValues: Record<string, string[]> = {};
  for (const h of headers) allValues[h] = [];
  for (const row of rows) {
    for (const h of headers) {
      allValues[h].push(row[h] ?? "");
    }
  }

  return headers.map((h) => ({
    name: h,
    type: detectSqlType(h, allValues[h]),
  }));
}

function quoteId(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function createSqlTable(
  tableName: string,
  columns: ColumnDef[],
  rows: RowData[],
): void {
  const d = getDb();
  const safeName = quoteId(tableName);
  const colDefs = columns.map((c) => `${quoteId(c.name)} ${c.type}`).join(", ");
  d.run(`DROP TABLE IF EXISTS ${safeName};`);
  d.run(`CREATE TABLE ${safeName} (${colDefs});`);

  const placeholders = columns.map(() => "?").join(", ");
  const stmt = d.prepare(`INSERT INTO ${safeName} VALUES (${placeholders});`);

  for (const row of rows) {
    const values = columns.map((c) => {
      const raw = row[c.name] ?? "";
      const v = raw.trim();
      if (v === "") return null;

      if (c.type === "BOOLEAN") {
        return /^(true|yes|1)$/i.test(v) ? 1 : 0;
      }

      if (c.type === "INT" || c.type === "BIGINT") {
        const num = parseInt(v, 10);
        return isNaN(num) ? null : num;
      }

      if (isDecimalType(c.type) || c.type === "FLOAT" || c.type === "REAL") {
        const num = parseFloat(v);
        return isNaN(num) ? null : num;
      }

      if (c.type === "DATE" || c.type === "DATETIME") {
        if (isExcelSerialDate(v)) return excelSerialToIso(v);
        return v || null;
      }

      return v || null;
    });
    stmt.run(values);
  }
  stmt.free();
}

export async function createTableFromCsv(
  tableName: string,
  headers: string[],
  rows: RowData[],
  fileName?: string,
): Promise<{ columns: ColumnDef[]; rowCount: number }> {
  const mongo = getAsaMongoDb();

  const columns = inferColumns(headers, rows);

  const now = new Date();
  const meta: DatasetMeta = {
    tableName,
    fileName,
    columns,
    rowCount: rows.length,
    createdAt: now,
    updatedAt: now,
  };

  if (mongo) {
    const existing = await mongo.collection<DatasetMeta>(META_COLLECTION).findOne({ tableName });
    if (existing?.createdAt) meta.createdAt = existing.createdAt;

    await mongo.collection<DatasetMeta>(META_COLLECTION).updateOne(
      { tableName },
      { $set: meta },
      { upsert: true },
    );

    const dataCollection = mongo.collection<RowData>(tableName);
    await dataCollection.deleteMany({});
    if (rows.length > 0) {
      await dataCollection.insertMany(rows.map((row) => ({ ...row })), { ordered: false });
    }
  }

  createSqlTable(tableName, columns, rows);

  return { columns, rowCount: rows.length };
}

async function restoreMongoDatasets(): Promise<void> {
  const mongo = getAsaMongoDb();
  if (!mongo) return;

  const metas = await mongo.collection<DatasetMeta>(META_COLLECTION).find({}).sort({ tableName: 1 }).toArray();
  for (const meta of metas) {
    const docs = await mongo.collection<RowData>(meta.tableName).find({}, { projection: { _id: 0 } }).toArray();
    createSqlTable(meta.tableName, meta.columns, docs);
  }
}

export function mapSqlTypeToCategory(sqlType: string): string {
  if (/^(INT|BIGINT|DECIMAL|FLOAT|REAL|NUMERIC)/i.test(sqlType)) return "number";
  if (/^BOOLEAN/i.test(sqlType)) return "boolean";
  if (/^(DATE|DATETIME|TIMESTAMP)/i.test(sqlType)) return "date";
  return "text";
}

export async function listTables(): Promise<TableSummary[]> {
  const mongo = getAsaMongoDb();
  if (mongo) {
    const metas = await mongo.collection<DatasetMeta>(META_COLLECTION).find({}).sort({ tableName: 1 }).toArray();
    return metas.map((meta) => ({
      name: meta.tableName,
      columnCount: meta.columns.length,
      rowCount: meta.rowCount,
      fileName: meta.fileName,
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt,
    }));
  }

  const d = getDb();
  const tables = d.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;");
  if (!tables.length) return [];
  return tables[0].values.map((row: unknown[]) => {
    const name = row[0] as string;
    const cols = d.exec(`PRAGMA table_info(${quoteId(name)});`);
    const countResult = d.exec(`SELECT COUNT(*) as cnt FROM ${quoteId(name)};`);
    return {
      name,
      columnCount: cols[0]?.values.length ?? 0,
      rowCount: (countResult[0]?.values[0]?.[0] as number) ?? 0,
      fileName: undefined,
      createdAt: undefined,
      updatedAt: undefined,
    };
  });
}

export async function getTableSchema(tableName: string): Promise<ColumnDef[]> {
  const mongo = getAsaMongoDb();
  if (mongo) {
    const meta = await mongo.collection<DatasetMeta>(META_COLLECTION).findOne({ tableName });
    return meta?.columns ?? [];
  }

  const d = getDb();
  const result = d.exec(`PRAGMA table_info(${quoteId(tableName)});`);
  if (!result.length) return [];
  return result[0].values.map((row: unknown[]) => ({
    name: row[1] as string,
    type: row[2] as string,
  }));
}

export function getTableData(
  tableName: string,
  limit = 100,
  offset = 0,
): { columns: string[]; rows: unknown[][] } {
  const d = getDb();
  const colResult = d.exec(`PRAGMA table_info(${quoteId(tableName)});`);
  if (!colResult.length) return { columns: [], rows: [] };
  const columns = colResult[0].values.map((r: unknown[]) => r[1] as string);
  const data = d.exec(`SELECT * FROM ${quoteId(tableName)} LIMIT ${limit} OFFSET ${offset};`);
  return { columns, rows: data[0]?.values ?? [] };
}

export function getTableRowCount(tableName: string): number {
  const d = getDb();
  const result = d.exec(`SELECT COUNT(*) as cnt FROM ${quoteId(tableName)};`);
  return (result[0]?.values[0]?.[0] as number) ?? 0;
}

const forbiddenPatterns = [
  /\bDROP\b/i, /\bALTER\b/i, /\bTRUNCATE\b/i,
  /\bINSERT\b/i, /\bUPDATE\b/i, /\bDELETE\b/i,
  /\bCREATE\b/i, /\bREPLACE\b/i, /\bATTACH\b/i,
  /\bDETACH\b/i, /\bREINDEX\b/i, /\bVACUUM\b/i,
];

export function validateQuery(sql: string): { valid: boolean; error?: string } {
  const trimmed = sql.trim();
  if (!trimmed) return { valid: false, error: "Query is empty." };
  if (!/^\s*SELECT\s/i.test(trimmed)) {
    return { valid: false, error: "Only SELECT queries are allowed." };
  }
  const withoutTrailingSemicolon = trimmed.replace(/;\s*$/, "");
  if (withoutTrailingSemicolon.includes(";")) {
    return { valid: false, error: "Only one SELECT statement is allowed." };
  }
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(trimmed)) {
      return { valid: false, error: "DDL and DML statements are not allowed." };
    }
  }
  return { valid: true };
}

export function executeQuery(sql: string): { columns: string[]; rows: unknown[][] } {
  const d = getDb();
  const result = d.exec(sql);
  if (!result.length) return { columns: [], rows: [] };
  return { columns: result[0].columns, rows: result[0].values };
}

export async function dropTable(tableName: string): Promise<void> {
  const mongo = getAsaMongoDb();
  if (mongo) {
    await mongo.collection<DatasetMeta>(META_COLLECTION).deleteOne({ tableName });
    try {
      await mongo.collection(tableName).drop();
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (!/ns not found/i.test(message)) throw err;
    }
  }

  const d = getDb();
  d.run(`DROP TABLE IF EXISTS ${quoteId(tableName)};`);
}

export async function getTablePreview(tableName: string): Promise<{
  columns: ColumnDef[];
  rows: Record<string, string>[];
  totalRows: number;
} | null> {
  const mongo = getAsaMongoDb();
  if (mongo) {
    const meta = await mongo.collection<DatasetMeta>(META_COLLECTION).findOne({ tableName });
    if (!meta) return null;
    const docs = await mongo.collection<RowData>(tableName).find({}, { projection: { _id: 0 } }).limit(20).toArray();
    return { columns: meta.columns, rows: docs, totalRows: meta.rowCount };
  }

  const d = getDb();
  const colResult = d.exec(`PRAGMA table_info(${quoteId(tableName)});`);
  if (!colResult.length) return null;
  const columns: ColumnDef[] = colResult[0].values.map((r: unknown[]) => ({
    name: r[1] as string,
    type: r[2] as string,
  }));
  const totalRows = getTableRowCount(tableName);
  const data = d.exec(`SELECT * FROM ${quoteId(tableName)} LIMIT 20;`);
  const rows: RowData[] = [];
  if (data.length) {
    const colNames = data[0].columns;
    for (const val of data[0].values) {
      const row: RowData = {};
      colNames.forEach((c, i) => { row[c] = String(val[i] ?? ""); });
      rows.push(row);
    }
  }
  return { columns, rows, totalRows };
}
