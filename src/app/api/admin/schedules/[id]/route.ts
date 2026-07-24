import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/database/connection";
import { schedules } from "@/database/schema/schedules";
import { requireAdmin } from "@/lib/auth";
import { clientIp, writeAuditLog } from "@/lib/audit";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;
  const { user } = guard;

  const { id } = await params;
  const scheduleId = parseInt(id, 10);
  if (!Number.isInteger(scheduleId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const db = await getDb();
  await db
    .update(schedules)
    .set({ isActive: false })
    .where(
      and(
        eq(schedules.id, scheduleId),
        eq(schedules.organizationId, user.organizationId)
      )
    );

  await writeAuditLog({
    organizationId: user.organizationId,
    actorUserId: user.id,
    action: "schedule.deactivate",
    entityType: "schedule",
    entityId: scheduleId,
    ipAddress: clientIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ success: true });
}
