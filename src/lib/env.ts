import { readFileSync } from "node:fs";

type SslMode = "disable" | "preferred" | "require" | "verify-ca" | "verify-full";

interface ParsedDatabaseUrl {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  sslmode: SslMode;
}

export interface AppEnv {
  DATABASE_URL: string;
  APP_SECRET: string;
  APP_URL?: string;
  DATABASE_SSL_CA_FILE?: string;
  parsedDb: ParsedDatabaseUrl;
  nodeEnv: string;
  port: number;
}

function parseDatabaseUrl(url: string): ParsedDatabaseUrl {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(
      "Invalid DATABASE_URL format. Expected: mysql://user:password@host:port/database?sslmode=xxx"
    );
  }

  if (parsed.protocol !== "mysql:") {
    throw new Error(
      `Invalid DATABASE_URL protocol "${parsed.protocol}". Expected "mysql:".`
    );
  }

  const database = parsed.pathname.replace(/^\//, "");
  if (!parsed.hostname || !database) {
    throw new Error(
      "Invalid DATABASE_URL: host and database name are required"
    );
  }

  const sslmode = (parsed.searchParams.get("sslmode") as SslMode) || "preferred";

  const validModes: SslMode[] = [
    "disable",
    "preferred",
    "require",
    "verify-ca",
    "verify-full",
  ];
  if (!validModes.includes(sslmode)) {
    throw new Error(
      `Invalid sslmode "${sslmode}". Must be one of: ${validModes.join(", ")}`
    );
  }

  return {
    host: parsed.hostname,
    port: parsed.port ? parseInt(parsed.port, 10) : 3306,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database,
    sslmode,
  };
}

export function loadEnv(): AppEnv {
  const databaseUrl = process.env.DATABASE_URL;
  const appSecret = process.env.APP_SECRET;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  if (!appSecret) {
    throw new Error("APP_SECRET environment variable is required");
  }

  if (appSecret.length < 16) {
    throw new Error("APP_SECRET must be at least 16 characters long");
  }

  const parsedDb = parseDatabaseUrl(databaseUrl);

  return {
    DATABASE_URL: databaseUrl,
    APP_SECRET: appSecret,
    APP_URL: process.env.APP_URL,
    DATABASE_SSL_CA_FILE: process.env.DATABASE_SSL_CA_FILE,
    parsedDb,
    nodeEnv: process.env.NODE_ENV || "development",
    port: parseInt(process.env.PORT || "3000", 10),
  };
}

export function getSslConfig(env: AppEnv) {
  if (env.parsedDb.sslmode === "disable") {
    return undefined;
  }

  const sslConfig: Record<string, unknown> = {
    rejectUnauthorized: env.parsedDb.sslmode === "verify-full" || env.parsedDb.sslmode === "verify-ca",
  };

  if (env.DATABASE_SSL_CA_FILE) {
    try {
      sslConfig.ca = readFileSync(env.DATABASE_SSL_CA_FILE);
    } catch (err) {
      throw new Error(
        `Failed to read DATABASE_SSL_CA_FILE at "${env.DATABASE_SSL_CA_FILE}": ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  return sslConfig;
}
