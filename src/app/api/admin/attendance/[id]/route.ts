import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/database/connection";
import { attendanceRecords } from "@/database/schema/attendance_records";
import { attendancePhotos } from "@/database/schema/attendance_photos";
import { requireAdmin } from "@/lib/auth";
import { parseBody } from "@/lib/validation";
import { clientIp, writeAuditLog } from "@/lib/audit";

const patchSchema = z.object({
  status: z.enum(["PRESENT", "LATE", "MANUAL", "REJECTED"]),
  notes: z.string().trim().max(1000).nullish(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;
  const { user } = guard;

  const { id } = await params;
  const recordId = parseInt(id, 10);
  if (!Number.isInteger(recordId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const parsed = await parseBody(request, patchSchema);
  if (parsed.response) return parsed.response;
  const body = parsed.data;

  const db = await getDb();

  const [existing] = await db
    .select()
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.id, recordId),
        eq(attendanceRecords.organizationId, user.organizationId)
      )
    )
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db
    .update(attendanceRecords)
    .set({ status: body.status, notes: body.notes ?? null })
    .where(
      and(
        eq(attendanceRecords.id, recordId),
        eq(attendanceRecords.organizationId, user.organizationId)
      )
    );

  await writeAuditLog({
    organizationId: user.organizationId,
    actorUserId: user.id,
    action: "attendance.correct",
    entityType: "attendance_record",
    entityId: recordId,
    oldValues: { status: existing.status, notes: existing.notes },
    newValues: { status: body.status, notes: body.notes ?? null },
    ipAddress: clientIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ success: true });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;
  const { user } = guard;

  const { id } = await params;
  const recordId = parseInt(id, 10);
  if (!Number.isInteger(recordId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const db = await getDb();
  const [record] = await db
    .select()
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.id, recordId),
        eq(attendanceRecords.organizationId, user.organizationId)
      )
    )
    .limit(1);

  if (!record) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const photos = await db
    .select()
    .from(attendancePhotos)
    .where(eq(attendancePhotos.attendanceId, record.id));

  return NextResponse.json({ record, photos });
}
