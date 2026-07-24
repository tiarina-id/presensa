import { Suspense } from "react";
import { getBranding } from "@/lib/settings";
import { LoginForm } from "./login-form";

// Branding (logo/app name) is read live from settings on each request.
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const { appName, logo } = await getBranding();
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-surface p-4">
      <Suspense fallback={null}>
        <LoginForm appName={appName} logo={logo} />
      </Suspense>
    </main>
  );
}
