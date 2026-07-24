import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/database/connection";
import { settings } from "@/database/schema/settings";
import { requireAdmin, CONFIG_ROLES, requireRole } from "@/lib/auth";
import { clientIp, writeAuditLog } from "@/lib/audit";

export async function GET() {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;
  const { user } = guard;

  const db = await getDb();
  const rows = await db
    .select()
    .from(settings)
    .where(eq(settings.organizationId, user.organizationId));

  const result: Record<string, unknown> = {};
  for (const row of rows) {
    try {
      result[row.key] = JSON.parse(row.value as string);
    } catch {
      result[row.key] = row.value as string;
    }
  }

  return NextResponse.json(result);
}

export async function PATCH(request: Request) {
  const guard = await requireRole(CONFIG_ROLES);
  if (guard.response) return guard.response;
  const { user } = guard;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json(
      { error: "Body must be an object of key/value settings" },
      { status: 400 }
    );
  }

  const db = await getDb();

  for (const [key, value] of Object.entries(body)) {
    const existing = await db
      .select()
      .from(settings)
      .where(
        and(
          eq(settings.organizationId, user.organizationId),
          eq(settings.key, key)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(settings)
        .set({ value: JSON.stringify(value) })
        .where(
          and(
            eq(settings.organizationId, user.organizationId),
            eq(settings.key, key)
          )
        );
    } else {
      await db.insert(settings).values({
        organizationId: user.organizationId,
        key,
        value: JSON.stringify(value),
      });
    }
  }

  await writeAuditLog({
    organizationId: user.organizationId,
    actorUserId: user.id,
    action: "settings.update",
    entityType: "settings",
    entityId: Object.keys(body).join(","),
    newValues: body,
    ipAddress: clientIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ success: true });
}
