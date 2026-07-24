import { NextResponse } from "next/server";
import { eq, and, gte, lt } from "drizzle-orm";
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

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const records = await db
    .select()
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.employeeId, emp.id),
        gte(attendanceRecords.serverTime, today),
        lt(attendanceRecords.serverTime, tomorrow)
      )
    )
    .orderBy(attendanceRecords.serverTime);

  const hasCheckIn = records.some((r) => r.type === "CHECK_IN");
  const hasCheckOut = records.some((r) => r.type === "CHECK_OUT");

  return NextResponse.json({
    employee: emp,
    records,
    hasCheckIn,
    hasCheckOut,
    date: today.toISOString().split("T")[0],
  });
}
