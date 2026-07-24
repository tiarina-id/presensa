import { authProxy } from "@/lib/auth/proxy";
import type { NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  return authProxy(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
