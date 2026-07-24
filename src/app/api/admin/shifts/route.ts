import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/database/connection";
import { shifts } from "@/database/schema/shifts";
import { requireAdmin } from "@/lib/auth";
import { parseBody } from "@/lib/validation";
import { clientIp, writeAuditLog } from "@/lib/audit";

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "Expected HH:MM time");

const createSchema = z.object({
  name: z.string().trim().min(1).max(255),
  startTime: timeSchema,
  endTime: timeSchema,
  lateThresholdMinutes: z.coerce.number().int().min(0).max(1440).default(0),
});

const patchSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(1).max(255).optional(),
  startTime: timeSchema.optional(),
  endTime: timeSchema.optional(),
  lateThresholdMinutes: z.coerce.number().int().min(0).max(1440).optional(),
  isActive: z.boolean().optional(),
});

export async function GET() {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;
  const { user } = guard;

  const db = await getDb();
  const rows = await db
    .select()
    .from(shifts)
    .where(eq(shifts.organizationId, user.organizationId));

  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;
  const { user } = guard;

  const parsed = await parseBody(request, createSchema);
  if (parsed.response) return parsed.response;
  const body = parsed.data;

  const db = await getDb();
  const [shift] = await db
    .insert(shifts)
    .values({
      organizationId: user.organizationId,
      name: body.name,
      startTime: body.startTime,
      endTime: body.endTime,
      lateThresholdMinutes: body.lateThresholdMinutes,
    })
    .$returningId();

  await writeAuditLog({
    organizationId: user.organizationId,
    actorUserId: user.id,
    action: "shift.create",
    entityType: "shift",
    entityId: shift.id,
    newValues: body,
    ipAddress: clientIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ ...body, id: shift.id });
}

export async function PATCH(request: Request) {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;
  const { user } = guard;

  const parsed = await parseBody(request, patchSchema);
  if (parsed.response) return parsed.response;
  const { id, ...fields } = parsed.data;

  const db = await getDb();
  await db
    .update(shifts)
    .set(fields)
    .where(
      and(eq(shifts.id, id), eq(shifts.organizationId, user.organizationId))
    );

  await writeAuditLog({
    organizationId: user.organizationId,
    actorUserId: user.id,
    action: "shift.update",
    entityType: "shift",
    entityId: id,
    newValues: fields,
    ipAddress: clientIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ success: true });
}
