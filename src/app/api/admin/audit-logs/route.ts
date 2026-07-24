import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { getDb } from "@/database/connection";
import { auditLogs } from "@/database/schema/audit_logs";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;
  const { user } = guard;

  const db = await getDb();
  const logs = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.organizationId, user.organizationId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(100);

  return NextResponse.json(logs);
}
