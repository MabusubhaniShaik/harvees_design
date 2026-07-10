import type XLSX from "xlsx";
import Papa from "papaparse";

export const REQUIRED_DATASET_FILE_NAME = "ecommerce_sales_data.xlsx";
export const REQUIRED_TABLE_NAME = "ecommerce_sales_data";

export const sanitizeTableName = (fileName: string): string => {
  if (fileName.toLowerCase() === REQUIRED_DATASET_FILE_NAME) {
    return REQUIRED_TABLE_NAME;
  }

  return (
    fileName
      .replace(/\.(csv|xlsx?)$/i, "")
      .replace(/[^a-zA-Z0-9_]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "")
      .toLowerCase()
      .slice(0, 60) || "dataset"
  );
};

export const validateRequiredDataset = (file: Express.Multer.File): void => {
  if (file.originalname.toLowerCase() !== REQUIRED_DATASET_FILE_NAME) {
    throw Object.assign(
      new Error(
        `Only ${REQUIRED_DATASET_FILE_NAME} is supported for this sales analytics flow.`
      ),
      { statusCode: 400 }
    );
  }
};

const exportTimestamp = (): string => {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");

  return (
    [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join("") +
    "_" +
    [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())].join("")
  );
};

export const exportFilename = (
  name: string,
  ext: "xlsx" | "pdf"
): string => `${name}_${exportTimestamp()}.${ext}`;

const sanitizeColumnName = (name: string, index: number): string => {
  const cleaned = name
    .trim()
    .replace(/^\uFEFF/, "")
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

  return cleaned || `column_${index + 1}`;
};

const normalizeHeaders = (
  headers: string[]
): { headers: string[]; sourceToSafe: Map<string, string> } => {
  const seen = new Map<string, number>();
  const sourceToSafe = new Map<string, string>();
  const safeHeaders = headers.map((header, index) => {
    const base = sanitizeColumnName(header, index);
    const count = seen.get(base.toLowerCase()) ?? 0;
    seen.set(base.toLowerCase(), count + 1);
    const safe = count === 0 ? base : `${base}_${count + 1}`;
    sourceToSafe.set(header, safe);
    return safe;
  });

  return { headers: safeHeaders, sourceToSafe };
};

const toStr = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

const parseCsvBuffer = (
  file: Express.Multer.File
): Record<string, unknown>[] => {
  const content = file.buffer.toString("utf-8");
  const parsed = Papa.parse(content, { header: true, skipEmptyLines: true });

  return parsed.data as Record<string, unknown>[];
};

const parseSpreadsheetBuffer = (
  file: Express.Multer.File,
  xlsx: typeof XLSX
): Record<string, unknown>[] => {
  const workbook = xlsx.read(file.buffer, { type: "buffer" });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];

  if (!worksheet) {
    return [];
  }

  return xlsx.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: "",
  });
};

export const parseFileBuffer = (
  file: Express.Multer.File,
  xlsx: typeof XLSX
): { headers: string[]; rows: Record<string, string>[] } => {
  const name = file.originalname.toLowerCase();
  let json: Record<string, unknown>[];

  if (name.endsWith(".csv")) {
    json = parseCsvBuffer(file);
  } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    json = parseSpreadsheetBuffer(file, xlsx);
  } else {
    throw new Error("Unsupported file type. Upload a CSV, XLSX, or XLS file.");
  }

  const rawHeaders = json.length > 0 ? Object.keys(json[0]) : [];
  const { headers, sourceToSafe } = normalizeHeaders(rawHeaders);
  const rows = json.map((row) => {
    const normalized: Record<string, string> = {};

    for (const key of rawHeaders) {
      const safeKey = sourceToSafe.get(key) ?? key;
      normalized[safeKey] = toStr(row[key]);
    }

    return normalized;
  });

  return { headers, rows };
};
