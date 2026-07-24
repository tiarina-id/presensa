import { NextResponse } from "next/server";
import { getDb } from "@/database/connection";
import { users } from "@/database/schema/users";

export async function GET() {
  const db = await getDb();
  const result = await db.select({ id: users.id }).from(users).limit(1);
  const completed = result.length > 0;

  return NextResponse.json({ completed });
}
