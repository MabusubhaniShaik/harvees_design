import { generateGeminiText, getGeminiConfig } from "./gemini-client.js";
import { getAsaQueryHistory } from "./asa-ai.service.js";
import { executeQuery, getTableSchema, listTables, mapSqlTypeToCategory } from "../db/asa-db.js";
import { logger, serializeError } from "../utils/logger.js";

const REQUIRED_DATASET_TABLE = "ecommerce_sales_data";

type DashboardMetric = {
  label: string;
  value: number | string;
  helper: string;
};

type DashboardSeriesPoint = {
  label: string;
  value: number;
};

type DashboardTableSummary = {
  tableName: string;
  fileName?: string;
  rowCount: number;
  columnCount: number;
  createdAt?: Date;
  updatedAt?: Date;
};

type DashboardSummary = {
  useCase: "ecommerce";
  metrics: DashboardMetric[];
  insights: string[];
  primaryDataset: {
    tableName: string;
    fileName?: string;
    rowCount: number;
    columnCount: number;
    createdAt?: Date;
    updatedAt?: Date;
    columns: Array<{ name: string; type: string; category: string }>;
  } | null;
  charts: {
    rowsByTable: DashboardSeriesPoint[];
    schemaTypes: DashboardSeriesPoint[];
    monthlyRevenue: DashboardSeriesPoint[];
    revenueByCategory: DashboardSeriesPoint[];
    paymentMethodMix: DashboardSeriesPoint[];
    orderStatusMix: DashboardSeriesPoint[];
  };
  queryHistory: Awaited<ReturnType<typeof getAsaQueryHistory>>;
  tables: DashboardTableSummary[];
};

const ECOMMERCE_COLUMN_HINTS = ["order_id", "order_date", "customer_id", "revenue", "category"];

const quoteId = (value: string) => `"${value.replace(/"/g, '""')}"`;

const parseNumber = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const rowsToSeries = (rows: unknown[][]): DashboardSeriesPoint[] =>
  rows.map((row) => ({
    label: String(row[0] ?? ""),
    value: parseNumber(row[1]),
  }));

const findColumnName = (
  columns: Array<{ name: string; type: string }>,
  patterns: RegExp[],
  typePatterns?: RegExp[],
) =>
  columns.find((column) => {
    const matchesName = patterns.some((pattern) => pattern.test(column.name));
    const matchesType = !typePatterns || typePatterns.some((pattern) => pattern.test(column.type));
    return matchesName && matchesType;
  })?.name;

const buildFallbackInsights = (summary: {
  topMonth?: DashboardSeriesPoint;
  topCategory?: DashboardSeriesPoint;
  topPaymentMethod?: DashboardSeriesPoint;
  returnRate?: number;
  totalRevenue?: number;
  totalOrders?: number;
  totalCustomers?: number;
}) => {
  const insights: string[] = [];

  if (summary.topMonth) {
    insights.push(
      `${summary.topMonth.label} generated the highest revenue at ${summary.topMonth.value.toLocaleString("en-IN")}.`
    );
  }

  if (summary.topCategory) {
    insights.push(
      `${summary.topCategory.label} is the top revenue category with ${summary.topCategory.value.toLocaleString("en-IN")}.`
    );
  }

  if (summary.returnRate !== undefined) {
    insights.push(`Return rate is ${summary.returnRate.toFixed(1)}% across uploaded orders.`);
  }

  if (insights.length < 3 && summary.topPaymentMethod) {
    insights.push(`${summary.topPaymentMethod.label} is the most used payment method.`);
  }

  if (insights.length < 3 && summary.totalRevenue !== undefined && summary.totalOrders !== undefined) {
    insights.push(
      `${summary.totalOrders} orders from ${summary.totalCustomers ?? 0} customers generated ${summary.totalRevenue.toLocaleString("en-IN")} in revenue.`
    );
  }

  return insights.slice(0, 3);
};

async function generateAiInsights(summary: {
  tableName: string;
  totalRevenue: number;
  totalOrders: number;
  totalCustomers: number;
  topMonth?: DashboardSeriesPoint;
  topCategory?: DashboardSeriesPoint;
  topPaymentMethod?: DashboardSeriesPoint;
  returnRate: number;
}): Promise<string[] | null> {
  const config = getGeminiConfig();
  if (!config.enabled) return null;

  try {
    const prompt = [
      "You are writing short ecommerce analytics insights.",
      "Return plain JSON only in this shape: {\"insights\":[\"...\",\"...\",\"...\"]}.",
      "Each insight must be under 18 words.",
      "Do not mention models, SQL, or implementation.",
      JSON.stringify(summary),
    ].join("\n");

    const response = await generateGeminiText(prompt);
    const match = response.text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as { insights?: unknown };
    if (!Array.isArray(parsed.insights)) return null;

    return parsed.insights
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .slice(0, 3);
  } catch (error) {
    logger.warn("ASA dashboard AI insights generation failed. Falling back to deterministic insights", {
      event: "asa.dashboard.ai_insights_fallback",
      error: serializeError(error),
    });
    return null;
  }
}

