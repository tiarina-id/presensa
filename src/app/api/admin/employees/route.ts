import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/database/connection";
import { employees } from "@/database/schema/employees";
import { users } from "@/database/schema/users";
import { hashPassword, requireAdmin } from "@/lib/auth";
import { parseBody } from "@/lib/validation";
import { clientIp, writeAuditLog } from "@/lib/audit";

const createSchema = z.object({
  employeeId: z.string().trim().min(1).max(50),
  fullName: z.string().trim().min(1).max(255),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(200),
  phone: z.string().trim().max(50).optional().or(z.literal("")),
  position: z.string().trim().max(255).optional().or(z.literal("")),
  isActive: z.boolean().optional(),
});

const patchSchema = z.object({
  id: z.number().int().positive(),
  fullName: z.string().trim().min(1).max(255).optional(),
  email: z.string().trim().email().max(255).optional(),
  phone: z.string().trim().max(50).nullish(),
  position: z.string().trim().max(255).nullish(),
  isActive: z.boolean().optional(),
  // Optional password reset (blank/omitted = unchanged).
  password: z.string().min(8).max(200).optional(),
});

export async function GET() {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;
  const { user } = guard;

  const db = await getDb();
  const rows = await db
    .select()
    .from(employees)
    .where(eq(employees.organizationId, user.organizationId));

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

  // Reject duplicate email up front for a friendly error.
  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, body.email))
    .limit(1);
  if (existingUser) {
    return NextResponse.json(
      { error: "A user with this email already exists" },
      { status: 409 }
    );
  }

  const passwordHash = await hashPassword(body.password);

  try {
    const result = await db.transaction(async (tx) => {
      const [createdUser] = await tx
        .insert(users)
        .values({
          organizationId: user.organizationId,
          email: body.email,
          passwordHash,
          fullName: body.fullName,
          role: "EMPLOYEE",
          isActive: body.isActive ?? true,
        })
        .$returningId();

      const [createdEmp] = await tx
        .insert(employees)
        .values({
          organizationId: user.organizationId,
          userId: createdUser.id,
          employeeId: body.employeeId,
          fullName: body.fullName,
          email: body.email,
          phone: body.phone || null,
          position: body.position || null,
          isActive: body.isActive ?? true,
        })
        .$returningId();

      return { userId: createdUser.id, employeeId: createdEmp.id };
    });

    await writeAuditLog({
      organizationId: user.organizationId,
      actorUserId: user.id,
      action: "employee.create",
      entityType: "employee",
      entityId: result.employeeId,
      newValues: {
        employeeId: body.employeeId,
        fullName: body.fullName,
        email: body.email,
      },
      ipAddress: clientIp(request),
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json({
      id: result.employeeId,
      userId: result.userId,
      employeeId: body.employeeId,
      fullName: body.fullName,
      email: body.email,
    });
  } catch (err) {
    console.error("[employees.create] failed", err);
    return NextResponse.json(
      { error: "Failed to create employee" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;
  const { user } = guard;

  const parsed = await parseBody(request, patchSchema);
  if (parsed.response) return parsed.response;
  const body = parsed.data;

  const db = await getDb();

  // Load the employee first (needed to reset the linked user's password and to
  // scope the update to this organization).
  const [existing] = await db
    .select()
    .from(employees)
    .where(
      and(
        eq(employees.id, body.id),
        eq(employees.organizationId, user.organizationId)
      )
    )
    .limit(1);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db
    .update(employees)
    .set({
      fullName: body.fullName,
      email: body.email,
      phone: body.phone,
      position: body.position,
      isActive: body.isActive,
    })
    .where(
      and(
        eq(employees.id, body.id),
        eq(employees.organizationId, user.organizationId)
      )
    );

  // Optional password reset on the linked login account.
  if (body.password && existing.userId != null) {
    const passwordHash = await hashPassword(body.password);
    await db
      .update(users)
      .set({ passwordHash })
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
    action: "employee.update",
    entityType: "employee",
    entityId: body.id,
    // password is redacted by the audit layer.
    newValues: body,
    ipAddress: clientIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({
    success: true,
    passwordReset: !!(body.password && existing.userId != null),
  });
}
