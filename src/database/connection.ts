import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { getEnv, getDatabaseSslConfig } from "@/lib/config";
import type { MySql2Database } from "drizzle-orm/mysql2";

let _pool: mysql.Pool | null = null;
let _db: MySql2Database | null = null;

export async function createPool() {
  const env = getEnv();
  const sslConfig = getDatabaseSslConfig();

  const pool = mysql.createPool({
    host: env.parsedDb.host,
    port: env.parsedDb.port,
    user: env.parsedDb.user,
    password: env.parsedDb.password,
    database: env.parsedDb.database,
    ssl: sslConfig as mysql.PoolOptions["ssl"],
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  return pool;
}

export async function getPool() {
  if (!_pool) {
    _pool = await createPool();
  }
  return _pool;
}

export async function getDb() {
  if (!_db) {
    const pool = await getPool();
    _db = drizzle(pool, { mode: "default" }) as unknown as MySql2Database;
  }
  return _db;
}

export async function testConnection() {
  try {
    const pool = await getPool();
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    return { connected: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown database error";
    return { connected: false, error: message };
  }
}

export async function closePool() {
  if (_pool) {
    await _pool.end();
    _pool = null;
    _db = null;
  }
}
