import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/database/connection";
import { employees } from "@/database/schema/employees";
import { users } from "@/database/schema/users";
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
  const employeeId = parseInt(id, 10);
  if (!Number.isInteger(employeeId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const db = await getDb();

  const [existing] = await db
    .select()
    .from(employees)
    .where(
      and(
        eq(employees.id, employeeId),
        eq(employees.organizationId, user.organizationId)
      )
    )
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Soft-delete: deactivate the employee and their login rather than hard
  // delete, so attendance history and FKs stay intact.
  await db
    .update(employees)
    .set({ isActive: false })
    .where(
      and(
        eq(employees.id, employeeId),
        eq(employees.organizationId, user.organizationId)
      )
    );

  if (existing.userId != null) {
    await db
      .update(users)
      .set({ isActive: false })
      .where(
        and(
          eq(users.id, existing.userId),
          eq(users.organizationId, user.organizationId)
        )
      );
  }

  await writeAuditLog({
    organizationId: user.organizationId,
    actorUserId: user.id,
    action: "employee.deactivate",
    entityType: "employee",
    entityId: employeeId,
    oldValues: { fullName: existing.fullName, email: existing.email },
    ipAddress: clientIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ success: true });
}
