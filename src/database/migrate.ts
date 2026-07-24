import { migrate } from "drizzle-orm/mysql2/migrator";
import path from "path";
import { getDb, closePool } from "./connection";

export async function runMigrations() {
  const db = await getDb();

  console.log("[database] Running migrations...");

  const migrationsFolder = path.resolve(
    process.cwd(),
    "src/database/migrations"
  );

  try {
    await migrate(db, {
      migrationsFolder,
    });
    console.log("[database] Migrations completed successfully");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown migration error";
    console.error("[database] Migration failed:", message);
    await closePool();
    process.exit(1);
  }
}
