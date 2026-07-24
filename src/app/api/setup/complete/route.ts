import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/database/connection";
import { organizations } from "@/database/schema/organizations";
import { users } from "@/database/schema/users";
import { offices } from "@/database/schema/offices";
import { storageSettings } from "@/database/schema/storage_settings";
import { settings } from "@/database/schema/settings";
import { hashPassword } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";
import { parseBody, latitudeSchema, longitudeSchema } from "@/lib/validation";

const schema = z.object({
  adminName: z.string().trim().min(1).max(255),
  adminEmail: z.string().trim().email().max(255),
  adminPassword: z.string().min(8).max(200),
  appName: z.string().trim().min(1).max(255),
  organizationName: z.string().trim().min(1).max(255),
  language: z.string().trim().max(10).optional(),
  timezone: z.string().trim().max(64).optional(),
  officeName: z.string().trim().max(255).optional().or(z.literal("")),
  officeAddress: z.string().trim().max(512).optional().or(z.literal("")),
  officeLatitude: latitudeSchema.optional().nullable(),
  officeLongitude: longitudeSchema.optional().nullable(),
  allowedRadiusMeter: z.coerce.number().int().positive().max(100000).optional(),
  maximumAccuracyMeter: z.coerce.number().int().positive().max(100000).optional(),
  storageProvider: z
    .object({
      driver: z.string().optional(),
      endpoint: z.string().optional(),
      region: z.string().optional(),
      bucket: z.string().optional(),
      accessKey: z.string().optional(),
      secretKey: z.string().optional(),
      forcePathStyle: z.boolean().optional(),
      publicUrl: z.string().optional(),
      objectPrefix: z.string().optional(),
      signedUrlExpiration: z.coerce.number().optional(),
    })
    .optional(),
});

export async function POST(request: Request) {
  const db = await getDb();

  const existing = await db.select({ id: users.id }).from(users).limit(1);
  if (existing.length > 0) {
    return NextResponse.json(
      { error: "Setup has already been completed" },
      { status: 403 }
    );
  }

  const parsed = await parseBody(request, schema);
  if (parsed.response) return parsed.response;
  const body = parsed.data;

  const passwordHash = await hashPassword(body.adminPassword);
  const slug = body.organizationName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const hasOffice =
    !!body.officeName &&
    body.officeLatitude != null &&
    body.officeLongitude != null;

  try {
    const result = await db.transaction(async (tx) => {
      // Re-check inside the transaction to narrow the setup race window.
      const stillEmpty = await tx.select({ id: users.id }).from(users).limit(1);
      if (stillEmpty.length > 0) {
        throw new Error("SETUP_ALREADY_DONE");
      }

      const [org] = await tx
        .insert(organizations)
        .values({ name: body.organizationName, slug })
        .$returningId();

      const [admin] = await tx
        .insert(users)
        .values({
          organizationId: org.id,
          email: body.adminEmail,
          passwordHash,
          fullName: body.adminName,
          role: "SUPER_ADMIN",
          isActive: true,
        })
        .$returningId();

      if (hasOffice) {
        await tx.insert(offices).values({
          organizationId: org.id,
          name: body.officeName as string,
          address: body.officeAddress || null,
          latitude: String(body.officeLatitude),
          longitude: String(body.officeLongitude),
          allowedRadiusMeter: body.allowedRadiusMeter || 100,
          maximumAccuracyMeter: body.maximumAccuracyMeter || 50,
          timezone: body.timezone || "UTC",
          isActive: true,
        });
      }

      const sp = body.storageProvider;
      if (sp && sp.bucket) {
        await tx.insert(storageSettings).values({
          driver: sp.driver || "s3",
          endpoint: sp.endpoint || null,
          region: sp.region || null,
          bucket: sp.bucket,
          accessKeyEncrypted: sp.accessKey ? encryptSecret(sp.accessKey) : "",
          secretKeyEncrypted: sp.secretKey ? encryptSecret(sp.secretKey) : "",
          forcePathStyle: sp.forcePathStyle || false,
          publicUrl: sp.publicUrl || null,
          objectPrefix: sp.objectPrefix || null,
          signedUrlExpiration: sp.signedUrlExpiration || 3600,
        });
      }

      await tx.insert(settings).values([
        {
          organizationId: org.id,
          key: "app_name",
          value: JSON.stringify(body.appName),
        },
        {
          organizationId: org.id,
          key: "language",
          value: JSON.stringify(body.language || "en"),
        },
        {
          organizationId: org.id,
          key: "timezone",
          value: JSON.stringify(body.timezone || "UTC"),
        },
      ]);

      return { organizationId: org.id, adminId: admin.id };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    if (err instanceof Error && err.message === "SETUP_ALREADY_DONE") {
      return NextResponse.json(
        { error: "Setup has already been completed" },
        { status: 403 }
      );
    }
    console.error("[setup.complete] failed", err);
    return NextResponse.json(
      { error: "Failed to complete setup" },
      { status: 500 }
    );
  }
}
