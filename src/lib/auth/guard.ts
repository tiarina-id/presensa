import { NextResponse } from "next/server";
import { getCurrentUser, type CurrentUser } from "./session";

export type AuthedUser = NonNullable<CurrentUser>;
export type UserRole = AuthedUser["role"];

/** Roles allowed to reach the admin panel / admin APIs at all. */
export const ADMIN_ROLES: UserRole[] = ["SUPER_ADMIN", "ADMIN", "HR", "MANAGER"];
/** Roles allowed to change sensitive configuration (settings, storage). */
export const CONFIG_ROLES: UserRole[] = ["SUPER_ADMIN", "ADMIN"];

type GuardResult =
  | { user: AuthedUser; response?: undefined }
  | { user?: undefined; response: NextResponse };

function unauthorized(): GuardResult {
  return {
    response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
  };
}

function forbidden(): GuardResult {
  return {
    response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
  };
}

/** Require any authenticated user. */
export async function requireUser(): Promise<GuardResult> {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  return { user };
}

/** Require an authenticated user whose role is in `roles`. */
export async function requireRole(roles: UserRole[]): Promise<GuardResult> {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (!roles.includes(user.role)) return forbidden();
  return { user };
}

/** Require a user allowed into the admin surface. */
export async function requireAdmin(): Promise<GuardResult> {
  return requireRole(ADMIN_ROLES);
}
