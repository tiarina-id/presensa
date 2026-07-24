"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building2,
  Clock,
  CalendarRange,
  FileText,
  CalendarDays,
  ClipboardList,
  Settings,
  HardDrive,
  KeyRound,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SignOutButton } from "@/components/sign-out-button";
import { useT } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n";

const navItems: {
  labelKey: MessageKey;
  href: string;
  icon: typeof Users;
  exact?: boolean;
}[] = [
  { labelKey: "nav.dashboard", href: "/admin", icon: LayoutDashboard, exact: true },
  { labelKey: "nav.employees", href: "/admin/employees", icon: Users },
  { labelKey: "nav.offices", href: "/admin/offices", icon: Building2 },
  { labelKey: "nav.shifts", href: "/admin/shifts", icon: Clock },
  { labelKey: "nav.schedules", href: "/admin/schedules", icon: CalendarRange },
  { labelKey: "nav.reports", href: "/admin/reports", icon: FileText, exact: true },
  { labelKey: "nav.monthly", href: "/admin/reports/monthly", icon: CalendarDays },
  { labelKey: "nav.audit", href: "/admin/audit-logs", icon: ClipboardList },
  { labelKey: "nav.storage", href: "/admin/settings/storage", icon: HardDrive },
  { labelKey: "nav.settings", href: "/admin/settings", icon: Settings, exact: true },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

export function AdminShell({
  appName,
  logo,
  children,
}: {
  appName: string;
  logo?: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const t = useT();

  const brand = (
    <span className="flex items-center gap-2 min-w-0">
      {logo && (
        // eslint-disable-next-line @next/next/no-img-element -- logo from settings/public
        <img src={logo} alt="" className="h-7 w-7 shrink-0 object-contain" />
      )}
      <span className="text-heading font-semibold truncate">{appName}</span>
    </span>
  );

  const nav = (
    <nav className="flex flex-col gap-0.5 px-3">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href, item.exact);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 px-3 py-2 text-body rounded-md transition-colors",
              active
                ? "bg-white/15 font-medium"
                : "text-primary-foreground/80 hover:bg-white/10 hover:text-primary-foreground"
            )}
          >
            <Icon size={16} />
            {t(item.labelKey)}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-[100dvh]">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-[240px] shrink-0 flex-col bg-primary text-primary-foreground">
        <div className="p-4">
          <Link href="/admin">{brand}</Link>
        </div>
        <div className="flex-1 overflow-y-auto py-2">{nav}</div>
        <div className="border-t border-white/10 p-4 space-y-3">
          <Link
            href="/account"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 text-body text-primary-foreground/80 hover:text-primary-foreground"
          >
            <KeyRound size={16} />
            {t("account.link")}
          </Link>
          <SignOutButton className="text-primary-foreground/80 hover:text-primary-foreground" />
        </div>
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-[260px] flex-col bg-primary text-primary-foreground">
            <div className="flex items-center justify-between p-4">
              {brand}
              <button onClick={() => setOpen(false)} aria-label="Close menu">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-2">{nav}</div>
            <div className="border-t border-white/10 p-4">
              <SignOutButton className="text-primary-foreground/80 hover:text-primary-foreground" />
            </div>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex items-center gap-3 border-b border-border bg-primary px-4 py-3 text-primary-foreground md:hidden">
          <button onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu size={22} />
          </button>
          {brand}
        </header>

        <main className="flex-1 bg-surface p-4 md:p-6">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
