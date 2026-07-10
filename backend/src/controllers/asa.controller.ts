import type { Request, Response, NextFunction } from "express";
import * as XLSX from "xlsx";
import {
  createTableFromCsv,
  listTables,
  getTableSchema,
  validateQuery,
  executeQuery,
  dropTable,
  getTablePreview,
  inferColumns,
  mapSqlTypeToCategory,
} from "../db/asa-db.ts";
import { getAsaDashboardSummary } from "../ai/asa-dashboard.service.ts";
import {
  exportFilename,
  parseFileBuffer,
  REQUIRED_TABLE_NAME,
  sanitizeTableName,
  validateRequiredDataset,
} from "../helpers/asa-controller.helper.ts";
import { logger, serializeError } from "../utils/logger.ts";

export async function uploadCsv(req: Request, res: Response, next: NextFunction) {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "No file uploaded." });
      return;
    }
    validateRequiredDataset(file);

    const { headers, rows } = parseFileBuffer(file, XLSX);

    if (!headers || headers.length === 0) {
      res.status(400).json({ error: "No columns detected. Ensure the file has a header row." });
      return;
    }

    const tableName = sanitizeTableName(file.originalname);
    const previewRows = rows.slice(0, 20);
    const { columns, rowCount } = await createTableFromCsv(tableName, headers, rows, file.originalname);

    logger.success("ASA dataset uploaded and table created", {
      event: "api.asa.dataset_uploaded",
      requestId: res.locals.requestId,
      api: req.originalUrl,
      fileName: file.originalname,
      tableName,
      rowCount,
      columnCount: columns.length,
    });

    res.json({
      tableName,
      fileName: file.originalname,
      rowCount,
      columnCount: columns.length,
      rows: previewRows,
      totalRows: rowCount,
      columns: columns.map((c) => ({
        name: c.name,
        type: c.type,
        category: mapSqlTypeToCategory(c.type),
      })),
    });
  } catch (err) {
    next(err);
  }
}

export async function detectDataset(req: Request, res: Response, next: NextFunction) {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "No file uploaded." });
      return;
    }
    validateRequiredDataset(file);

    const { headers, rows } = parseFileBuffer(file, XLSX);

    if (!headers || headers.length === 0) {
      res.status(400).json({ error: "No columns detected. Ensure the file has a header row." });
      return;
    }

    const tableName = sanitizeTableName(file.originalname);
    const columns = inferColumns(headers, rows);

    logger.success("ASA dataset schema detected", {
      event: "api.asa.dataset_detected",
      requestId: res.locals.requestId,
      api: req.originalUrl,
      fileName: file.originalname,
      tableName,
      rowCount: rows.length,
      columnCount: columns.length,
    });

    res.json({
      tableName,
      fileName: file.originalname,
      rowCount: rows.length,
      columnCount: columns.length,
      rows: rows.slice(0, 20),
      totalRows: rows.length,
      columns: columns.map((c) => ({
        name: c.name,
        type: c.type,
        category: mapSqlTypeToCategory(c.type),
      })),
    });
  } catch (err) {
    next(err);
  }
}

export async function listAllTables(_req: Request, res: Response, next: NextFunction) {
  try {
    const tables = (await listTables()).filter((table) => table.name === REQUIRED_TABLE_NAME);
    const detailed = await Promise.all(tables.map(async (t) => {
      const schema = await getTableSchema(t.name);
      return {
        tableName: t.name,
        fileName: t.fileName,
        columnCount: t.columnCount,
        rowCount: t.rowCount,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        columns: schema.map((c) => ({
          name: c.name,
          type: c.type,
          category: mapSqlTypeToCategory(c.type),
        })),
      };
    }));
    logger.info("ASA tables listed", {
      event: "api.asa.tables_listed",
      requestId: res.locals.requestId,
      api: _req.originalUrl,
      tableCount: detailed.length,
    });
    res.json(detailed);
  } catch (err) {
    next(err);
  }
}

export async function getTableDetails(req: Request, res: Response, next: NextFunction) {
  try {
    const { tableName } = req.params;
    if (tableName !== REQUIRED_TABLE_NAME) {
      res.status(404).json({ error: `Only "${REQUIRED_TABLE_NAME}" is available in this sales analytics flow.` });
      return;
    }
    const preview = await getTablePreview(tableName);
    if (!preview) {
      res.status(404).json({ error: `Table "${tableName}" not found.` });
      return;
    }
    logger.info("ASA table details fetched", {
      event: "api.asa.table_details",
      requestId: res.locals.requestId,
      api: req.originalUrl,
      tableName,
      totalRows: preview.totalRows,
      columnCount: preview.columns.length,
    });
    res.json({
      tableName,
      columns: preview.columns.map((c) => ({
        name: c.name,
        type: c.type,
        category: mapSqlTypeToCategory(c.type),
      })),
      rows: preview.rows,
      totalRows: preview.totalRows,
    });
  } catch (err) {
    next(err);
  }
}

