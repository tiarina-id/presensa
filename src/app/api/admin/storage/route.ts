import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/database/connection";
import { storageSettings } from "@/database/schema/storage_settings";
import { requireRole, CONFIG_ROLES } from "@/lib/auth";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import { parseBody } from "@/lib/validation";
import { invalidateStorageCache } from "@/lib/storage";
import { clientIp, writeAuditLog } from "@/lib/audit";

const patchSchema = z.object({
  driver: z.string().trim().min(1).max(64).default("s3"),
  endpoint: z.string().trim().max(512).nullish().or(z.literal("")),
  region: z.string().trim().max(128).nullish().or(z.literal("")),
  bucket: z.string().trim().min(1).max(255),
  // Secrets are optional on update; empty means "keep existing".
  accessKey: z.string().max(512).optional(),
  secretKey: z.string().max(512).optional(),
  forcePathStyle: z.boolean().optional(),
  publicUrl: z.string().trim().max(512).nullish().or(z.literal("")),
  objectPrefix: z.string().trim().max(255).nullish().or(z.literal("")),
  signedUrlExpiration: z.coerce.number().int().min(60).max(604800).default(3600),
});

/** Mask a secret for display, e.g. "AKIA****". */
function maskSecret(value: string): string {
  if (!value) return "";
  const decrypted = decryptSecret(value);
  if (decrypted.length <= 4) return "****";
  return decrypted.slice(0, 4) + "*".repeat(Math.min(decrypted.length - 4, 8));
}

export async function GET() {
  const guard = await requireRole(CONFIG_ROLES);
  if (guard.response) return guard.response;

  const db = await getDb();
  const [config] = await db.select().from(storageSettings).limit(1);

  if (!config) {
    return NextResponse.json({ configured: false });
  }

  return NextResponse.json({
    configured: true,
    driver: config.driver,
    endpoint: config.endpoint,
    region: config.region,
    bucket: config.bucket,
    forcePathStyle: config.forcePathStyle,
    publicUrl: config.publicUrl,
    objectPrefix: config.objectPrefix,
    signedUrlExpiration: config.signedUrlExpiration,
    // Masked, derived from decrypted value — never send the secret itself.
    accessKeyDisplay: maskSecret(config.accessKeyEncrypted),
    hasSecretKey: !!config.secretKeyEncrypted,
  });
}

export async function PATCH(request: Request) {
  const guard = await requireRole(CONFIG_ROLES);
  if (guard.response) return guard.response;
  const { user } = guard;

  const parsed = await parseBody(request, patchSchema);
  if (parsed.response) return parsed.response;
  const body = parsed.data;

  const db = await getDb();
  const [existing] = await db.select().from(storageSettings).limit(1);

  const accessKeyEncrypted = body.accessKey
    ? encryptSecret(body.accessKey)
    : existing?.accessKeyEncrypted || "";
  const secretKeyEncrypted = body.secretKey
    ? encryptSecret(body.secretKey)
    : existing?.secretKeyEncrypted || "";

  const values = {
    driver: body.driver,
    endpoint: body.endpoint || null,
    region: body.region || null,
    bucket: body.bucket,
    accessKeyEncrypted,
    secretKeyEncrypted,
    forcePathStyle: body.forcePathStyle ?? false,
    publicUrl: body.publicUrl || null,
    objectPrefix: body.objectPrefix || null,
    signedUrlExpiration: body.signedUrlExpiration,
  };

  if (existing) {
    await db.update(storageSettings).set(values);
  } else {
    await db.insert(storageSettings).values(values);
  }

  invalidateStorageCache();

  await writeAuditLog({
    organizationId: user.organizationId,
    actorUserId: user.id,
    action: "storage.update",
    entityType: "storage_settings",
    entityId: existing?.id ?? null,
    // accessKey/secretKey are redacted by the audit layer.
    newValues: {
      driver: body.driver,
      endpoint: body.endpoint,
      region: body.region,
      bucket: body.bucket,
      forcePathStyle: body.forcePathStyle,
      publicUrl: body.publicUrl,
      objectPrefix: body.objectPrefix,
    },
    ipAddress: clientIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ success: true });
}
