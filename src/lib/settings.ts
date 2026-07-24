import { eq } from "drizzle-orm";
import { getDb } from "@/database/connection";
import { settings } from "@/database/schema/settings";

const DEFAULT_APP_NAME = "Presensa";

/**
 * Read the configured application name. Falls back to the default when the
 * database isn't set up yet (e.g. before the setup wizard runs).
 */
export interface Branding {
  appName: string;
  logo: string | null;
  favicon: string | null;
}

// Bundled default brand assets (served from /public, included in the Docker image).
const DEFAULT_LOGO = "/logo.png";
const DEFAULT_FAVICON = "/favicon.ico";

function coerceString(v: unknown): string {
  if (typeof v !== "string") return "";
  try {
    const parsed = JSON.parse(v);
    return typeof parsed === "string" ? parsed : v;
  } catch {
    return v;
  }
}

/** Read branding (app name, logo, favicon) for the login page and metadata. */
export async function getBranding(): Promise<Branding> {
  try {
    const db = await getDb();
    const rows = await db.select().from(settings);
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = coerceString(r.value);
    const appName = map.app_name?.trim() ? map.app_name : DEFAULT_APP_NAME;
    return {
      appName,
      logo: map.logo || DEFAULT_LOGO,
      favicon: map.favicon || DEFAULT_FAVICON,
    };
  } catch {
    return { appName: DEFAULT_APP_NAME, logo: DEFAULT_LOGO, favicon: DEFAULT_FAVICON };
  }
}

/** Read the configured UI language ("en" | "id"), defaulting to "en". */
export async function getLanguage(): Promise<"en" | "id"> {
  try {
    const db = await getDb();
    const [row] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, "language"))
      .limit(1);
    if (!row) return "en";
    let value = row.value as string;
    try {
      value = JSON.parse(value);
    } catch {
      /* stored as plain string */
    }
    return value === "id" ? "id" : "en";
  } catch {
    return "en";
  }
}

export async function getAppName(): Promise<string> {
  try {
    const db = await getDb();
    const [row] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, "app_name"))
      .limit(1);
    if (!row) return DEFAULT_APP_NAME;
    try {
      const parsed = JSON.parse(row.value as string);
      return typeof parsed === "string" && parsed.trim()
        ? parsed
        : DEFAULT_APP_NAME;
    } catch {
      return (row.value as string) || DEFAULT_APP_NAME;
    }
  } catch {
    return DEFAULT_APP_NAME;
  }
}