export async function getAsaDashboardSummary(): Promise<DashboardSummary> {
  const [tables, queryHistory] = await Promise.all([listTables(), getAsaQueryHistory()]);
  const tableSummaries: DashboardTableSummary[] = tables.map((table) => ({
    tableName: table.name,
    fileName: table.fileName,
    rowCount: table.rowCount,
    columnCount: table.columnCount,
    createdAt: table.createdAt,
    updatedAt: table.updatedAt,
  }));

  const rowsByTable = tableSummaries.map((table) => ({
    label: table.tableName,
    value: table.rowCount,
  }));

  const schemaAccumulator: Record<string, number> = {};
  for (const table of tableSummaries) {
    const columns = await getTableSchema(table.tableName);
    for (const column of columns) {
      const category = mapSqlTypeToCategory(column.type);
      schemaAccumulator[category] = (schemaAccumulator[category] ?? 0) + 1;
    }
  }

  const schemaTypes = Object.entries(schemaAccumulator).map(([label, value]) => ({
    label,
    value,
  }));

  const preferredTable =
    tableSummaries.find((table) => table.tableName === REQUIRED_DATASET_TABLE) ??
    tableSummaries.find((table) => table.fileName?.toLowerCase() === "ecommerce_sales_data.xlsx") ??
    [...tableSummaries].sort((left, right) => right.rowCount - left.rowCount)[0];

  if (!preferredTable) {
    return {
      useCase: "ecommerce",
      metrics: [
        { label: "Tables", value: 0, helper: "Supported sales datasets" },
        { label: "Rows", value: 0, helper: "Persisted records" },
        { label: "Columns", value: 0, helper: "Detected fields" },
        { label: "AI Queries", value: queryHistory.length, helper: "Saved query history" },
      ],
      insights: ["Upload ecommerce_sales_data.xlsx to generate sales analytics, insights, and validated SQL results."],
      primaryDataset: null,
      charts: {
        rowsByTable,
        schemaTypes,
        monthlyRevenue: [],
        revenueByCategory: [],
        paymentMethodMix: [],
        orderStatusMix: [],
      },
      queryHistory,
      tables: tableSummaries,
    };
  }

  const primaryColumns = await getTableSchema(preferredTable.tableName);
  const primaryDataset = {
    ...preferredTable,
    columns: primaryColumns.map((column) => ({
      name: column.name,
      type: column.type,
      category: mapSqlTypeToCategory(column.type),
    })),
  };

  const useCase = "ecommerce";

  const orderIdColumn = findColumnName(primaryColumns, [/^order_id$/i, /order.*id/i]);
  const orderDateColumn = findColumnName(primaryColumns, [/^order_date$/i, /order.*date/i, /date/i]);
  const customerIdColumn = findColumnName(primaryColumns, [/^customer_id$/i, /customer.*id/i, /client.*id/i]);
  const revenueColumn = findColumnName(primaryColumns, [/^revenue$/i, /sales/i, /amount/i, /total/i], [
    /DECIMAL/i,
    /INT/i,
    /BIGINT/i,
    /FLOAT/i,
    /REAL/i,
  ]);
  const categoryColumn = findColumnName(primaryColumns, [/^category$/i, /product.*category/i]);
  const paymentMethodColumn = findColumnName(primaryColumns, [/^payment_method$/i, /payment/i, /method/i]);
  const orderStatusColumn = findColumnName(primaryColumns, [/^order_status$/i, /status/i]);
  const returnedColumn = findColumnName(primaryColumns, [/^is_returned$/i, /return/i, /refund/i]);

  if (!orderIdColumn || !orderDateColumn || !customerIdColumn || !revenueColumn || !categoryColumn) {
    const totalRows = tableSummaries.reduce((sum, table) => sum + table.rowCount, 0);
    const totalColumns = tableSummaries.reduce((sum, table) => sum + table.columnCount, 0);

    return {
      useCase,
      metrics: [
        { label: "Tables", value: tableSummaries.length, helper: "Supported sales datasets" },
        { label: "Rows", value: totalRows, helper: "Persisted records" },
        { label: "Columns", value: totalColumns, helper: "Detected fields" },
        { label: "AI Queries", value: queryHistory.length, helper: "Saved assistant history" },
      ],
      insights: [
        `The dataset table "${preferredTable.tableName}" is loaded but required sales columns were not fully matched.`,
        "Re-upload ecommerce_sales_data.xlsx to refresh the detected schema.",
        `${queryHistory.length} validated assistant quer${queryHistory.length === 1 ? "y has" : "ies have"} been saved to history.`,
      ],
      primaryDataset,
      charts: {
        rowsByTable,
        schemaTypes,
        monthlyRevenue: [],
        revenueByCategory: [],
        paymentMethodMix: [],
        orderStatusMix: [],
      },
      queryHistory,
      tables: tableSummaries,
    };
  }

  const tableName = quoteId(preferredTable.tableName);
  const totals = executeQuery(
    [
      "SELECT",
      "COUNT(*) AS total_rows,",
      `COUNT(DISTINCT ${quoteId(orderIdColumn)}) AS total_orders,`,
      `COUNT(DISTINCT ${quoteId(customerIdColumn)}) AS total_customers,`,
      `ROUND(COALESCE(SUM(${quoteId(revenueColumn)}), 0), 2) AS total_revenue,`,
      `ROUND(COALESCE(AVG(${quoteId(revenueColumn)}), 0), 2) AS avg_order_value,`,
      returnedColumn
        ? `SUM(CASE WHEN LOWER(CAST(${quoteId(returnedColumn)} AS TEXT)) IN ('1','true','yes') THEN 1 ELSE 0 END) AS returned_orders`
        : "0 AS returned_orders",
      `FROM ${tableName};`,
    ].join(" ")
  );

  const totalsRow = totals.rows[0] ?? [];
  const totalOrders = parseNumber(totalsRow[1]);
  const totalCustomers = parseNumber(totalsRow[2]);
  const totalRevenue = parseNumber(totalsRow[3]);
  const avgOrderValue = parseNumber(totalsRow[4]);
  const returnedOrders = parseNumber(totalsRow[5]);
  const returnRate = totalOrders > 0 ? (returnedOrders / totalOrders) * 100 : 0;

  const monthlyRevenue = rowsToSeries(
    executeQuery(
      `SELECT substr(CAST(${quoteId(orderDateColumn)} AS TEXT), 1, 7) AS month, ROUND(SUM(${quoteId(revenueColumn)}), 2) AS revenue
       FROM ${tableName}
       WHERE ${quoteId(orderDateColumn)} IS NOT NULL AND TRIM(CAST(${quoteId(orderDateColumn)} AS TEXT)) <> ''
       GROUP BY substr(CAST(${quoteId(orderDateColumn)} AS TEXT), 1, 7)
       ORDER BY revenue DESC
       LIMIT 6;`
    ).rows
  );
  const revenueByCategory = rowsToSeries(
    executeQuery(
      `SELECT ${quoteId(categoryColumn)}, ROUND(SUM(${quoteId(revenueColumn)}), 2) AS revenue
       FROM ${tableName}
       GROUP BY ${quoteId(categoryColumn)}
       ORDER BY revenue DESC
       LIMIT 6;`
    ).rows
  );
  const paymentMethodMix = rowsToSeries(
    paymentMethodColumn
      ? executeQuery(
      `SELECT ${quoteId(paymentMethodColumn)}, COUNT(*) AS orders
       FROM ${tableName}
       GROUP BY ${quoteId(paymentMethodColumn)}
       ORDER BY orders DESC
       LIMIT 6;`
    ).rows
      : []
  );
  const orderStatusMix = rowsToSeries(
    orderStatusColumn
      ? executeQuery(
      `SELECT ${quoteId(orderStatusColumn)}, COUNT(*) AS orders
       FROM ${tableName}
       GROUP BY ${quoteId(orderStatusColumn)}
       ORDER BY orders DESC
       LIMIT 6;`
    ).rows
      : []
  );

  const aiInsights =
    (await generateAiInsights({
      tableName: preferredTable.tableName,
      totalRevenue,
      totalOrders,
      totalCustomers,
      topMonth: monthlyRevenue[0],
      topCategory: revenueByCategory[0],
      topPaymentMethod: paymentMethodMix[0],
      returnRate,
    })) ??
    buildFallbackInsights({
      topMonth: monthlyRevenue[0],
      topCategory: revenueByCategory[0],
      topPaymentMethod: paymentMethodMix[0],
      returnRate,
      totalRevenue,
      totalOrders,
      totalCustomers,
    });

  return {
    useCase: "ecommerce",
    metrics: [
      { label: "Orders", value: totalOrders, helper: "Distinct uploaded orders" },
      { label: "Revenue", value: totalRevenue.toLocaleString("en-IN"), helper: "Gross revenue tracked" },
      { label: "Customers", value: totalCustomers, helper: "Unique customer accounts" },
      { label: "Avg Order", value: avgOrderValue.toLocaleString("en-IN"), helper: "Average revenue per order" },
      { label: "Returns", value: returnedOrders, helper: `${returnRate.toFixed(1)}% return rate` },
      { label: "AI Queries", value: queryHistory.length, helper: "Saved assistant history" },
    ],
    insights: aiInsights,
    primaryDataset,
    charts: {
      rowsByTable,
      schemaTypes,
      monthlyRevenue,
      revenueByCategory,
      paymentMethodMix,
      orderStatusMix,
    },
    queryHistory,
    tables: tableSummaries,
  };
}
