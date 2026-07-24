import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/database/connection";
import { offices } from "@/database/schema/offices";
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
  const officeId = parseInt(id, 10);
  if (!Number.isInteger(officeId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const db = await getDb();
  await db
    .update(offices)
    .set({ isActive: false })
    .where(
      and(
        eq(offices.id, officeId),
        eq(offices.organizationId, user.organizationId)
      )
    );

  await writeAuditLog({
    organizationId: user.organizationId,
    actorUserId: user.id,
    action: "office.deactivate",
    entityType: "office",
    entityId: officeId,
    ipAddress: clientIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ success: true });
}
