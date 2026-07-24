import { getDb } from "@/database/connection";
import { auditLogs } from "@/database/schema/audit_logs";

/** Keys whose values must never be written to the audit log. */
const REDACTED_KEYS = new Set([
  "password",
  "passwordHash",
  "password_hash",
  "secretKey",
  "secret_key",
  "secretKeyEncrypted",
  "accessKey",
  "access_key",
  "accessKeyEncrypted",
  "token",
  "sessionToken",
]);

function redact(value: unknown): unknown {
  if (value == null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(redact);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = REDACTED_KEYS.has(k) ? "[REDACTED]" : redact(v);
  }
  return out;
}

export interface AuditEntry {
  organizationId: number;
  actorUserId?: number | null;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  oldValues?: unknown;
  newValues?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Write an audit log entry. Never throws — auditing must not break the
 * primary operation. Secret-bearing keys are redacted automatically.
 */
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    const db = await getDb();
    await db.insert(auditLogs).values({
      organizationId: entry.organizationId,
      actorUserId: entry.actorUserId ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId != null ? String(entry.entityId) : null,
      oldValues: entry.oldValues != null ? redact(entry.oldValues) : null,
      newValues: entry.newValues != null ? redact(entry.newValues) : null,
      ipAddress: entry.ipAddress ?? null,
      userAgent: entry.userAgent ?? null,
    });
  } catch (err) {
    console.error("[audit] failed to write audit log", {
      action: entry.action,
      entityType: entry.entityType,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Extract the client IP from request headers. */
export function clientIp(request: Request): string | null {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null
  );
}
