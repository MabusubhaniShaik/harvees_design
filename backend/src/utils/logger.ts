import winston from "winston";

type LogLevel = "error" | "warn" | "success" | "info";
type LogContext = Record<string, unknown>;

const SENSITIVE_KEY_PATTERN =
  /pass(word)?|token|secret|authorization|cookie|api[_-]?key/i;
const MAX_STRING_LENGTH = 500;
const MAX_ARRAY_LENGTH = 20;
const MAX_OBJECT_KEYS = 25;
const MAX_DEPTH = 3;

const customLevels = {
  error: 0,
  warn: 1,
  success: 2,
  info: 3,
} as const;

const customColors = {
  error: "red bold",
  warn: "yellow bold",
  success: "green bold",
  info: "blue bold",
} as const;

winston.addColors(customColors);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const truncateString = (value: string): string =>
  value.length > MAX_STRING_LENGTH
    ? `${value.slice(0, MAX_STRING_LENGTH)}...`
    : value;

const sanitizeErrorProperties = (
  error: Error,
  depth: number,
  seen: WeakSet<object>
): LogContext => {
  const enumerableEntries = Object.entries(error).filter(
    ([key]) => !["name", "message", "stack"].includes(key)
  );

  return Object.fromEntries(
    enumerableEntries.slice(0, MAX_OBJECT_KEYS).map(([key, nestedValue]) => [
      key,
      SENSITIVE_KEY_PATTERN.test(key)
        ? "[REDACTED]"
        : sanitizeValue(nestedValue, depth + 1, seen),
    ])
  );
};

const sanitizeValue = (
  value: unknown,
  depth = 0,
  seen = new WeakSet<object>()
): unknown => {
  if (value === null || value === undefined) {
    return value;
  }

  if (value instanceof Error) {
    return serializeError(value, depth, seen);
  }

  if (typeof value === "string") {
    return truncateString(value);
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Buffer.isBuffer(value)) {
    return { type: "Buffer", size: value.length };
  }

  if (Array.isArray(value)) {
    if (depth >= MAX_DEPTH) {
      return `[Array(${value.length})]`;
    }

    return value
      .slice(0, MAX_ARRAY_LENGTH)
      .map((item) => sanitizeValue(item, depth + 1, seen));
  }

  if (isPlainObject(value)) {
    if (seen.has(value)) {
      return "[Circular]";
    }

    if (depth >= MAX_DEPTH) {
      return "[Object]";
    }

    seen.add(value);

    return Object.fromEntries(
      Object.entries(value)
        .slice(0, MAX_OBJECT_KEYS)
        .map(([key, nestedValue]) => [
          key,
          SENSITIVE_KEY_PATTERN.test(key)
            ? "[REDACTED]"
            : sanitizeValue(nestedValue, depth + 1, seen),
        ])
    );
  }

  return String(value);
};

const sanitizeContext = (context?: LogContext): LogContext =>
  isPlainObject(context) ? (sanitizeValue(context) as LogContext) : {};

export const serializeError = (
  error: unknown,
  depth = 0,
  seen = new WeakSet<object>()
) => {
  if (error instanceof Error) {
    if (seen.has(error)) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
        circular: true,
      };
    }

    seen.add(error);
    const additionalContext = sanitizeErrorProperties(error, depth, seen);

    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...additionalContext,
    };
  }

  return sanitizeValue(error);
};

const winstonLogger = winston.createLogger({
  levels: customLevels,
  level: process.env.LOG_LEVEL ?? "info",
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.colorize({ all: true }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metadata = Object.keys(meta).length
            ? ` ${JSON.stringify(meta)}`
            : "";

          return `${timestamp} ${level}: ${message}${metadata}`;
        })
      ),
    }),
  ],
});

type LoggerApi = {
  child: (context: LogContext) => LoggerApi;
  info: (message: string, context?: LogContext) => void;
  success: (message: string, context?: LogContext) => void;
  warn: (message: string, context?: LogContext) => void;
  error: (message: string, context?: LogContext) => void;
};

const createChildLogger = (baseContext: LogContext = {}): LoggerApi => {
  const logAtLevel = (
    level: LogLevel,
    message: string,
    context?: LogContext
  ): void => {
    winstonLogger.log(level, message, {
      ...baseContext,
      ...sanitizeContext(context),
    });
  };

  return {
    child: (context: LogContext) =>
      createChildLogger({ ...baseContext, ...sanitizeContext(context) }),
    info: (message: string, context?: LogContext) =>
      logAtLevel("info", message, context),
    success: (message: string, context?: LogContext) =>
      logAtLevel("success", message, context),
    warn: (message: string, context?: LogContext) =>
      logAtLevel("warn", message, context),
    error: (message: string, context?: LogContext) =>
      logAtLevel("error", message, context),
  };
};

export const logger = createChildLogger({ service: "backend" });

export const summarizePayload = (value: unknown): unknown => sanitizeValue(value);
