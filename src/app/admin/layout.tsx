import { AdminShell } from "@/components/admin-shell";
import { getBranding } from "@/lib/settings";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { appName, logo } = await getBranding();
  return (
    <AdminShell appName={appName} logo={logo}>
      {children}
    </AdminShell>
  );
}
