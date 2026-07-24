import { NextResponse } from "next/server";
import { requireRole, CONFIG_ROLES } from "@/lib/auth";
import { testStorageConnection } from "@/lib/storage";

export async function POST() {
  const guard = await requireRole(CONFIG_ROLES);
  if (guard.response) return guard.response;

  try {
    const result = await testStorageConnection();
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Storage connection failed";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
