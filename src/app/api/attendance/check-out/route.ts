import { NextResponse } from "next/server";
import { and, eq, gte } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/database/connection";
import { attendanceRecords } from "@/database/schema/attendance_records";
import { employees } from "@/database/schema/employees";
import { offices } from "@/database/schema/offices";
import { getCurrentUser } from "@/lib/auth";
import { parseBody } from "@/lib/validation";
import { clientIp, writeAuditLog } from "@/lib/audit";
import {
  evaluateLocation,
  enforceLocation,
  resolveBaseStatus,
} from "@/lib/attendance";

const BLOCK_MESSAGES: Record<string, string> = {
  LOCATION_REQUIRED:
    "Location is required to record attendance. Enable GPS and try again.",
  LOW_GPS_ACCURACY:
    "GPS accuracy is too low. Move to an open area and try again.",
  OUTSIDE_LOCATION: "You are outside the allowed office radius.",
};

const schema = z.object({
  latitude: z.coerce.number().min(-90).max(90).nullish(),
  longitude: z.coerce.number().min(-180).max(180).nullish(),
  accuracy: z.coerce.number().min(0).nullish(),
  capturedAt: z.string().datetime().nullish().or(z.literal("")),
  notes: z.string().trim().max(1000).nullish(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = await parseBody(request, schema);
  if (parsed.response) return parsed.response;
  const body = parsed.data;

  const db = await getDb();

  const [emp] = await db
    .select()
    .from(employees)
    .where(
      and(
        eq(employees.userId, user.id),
        eq(employees.organizationId, user.organizationId)
      )
    )
    .limit(1);

  if (!emp) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [checkInRecord] = await db
    .select()
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.employeeId, emp.id),
        eq(attendanceRecords.type, "CHECK_IN"),
        gte(attendanceRecords.serverTime, startOfDay)
      )
    )
    .orderBy(attendanceRecords.serverTime)
    .limit(1);

  if (!checkInRecord) {
    return NextResponse.json(
      { error: "You must check in before checking out" },
      { status: 409 }
    );
  }

  const [existingCheckOut] = await db
    .select({ id: attendanceRecords.id })
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.employeeId, emp.id),
        eq(attendanceRecords.type, "CHECK_OUT"),
        gte(attendanceRecords.serverTime, startOfDay)
      )
    )
    .limit(1);

  if (existingCheckOut) {
    return NextResponse.json(
      { error: "Already checked out today" },
      { status: 409 }
    );
  }

  const officeList = await db
    .select()
    .from(offices)
    .where(
      and(
        eq(offices.organizationId, user.organizationId),
        eq(offices.isActive, true)
      )
    );

  const ev = evaluateLocation(
    officeList,
    body.latitude,
    body.longitude,
    body.accuracy
  );

  const block = enforceLocation(ev, body.accuracy);
  if (block) {
    return NextResponse.json(
      {
        error: BLOCK_MESSAGES[block.code],
        code: block.code,
        distance: block.distance,
        accuracy: block.accuracy,
      },
      { status: 422 }
    );
  }

  const serverTime = new Date();
  const status = resolveBaseStatus(ev);

  const [record] = await db
    .insert(attendanceRecords)
    .values({
      organizationId: user.organizationId,
      employeeId: emp.id,
      officeId: ev.matchedOffice?.id ?? ev.nearestOffice?.id ?? null,
      scheduleId: checkInRecord.scheduleId ?? null,
      type: "CHECK_OUT",
      status: status as "PRESENT",
      serverTime,
      clientTime: body.capturedAt ? new Date(body.capturedAt) : null,
      latitude: body.latitude?.toString() ?? null,
      longitude: body.longitude?.toString() ?? null,
      accuracy: body.accuracy?.toString() ?? null,
      distanceFromOffice: ev.distance >= 0 ? ev.distance.toString() : null,
      withinRadius: ev.withinRadius,
      ipAddress: clientIp(request),
      userAgent: request.headers.get("user-agent") || null,
      notes: body.notes || null,
    })
    .$returningId();

  await writeAuditLog({
    organizationId: user.organizationId,
    actorUserId: user.id,
    action: "attendance.check_out",
    entityType: "attendance_record",
    entityId: record.id,
    newValues: { status, distance: ev.distance, withinRadius: ev.withinRadius },
    ipAddress: clientIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({
    id: record.id,
    status,
    distance: ev.distance,
    withinRadius: ev.withinRadius,
    accuracyValid: ev.accuracyValid,
    serverTime,
  });
}
