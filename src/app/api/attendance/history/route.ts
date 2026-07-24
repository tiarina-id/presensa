import { NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { getDb } from "@/database/connection";
import { attendanceRecords } from "@/database/schema/attendance_records";
import { employees } from "@/database/schema/employees";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();
  const [emp] = await db
    .select()
    .from(employees)
    .where(
      and(eq(employees.userId, user.id), eq(employees.organizationId, user.organizationId))
    )
    .limit(1);

  if (!emp) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  const records = await db
    .select()
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.employeeId, emp.id),
        eq(attendanceRecords.organizationId, user.organizationId)
      )
    )
    .orderBy(desc(attendanceRecords.serverTime))
    .limit(50);

  return NextResponse.json(records);
}
