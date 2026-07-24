import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "./session";
import { getDb } from "@/database/connection";
import { users } from "@/database/schema/users";

// Once setup is complete it can never be undone, so cache the positive result.
let _setupComplete = false;

async function isSetupComplete(): Promise<boolean> {
  if (_setupComplete) return true;
  try {
    const db = await getDb();
    const [row] = await db.select({ id: users.id }).from(users).limit(1);
    if (row) _setupComplete = true;
    return !!row;
  } catch {
    // If the DB isn't reachable, don't force a setup redirect loop.
    return true;
  }
}

// Exact-match public routes (no auth needed).
const publicExact = new Set([
  "/login",
  "/setup",
  "/api/auth/login",
  "/api/health",
  "/api/setup/status",
  "/api/setup/complete",
  "/favicon.ico",
]);

// Prefix-match public routes (framework assets).
const publicPrefixes = ["/_next/", "/setup/", "/login/"];

function isPublic(pathname: string): boolean {
  if (publicExact.has(pathname)) return true;
  return publicPrefixes.some((p) => pathname.startsWith(p));
}

export async function authProxy(
  request: NextRequest
): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl;

  // First-run: if no admin exists yet, funnel everyone to the setup wizard.
  const onSetup = pathname === "/setup" || pathname.startsWith("/setup/");
  if (!onSetup && !pathname.startsWith("/api/")) {
    if (!(await isSetupComplete())) {
      return NextResponse.redirect(new URL("/setup", request.url));
    }
  }

  if (isPublic(pathname)) {
    return null;
  }

  if (pathname.startsWith("/api/")) {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return null;
  }

  const user = await getCurrentUser();
  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/") {
    if (user.role === "EMPLOYEE") {
      return NextResponse.redirect(new URL("/employee", request.url));
    }
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  if (pathname.startsWith("/admin") && user.role === "EMPLOYEE") {
    return NextResponse.redirect(new URL("/employee", request.url));
  }

  if (pathname.startsWith("/employee") && user.role !== "EMPLOYEE") {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return null;
}
