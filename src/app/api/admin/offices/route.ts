import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/database/connection";
import { offices } from "@/database/schema/offices";
import { requireAdmin } from "@/lib/auth";
import { parseBody, latitudeSchema, longitudeSchema } from "@/lib/validation";
import { clientIp, writeAuditLog } from "@/lib/audit";

const createSchema = z.object({
  name: z.string().trim().min(1).max(255),
  address: z.string().trim().max(512).nullish(),
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  allowedRadiusMeter: z.coerce.number().int().positive().max(100000).default(100),
  maximumAccuracyMeter: z.coerce.number().int().positive().max(100000).default(50),
  timezone: z.string().trim().max(64).default("UTC"),
});

const patchSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(1).max(255).optional(),
  address: z.string().trim().max(512).nullish(),
  latitude: latitudeSchema.optional(),
  longitude: longitudeSchema.optional(),
  allowedRadiusMeter: z.coerce.number().int().positive().max(100000).optional(),
  maximumAccuracyMeter: z.coerce.number().int().positive().max(100000).optional(),
  timezone: z.string().trim().max(64).optional(),
  isActive: z.boolean().optional(),
});

export async function GET() {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;
  const { user } = guard;

  const db = await getDb();
  const rows = await db
    .select()
    .from(offices)
    .where(eq(offices.organizationId, user.organizationId));

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
  const [office] = await db
    .insert(offices)
    .values({
      organizationId: user.organizationId,
      name: body.name,
      address: body.address || null,
      latitude: body.latitude.toString(),
      longitude: body.longitude.toString(),
      allowedRadiusMeter: body.allowedRadiusMeter,
      maximumAccuracyMeter: body.maximumAccuracyMeter,
      timezone: body.timezone,
      isActive: true,
    })
    .$returningId();

  await writeAuditLog({
    organizationId: user.organizationId,
    actorUserId: user.id,
    action: "office.create",
    entityType: "office",
    entityId: office.id,
    newValues: body,
    ipAddress: clientIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ ...body, id: office.id });
}

export async function PATCH(request: Request) {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;
  const { user } = guard;

  const parsed = await parseBody(request, patchSchema);
  if (parsed.response) return parsed.response;
  const body = parsed.data;

  const db = await getDb();
  await db
    .update(offices)
    .set({
      name: body.name,
      address: body.address,
      latitude: body.latitude?.toString(),
      longitude: body.longitude?.toString(),
      allowedRadiusMeter: body.allowedRadiusMeter,
      maximumAccuracyMeter: body.maximumAccuracyMeter,
      timezone: body.timezone,
      isActive: body.isActive,
    })
    .where(
      and(
        eq(offices.id, body.id),
        eq(offices.organizationId, user.organizationId)
      )
    );

  await writeAuditLog({
    organizationId: user.organizationId,
    actorUserId: user.id,
    action: "office.update",
    entityType: "office",
    entityId: body.id,
    newValues: body,
    ipAddress: clientIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ success: true });
}