export async function getDashboardSummary(_req: Request, res: Response, next: NextFunction) {
  try {
    const summary = await getAsaDashboardSummary();
    logger.success("ASA dashboard summary generated", {
      event: "api.asa.dashboard_summary",
      requestId: res.locals.requestId,
      api: _req.originalUrl,
      tableCount: summary.tables.length,
      queryHistoryCount: summary.queryHistory.length,
    });
    res.json(summary);
  } catch (err) {
    next(err);
  }
}

export async function deleteTable(req: Request, res: Response, next: NextFunction) {
  try {
    const { tableName } = req.params;
    if (tableName !== REQUIRED_TABLE_NAME) {
      res.status(404).json({ error: `Only "${REQUIRED_TABLE_NAME}" is available in this sales analytics flow.` });
      return;
    }
    await dropTable(tableName);
    logger.warn("ASA table deleted", {
      event: "api.asa.table_deleted",
      requestId: res.locals.requestId,
      api: req.originalUrl,
      tableName,
    });
    res.json({ message: `Table "${tableName}" deleted.` });
  } catch (err) {
    next(err);
  }
}

export async function queryTable(req: Request, res: Response, next: NextFunction) {
  try {
    const { sql } = req.body as { sql?: string };
    if (!sql) {
      res.status(400).json({ error: "SQL query is required." });
      return;
    }

    const validation = validateQuery(sql);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const result = executeQuery(sql);
    logger.success("ASA SQL query executed", {
      event: "api.asa.query_executed",
      requestId: res.locals.requestId,
      api: req.originalUrl,
      rowCount: result.rows.length,
      columnCount: result.columns.length,
      sql,
    });
    res.json({ columns: result.columns, rows: result.rows, rowCount: result.rows.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Query execution failed.";
    logger.warn("ASA SQL query rejected", {
      event: "api.asa.query_rejected",
      requestId: res.locals.requestId,
      api: req.originalUrl,
      error: serializeError(err),
    });
    res.status(400).json({ error: msg });
  }
}

export async function exportExcel(req: Request, res: Response, next: NextFunction) {
  try {
    const { sql } = req.body as { sql?: string };
    const query = sql || "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;";

    const validation = validateQuery(query);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const result = executeQuery(query);
    if (!result.columns.length) {
      res.status(400).json({ error: "Query returned no data." });
      return;
    }

    const data = result.rows.map((row) => {
      const obj: Record<string, unknown> = {};
      result.columns.forEach((col, i) => { obj[col] = row[i]; });
      return obj;
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Results");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    logger.success("ASA Excel export generated", {
      event: "api.asa.export_excel",
      requestId: res.locals.requestId,
      api: req.originalUrl,
      rowCount: result.rows.length,
      columnCount: result.columns.length,
      sql: query,
    });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=${exportFilename("query-results", "xlsx")}`);
    res.send(buf);
  } catch (err) {
    next(err);
  }
}

export async function exportPdf(_req: Request, res: Response) {
  try {
    const { jsPDF } = await import("jspdf");
    const { autoTable } = await import("jspdf-autotable");

    const tables = await listTables();
    const doc = new jsPDF({ orientation: "landscape" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const generatedAt = new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date());

    doc.setFontSize(16);
    doc.text("ASA Dataset Export", 14, 16);
    doc.setFontSize(9);
    doc.text(`Generated: ${generatedAt}`, pageWidth - 14, 16, { align: "right" });

    autoTable(doc, {
      head: [["Table", "Rows", "Columns"]],
      body: tables.map((table) => [
        table.name,
        String(table.rowCount),
        String(table.columnCount),
      ]),
      startY: 24,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [31, 41, 55], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    let cursorY = ((doc as any).lastAutoTable?.finalY ?? 24) + 12;

    for (const table of tables) {
      const minTableSpace = 44;
      if (cursorY + minTableSpace > pageHeight - 14) {
        doc.addPage();
        cursorY = 16;
      }

      doc.setFontSize(13);
      doc.text(table.name, 14, cursorY);
      doc.setFontSize(9);
      doc.text(`${table.rowCount} rows  |  ${table.columnCount} columns`, 14, cursorY + 6);

      const schema = await getTableSchema(table.name);
      const schemaHeaders = [["#", "Column", "Type"]];
      const schemaRows = schema.map((c, i) => [String(i + 1), c.name, c.type]);

      autoTable(doc, {
        head: schemaHeaders,
        body: schemaRows,
        startY: cursorY + 12,
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [31, 41, 55], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { top: 14, right: 14, bottom: 14, left: 14 },
        pageBreak: "auto",
        rowPageBreak: "avoid",
      });

      cursorY = ((doc as any).lastAutoTable?.finalY ?? cursorY + 12) + 12;
    }

    const buf = Buffer.from(doc.output("arraybuffer"));
    logger.success("ASA PDF export generated", {
      event: "api.asa.export_pdf",
      requestId: res.locals.requestId,
      api: _req.originalUrl,
      tableCount: tables.length,
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=${exportFilename("asa-dashboard", "pdf")}`);
    res.send(buf);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "PDF export failed.";
    logger.error("ASA PDF export failed", {
      event: "api.asa.export_pdf_failed",
      requestId: res.locals.requestId,
      api: _req.originalUrl,
      error: serializeError(err),
    });
    res.status(500).json({ error: msg });
  }
}
