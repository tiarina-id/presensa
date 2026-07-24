import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/database/connection";
import { schedules } from "@/database/schema/schedules";
import { employees } from "@/database/schema/employees";
import { shifts } from "@/database/schema/shifts";
import { requireAdmin } from "@/lib/auth";
import { parseBody } from "@/lib/validation";
import { clientIp, writeAuditLog } from "@/lib/audit";

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD date");

const createSchema = z.object({
  employeeId: z.coerce.number().int().positive(),
  shiftId: z.coerce.number().int().positive(),
  // Weekday numbers 0=Sun … 6=Sat; at least one day required.
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1),
  effectiveFrom: dateSchema.optional().or(z.literal("")),
  effectiveTo: dateSchema.nullish().or(z.literal("")),
});

const patchSchema = z.object({
  id: z.number().int().positive(),
  shiftId: z.coerce.number().int().positive().optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1).optional(),
  effectiveFrom: dateSchema.optional().or(z.literal("")),
  effectiveTo: dateSchema.nullish().or(z.literal("")),
  isActive: z.boolean().optional(),
});

function todayDateString(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export async function GET() {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;
  const { user } = guard;

  const db = await getDb();
  const rows = await db
    .select({
      id: schedules.id,
      employeeId: schedules.employeeId,
      shiftId: schedules.shiftId,
      employeeName: employees.fullName,
      shiftName: shifts.name,
      daysOfWeek: schedules.daysOfWeek,
      effectiveFrom: schedules.effectiveFrom,
      effectiveTo: schedules.effectiveTo,
      isActive: schedules.isActive,
    })
    .from(schedules)
    .innerJoin(employees, eq(schedules.employeeId, employees.id))
    .innerJoin(shifts, eq(schedules.shiftId, shifts.id))
    .where(eq(schedules.organizationId, user.organizationId));

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

  // Ensure the referenced employee and shift belong to this organization.
  const [emp] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(
      and(
        eq(employees.id, body.employeeId),
        eq(employees.organizationId, user.organizationId)
      )
    )
    .limit(1);
  const [shift] = await db
    .select({ id: shifts.id, organizationId: shifts.organizationId })
    .from(shifts)
    .where(eq(shifts.id, body.shiftId))
    .limit(1);

  if (!emp || !shift || shift.organizationId !== user.organizationId) {
    return NextResponse.json(
      { error: "Employee or shift not found in this organization" },
      { status: 400 }
    );
  }

  const effectiveFrom = body.effectiveFrom
    ? new Date(body.effectiveFrom)
    : new Date(todayDateString());

  const [schedule] = await db
    .insert(schedules)
    .values({
      organizationId: user.organizationId,
      employeeId: body.employeeId,
      shiftId: body.shiftId,
      daysOfWeek: [...body.daysOfWeek].sort((a, b) => a - b).join(","),
      effectiveFrom,
      effectiveTo: body.effectiveTo ? new Date(body.effectiveTo) : null,
      isActive: true,
    })
    .$returningId();

  await writeAuditLog({
    organizationId: user.organizationId,
    actorUserId: user.id,
    action: "schedule.create",
    entityType: "schedule",
    entityId: schedule.id,
    newValues: body,
    ipAddress: clientIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ ...body, id: schedule.id });
}

export async function PATCH(request: Request) {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;
  const { user } = guard;

  const parsed = await parseBody(request, patchSchema);
  if (parsed.response) return parsed.response;
  const body = parsed.data;

  const db = await getDb();

  if (body.shiftId != null) {
    const [shift] = await db
      .select({ id: shifts.id })
      .from(shifts)
      .where(
        and(
          eq(shifts.id, body.shiftId),
          eq(shifts.organizationId, user.organizationId)
        )
      )
      .limit(1);
    if (!shift) {
      return NextResponse.json(
        { error: "Shift not found in this organization" },
        { status: 400 }
      );
    }
  }

  const updates: Record<string, unknown> = {};
  if (body.shiftId != null) updates.shiftId = body.shiftId;
  if (body.daysOfWeek)
    updates.daysOfWeek = [...body.daysOfWeek].sort((a, b) => a - b).join(",");
  if (body.effectiveFrom) updates.effectiveFrom = new Date(body.effectiveFrom);
  if (body.effectiveTo !== undefined)
    updates.effectiveTo = body.effectiveTo ? new Date(body.effectiveTo) : null;
  if (body.isActive !== undefined) updates.isActive = body.isActive;

  await db
    .update(schedules)
    .set(updates)
    .where(
      and(
        eq(schedules.id, body.id),
        eq(schedules.organizationId, user.organizationId)
      )
    );

  await writeAuditLog({
    organizationId: user.organizationId,
    actorUserId: user.id,
    action: "schedule.update",
    entityType: "schedule",
    entityId: body.id,
    newValues: body,
    ipAddress: clientIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ success: true });
}
