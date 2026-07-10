import dotenv from "dotenv";
import { existsSync } from "node:fs";
import path from "node:path";

const resolveEnvPath = (): string | undefined => {
  const isProduction = process.env.NODE_ENV === "production";
  const candidatePaths = [
    isProduction
      ? path.resolve(process.cwd(), ".env.production")
      : path.resolve(process.cwd(), ".env"),
    isProduction
      ? path.resolve(process.cwd(), "backend/.env.production")
      : path.resolve(process.cwd(), "backend/.env"),
  ];

  return candidatePaths.find((candidatePath) => existsSync(candidatePath));
};

const envPath = resolveEnvPath();

dotenv.config(envPath ? { path: envPath } : undefined);
