import "./config/env.js";
import express from "express";
import { json } from "express";
import cors from "cors";
import { createServer } from "node:http";
import scaRouter from "./routes/sca.routes.js";
import asaRouter from "./routes/asa.routes.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { requestLogger } from "./middlewares/requestLogger.js";
import { initDB } from "./db/client.js";
import { initAsaDb } from "./db/asa-db.js";
import { registerScaSchemas, registerAsaSchemas } from "./schemas/index.js";
import { logger, serializeError } from "./utils/logger.js";

const app = express();
app.use(cors());
app.use(json({ limit: "10mb" }));
app.use(requestLogger);

const SCA_BASE_PATH = process.env.SCA_API_PATH ?? "/api/sca";
const ASA_BASE_PATH = process.env.ASA_API_PATH ?? "/api/asa";

app.use("/", scaRouter);
app.use(SCA_BASE_PATH, scaRouter);
app.use(ASA_BASE_PATH, asaRouter);

app.use(errorHandler);

const PORT = process.env.PORT ?? 3000;
const server = createServer(app);

(async () => {
  const isDbConnected = await initDB();

  if (isDbConnected) {
    const scaSchemaRegistration = registerScaSchemas();
    logger.success("SCA database schemas registered", {
      event: "server.database.status",
      status: "connected",
      collections: scaSchemaRegistration.registeredCollections,
      changedCollections: scaSchemaRegistration.changedCollections,
      skippedCollections: scaSchemaRegistration.skippedCollections,
    });
  } else {
    logger.warn("Database status resolved", {
      event: "server.database.status",
      status: "disconnected_or_not_configured",
    });
  }

  try {
    await initAsaDb();
    const asaSchemaRegistration = registerAsaSchemas();
    logger.success("ASA database schemas registered", {
      event: "server.asa_db.initialized",
      collections: asaSchemaRegistration.registeredCollections,
      changedCollections: asaSchemaRegistration.changedCollections,
      skippedCollections: asaSchemaRegistration.skippedCollections,
    });
  } catch (err) {
    logger.error("Failed to initialize ASA database", {
      event: "server.asa_db.initialization_failed",
      error: serializeError(err),
    });
  }

  server.listen(PORT, () => {
    logger.success("Server listening", {
      event: "server.started",
      port: PORT,
    });
  });
})();

server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    logger.error("Port already in use", {
      event: "server.port_conflict",
      port: PORT,
      error: serializeError(error),
    });
    process.exit(1);
  }

  logger.error("Server startup failed", {
    event: "server.startup_failed",
    port: PORT,
    error: serializeError(error),
  });
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception", {
    event: "process.uncaught_exception",
    error: serializeError(error),
  });
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", {
    event: "process.unhandled_rejection",
    error: serializeError(reason),
  });
});
