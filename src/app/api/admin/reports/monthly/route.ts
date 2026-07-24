import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, lt } from "drizzle-orm";
import { getDb } from "@/database/connection";
import { attendanceRecords } from "@/database/schema/attendance_records";
import { employees } from "@/database/schema/employees";
import { schedules } from "@/database/schema/schedules";
import { requireAdmin } from "@/lib/auth";
import { parseDaysOfWeek } from "@/lib/attendance";

function dayKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export async function GET(request: NextRequest) {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;
  const { user } = guard;

  const { searchParams } = new URL(request.url);
  const monthParam = searchParams.get("month"); // YYYY-MM
  const now = new Date();
  const [year, month] = monthParam?.match(/^(\d{4})-(\d{2})$/)
    ? [
        parseInt(monthParam.slice(0, 4), 10),
        parseInt(monthParam.slice(5, 7), 10) - 1,
      ]
    : [now.getFullYear(), now.getMonth()];

  const monthStart = new Date(year, month, 1, 0, 0, 0, 0);
  const monthEnd = new Date(year, month + 1, 1, 0, 0, 0, 0);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // Don't count days after today as "absent".
  const lastCountedDay = todayStart < monthEnd ? todayStart : new Date(monthEnd.getTime() - 86400000);

  const db = await getDb();

  const [empList, scheduleList, records] = await Promise.all([
    db
      .select({
        id: employees.id,
        code: employees.employeeId,
        fullName: employees.fullName,
        isActive: employees.isActive,
      })
      .from(employees)
      .where(eq(employees.organizationId, user.organizationId)),
    db
      .select({
        employeeId: schedules.employeeId,
        daysOfWeek: schedules.daysOfWeek,
        effectiveFrom: schedules.effectiveFrom,
        effectiveTo: schedules.effectiveTo,
      })
      .from(schedules)
      .where(
        and(
          eq(schedules.organizationId, user.organizationId),
          eq(schedules.isActive, true)
        )
      ),
    db
      .select({
        employeeId: attendanceRecords.employeeId,
        type: attendanceRecords.type,
        status: attendanceRecords.status,
        serverTime: attendanceRecords.serverTime,
      })
      .from(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.organizationId, user.organizationId),
          gte(attendanceRecords.serverTime, monthStart),
          lt(attendanceRecords.serverTime, monthEnd)
        )
      ),
  ]);

  // Group attendance by employee then by day.
  type DayInfo = { checkIns: Date[]; checkOuts: Date[]; statuses: string[] };
  const byEmp = new Map<number, Map<string, DayInfo>>();
  for (const r of records) {
    const t = new Date(r.serverTime);
    const dk = dayKey(t);
    if (!byEmp.has(r.employeeId)) byEmp.set(r.employeeId, new Map());
    const days = byEmp.get(r.employeeId)!;
    if (!days.has(dk)) days.set(dk, { checkIns: [], checkOuts: [], statuses: [] });
    const info = days.get(dk)!;
    if (r.type === "CHECK_IN") {
      info.checkIns.push(t);
      info.statuses.push(r.status);
    } else if (r.type === "CHECK_OUT") {
      info.checkOuts.push(t);
    }
  }

  // Schedules grouped per employee for absence calculation.
  const schedByEmp = new Map<number, typeof scheduleList>();
  for (const s of scheduleList) {
    if (!schedByEmp.has(s.employeeId)) schedByEmp.set(s.employeeId, []);
    schedByEmp.get(s.employeeId)!.push(s);
  }

  function isScheduledOn(empId: number, date: Date): boolean {
    const list = schedByEmp.get(empId);
    if (!list || list.length === 0) return false;
    return list.some((s) => {
      const from = new Date(s.effectiveFrom);
      const to = s.effectiveTo ? new Date(s.effectiveTo) : null;
      if (date < new Date(from.getFullYear(), from.getMonth(), from.getDate()))
        return false;
      if (to && date > new Date(to.getFullYear(), to.getMonth(), to.getDate()))
        return false;
      return parseDaysOfWeek(s.daysOfWeek).includes(date.getDay());
    });
  }

  const rows = empList
    .map((emp) => {
      const days = byEmp.get(emp.id) ?? new Map<string, DayInfo>();

      let present = 0;
      let late = 0;
      let workedMs = 0;

      for (const info of days.values()) {
        if (info.checkIns.length > 0) {
          present += 1;
          if (info.statuses.includes("LATE")) late += 1;

          if (info.checkOuts.length > 0) {
            const firstIn = Math.min(...info.checkIns.map((d) => d.getTime()));
            const lastOut = Math.max(...info.checkOuts.map((d) => d.getTime()));
            if (lastOut > firstIn) workedMs += lastOut - firstIn;
          }
        }
      }

      // Absent = scheduled days (up to today) without a check-in.
      let scheduledDays = 0;
      let absent = 0;
      for (
        let d = new Date(monthStart);
        d <= lastCountedDay;
        d = new Date(d.getTime() + 86400000)
      ) {
        if (isScheduledOn(emp.id, d)) {
          scheduledDays += 1;
          const info = days.get(dayKey(d));
          if (!info || info.checkIns.length === 0) absent += 1;
        }
      }

      return {
        employeeId: emp.id,
        code: emp.code,
        fullName: emp.fullName,
        isActive: emp.isActive,
        present,
        late,
        scheduledDays,
        absent,
        totalHours: Math.round((workedMs / 3600000) * 10) / 10,
      };
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName));

  return NextResponse.json({
    month: `${year}-${String(month + 1).padStart(2, "0")}`,
    rows,
  });
}
