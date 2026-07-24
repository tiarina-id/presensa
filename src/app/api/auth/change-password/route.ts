import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/database/connection";
import { users } from "@/database/schema/users";
import { getCurrentUser, verifyPassword, hashPassword } from "@/lib/auth";
import { parseBody } from "@/lib/validation";
import { clientIp, writeAuditLog } from "@/lib/audit";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(200),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseBody(request, schema);
  if (parsed.response) return parsed.response;
  const body = parsed.data;

  const db = await getDb();
  const [row] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  if (!row) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const valid = await verifyPassword(body.currentPassword, row.passwordHash);
  if (!valid) {
    return NextResponse.json(
      { error: "Current password is incorrect", code: "WRONG_PASSWORD" },
      { status: 400 }
    );
  }

  const passwordHash = await hashPassword(body.newPassword);
  await db.update(users).set({ passwordHash }).where(eq(users.id, user.id));

  await writeAuditLog({
    organizationId: user.organizationId,
    actorUserId: user.id,
    action: "auth.change_password",
    entityType: "user",
    entityId: user.id,
    ipAddress: clientIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ success: true });
}
