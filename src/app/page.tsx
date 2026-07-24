import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

// The proxy normally routes "/" already; this is a defensive fallback so the
// root never renders a placeholder.
export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "EMPLOYEE") redirect("/employee");
  redirect("/admin");
}
