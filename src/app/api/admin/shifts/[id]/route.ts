import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/database/connection";
import { shifts } from "@/database/schema/shifts";
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
  const shiftId = parseInt(id, 10);
  if (!Number.isInteger(shiftId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const db = await getDb();
  await db
    .update(shifts)
    .set({ isActive: false })
    .where(
      and(eq(shifts.id, shiftId), eq(shifts.organizationId, user.organizationId))
    );

  await writeAuditLog({
    organizationId: user.organizationId,
    actorUserId: user.id,
    action: "shift.deactivate",
    entityType: "shift",
    entityId: shiftId,
    ipAddress: clientIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ success: true });
}
