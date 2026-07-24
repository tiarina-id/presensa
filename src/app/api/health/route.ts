import { NextResponse } from "next/server";
import { testConnection } from "@/database/connection";
import { getEnv } from "@/lib/config";

export async function GET() {
  let envValid = true;
  let envError: string | null = null;

  try {
    getEnv();
  } catch (error) {
    envValid = false;
    envError = error instanceof Error ? error.message : "Invalid environment";
  }

  const dbResult = await testConnection();

  const status = dbResult.connected && envValid ? "ok" : "degraded";

  return NextResponse.json(
    {
      status,
      database: dbResult.connected ? "connected" : "disconnected",
      storage: "not_configured",
      ...(dbResult.error ? { database_error: dbResult.error } : {}),
      ...(envError ? { env_error: envError } : {}),
    },
    { status: status === "ok" ? 200 : 503 }
  );
}
