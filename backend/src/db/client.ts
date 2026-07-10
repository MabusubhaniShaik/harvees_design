import "../config/env.js";
import mongoose, { createConnection, type Connection, type Mongoose } from "mongoose";
import { logger, serializeError } from "../utils/logger.js";

let mongooseInstance: Mongoose | null = null;
let asaConnection: Connection | null = null;

const buildMongoOptions = (
  rawOptions: string | undefined,
  appName: string | undefined
): string => {
  const searchParams = new URLSearchParams(rawOptions ?? "");

  if (appName) {
    searchParams.set("appName", appName);
  }

  const serializedOptions = searchParams.toString();
  return serializedOptions ? `?${serializedOptions}` : "";
};

const buildMongoUri = ({
  user,
  password,
  host,
  dbName,
  options,
  appName,
}: {
  user?: string;
  password?: string;
  host?: string;
  dbName?: string;
  options?: string;
  appName?: string;
}) => {
  if (!host || !dbName) {
    return null;
  }

  const userPart = user ? encodeURIComponent(user) : "";
  const passPart = password ? `:${encodeURIComponent(password)}` : "";
  const auth = userPart ? `${userPart}${passPart}@` : "";
  const queryString = buildMongoOptions(options, appName ?? user ?? dbName);

  return `mongodb+srv://${auth}${host}/${dbName}${queryString}`;
};

export const initDB = async (): Promise<boolean> => {
  const {
    DB_USER,
    DB_PASSWORD,
    DB_HOST,
    DB_NAME,
    DB_OPTIONS,
    DB_APP_NAME,
    ASA_DB_NAME,
    ASA_DB_APP_NAME,
  } = process.env;

  if (!DB_HOST || !DB_NAME) {
    logger.warn("MongoDB is not configured. Skipping database connection", {
      event: "database.mongo.skipped",
    });
    return false;
  }

  const scaUri = buildMongoUri({
    user: DB_USER,
    password: DB_PASSWORD,
    host: DB_HOST,
    dbName: DB_NAME,
    options: DB_OPTIONS,
    appName: DB_APP_NAME,
  });
  const asaDbName = ASA_DB_NAME ?? "asa-db";
  const asaUri = buildMongoUri({
    user: DB_USER,
    password: DB_PASSWORD,
    host: DB_HOST,
    dbName: asaDbName,
    options: DB_OPTIONS,
    appName: ASA_DB_APP_NAME ?? asaDbName,
  });

  if (!scaUri || !asaUri) {
    logger.warn("MongoDB connection URIs could not be built. Skipping database connection", {
      event: "database.mongo.uri_missing",
    });
    return false;
  }

  try {
    mongooseInstance = mongoose;
    await mongooseInstance.connect(scaUri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });

    asaConnection = createConnection(asaUri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });
    await asaConnection.asPromise();

    logger.success("MongoDB connected successfully", {
      event: "database.mongo.connected",
      scaDbName: DB_NAME,
      asaDbName,
    });
    return true;
  } catch (err) {
    logger.error("MongoDB connection failed", {
      event: "database.mongo.connection_failed",
      error: serializeError(err),
    });
    if (asaConnection) {
      await asaConnection.close().catch(() => undefined);
      asaConnection = null;
    }
    return false;
  }
};

export const disconnectDB = async (): Promise<void> => {
  if (mongooseInstance) {
    await mongooseInstance.disconnect();
    mongooseInstance = null;
  }

  if (asaConnection) {
    await asaConnection.close();
    asaConnection = null;
  }
};

export const getMongoose = (): Mongoose | null => mongooseInstance;

export const getMongoDb = () => mongooseInstance?.connection.db ?? null;

export const getAsaConnection = (): Connection | null => asaConnection;

export const getAsaMongoDb = () => asaConnection?.db ?? null;
