import type { Request, Response } from "express";
import type { Db } from "mongodb";

import { getAsaMongoDb, getMongoDb } from "../db/client.js";
import { getDb } from "../db/asa-db.js";

type ResourceHealth = {
  name: string;
  status: "up" | "down";
  error?: string;
};

type DatabaseHealth = {
  status: "up" | "down";
  resources: ResourceHealth[];
  error?: string;
};

const errorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error);
};

const checkMongoDatabase = async (database: Db | null): Promise<DatabaseHealth> => {
  if (!database) {
    return {
      status: "down",
      resources: [],
      error: "Database connection is not initialized",
    };
  }

  try {
    await database.command({ ping: 1 });
    const collections = await database.listCollections({}, { nameOnly: true }).toArray();
    const resources = await Promise.all(
      collections.map(async ({ name }): Promise<ResourceHealth> => {
        try {
          await database.collection(name).findOne({}, { projection: { _id: 1 } });
          return { name, status: "up" };
        } catch (error) {
          return { name, status: "down", error: errorMessage(error) };
        }
      }),
    );

    return {
      status: resources.some(({ status }) => status === "down") ? "down" : "up",
      resources,
    };
  } catch (error) {
    return { status: "down", resources: [], error: errorMessage(error) };
  }
};

const quoteSqliteIdentifier = (identifier: string): string =>
  `"${identifier.replace(/"/g, '""')}"`;

const checkSqliteDatabase = (): DatabaseHealth => {
  try {
    const database = getDb();
    database.exec("SELECT 1;");
    const result = database.exec(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name;",
    );
    const tableNames = result[0]?.values.map(([name]) => String(name)) ?? [];
    const resources = tableNames.map((name): ResourceHealth => {
      try {
        database.exec(`SELECT 1 FROM ${quoteSqliteIdentifier(name)} LIMIT 1;`);
        return { name, status: "up" };
      } catch (error) {
        return { name, status: "down", error: errorMessage(error) };
      }
    });

    return {
      status: resources.some(({ status }) => status === "down") ? "down" : "up",
      resources,
    };
  } catch (error) {
    return { status: "down", resources: [], error: errorMessage(error) };
  }
};

export const healthCheck = async (_request: Request, response: Response): Promise<void> => {
  const startedAt = Date.now();
  const [scaMongo, asaMongo] = await Promise.all([
    checkMongoDatabase(getMongoDb()),
    checkMongoDatabase(getAsaMongoDb()),
  ]);
  const asaSqlite = checkSqliteDatabase();
  const databases = { scaMongo, asaMongo, asaSqlite };
  const isHealthy = Object.values(databases).every(({ status }) => status === "up");

  response.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    responseTimeMs: Date.now() - startedAt,
    uptimeSeconds: Math.floor(process.uptime()),
    databases,
  });
};
