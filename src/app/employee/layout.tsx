import Link from "next/link";
import { KeyRound } from "lucide-react";
import { SignOutButton } from "@/components/sign-out-button";
import { getBranding, getLanguage } from "@/lib/settings";
import { translate } from "@/lib/i18n";

export default async function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [{ appName, logo }, locale] = await Promise.all([
    getBranding(),
    getLanguage(),
  ]);
  return (
    <div className="min-h-[100dvh] bg-surface">
      <header className="bg-primary text-primary-foreground">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link
            href="/employee"
            className="flex items-center gap-2 min-w-0"
          >
            {logo && (
              // eslint-disable-next-line @next/next/no-img-element -- logo from settings/public
              <img
                src={logo}
                alt=""
                className="h-7 w-7 shrink-0 object-contain"
              />
            )}
            <span className="text-heading font-semibold truncate">
              {appName}
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/account"
              className="flex items-center gap-2 text-body text-primary-foreground/80 hover:text-primary-foreground"
            >
              <KeyRound size={16} />
              <span className="hidden sm:inline">
                {translate(locale, "account.link")}
              </span>
            </Link>
            <SignOutButton className="text-primary-foreground/80 hover:text-primary-foreground" />
          </div>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-5">{children}</main>
    </div>
  );
}
