export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { loadEnv } = await import("./lib/env");

    try {
      loadEnv();
      console.log("[presensa] Environment variables validated");
    } catch (error) {
      console.error(
        "[presensa] Environment validation failed:",
        error instanceof Error ? error.message : error
      );
      process.exit(1);
    }

    const { testConnection } = await import("./database/connection");
    const dbResult = await testConnection();
    if (!dbResult.connected) {
      console.error(
        "[presensa] Database connection failed:",
        dbResult.error
      );
      process.exit(1);
    }
    console.log("[presensa] Database connected");

    const { runMigrations } = await import("./database/migrate");
    await runMigrations();
  }
}
