import { NextRequest, NextResponse } from "next/server";
import { eq, and, between, desc } from "drizzle-orm";
import { getDb } from "@/database/connection";
import { attendanceRecords } from "@/database/schema/attendance_records";
import { employees } from "@/database/schema/employees";
import { requireAdmin } from "@/lib/auth";

const VALID_STATUSES = ["PRESENT", "LATE", "MANUAL", "REJECTED"] as const;
type AttendanceStatus = (typeof VALID_STATUSES)[number];

export async function GET(request: NextRequest) {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;
  const { user } = guard;

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const employeeId = searchParams.get("employeeId");
  const status = searchParams.get("status");

  const db = await getDb();

  const conditions = [eq(attendanceRecords.organizationId, user.organizationId)];

  if (from && to) {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (!isNaN(fromDate.getTime()) && !isNaN(toDate.getTime())) {
      conditions.push(
        between(attendanceRecords.serverTime, fromDate, toDate)
      );
    }
  }

  if (employeeId) {
    const empId = parseInt(employeeId, 10);
    if (Number.isInteger(empId)) {
      conditions.push(eq(attendanceRecords.employeeId, empId));
    }
  }

  if (status && VALID_STATUSES.includes(status as AttendanceStatus)) {
    conditions.push(eq(attendanceRecords.status, status as AttendanceStatus));
  }

  const records = await db
    .select({
      id: attendanceRecords.id,
      employeeId: attendanceRecords.employeeId,
      employeeName: employees.fullName,
      employeeCode: employees.employeeId,
      type: attendanceRecords.type,
      status: attendanceRecords.status,
      serverTime: attendanceRecords.serverTime,
      withinRadius: attendanceRecords.withinRadius,
      notes: attendanceRecords.notes,
    })
    .from(attendanceRecords)
    .innerJoin(employees, eq(attendanceRecords.employeeId, employees.id))
    .where(and(...conditions))
    .orderBy(desc(attendanceRecords.serverTime))
    .limit(100);

  return NextResponse.json(records);
}
