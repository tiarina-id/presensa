import Link from "next/link";
import { and, eq, gte, sql } from "drizzle-orm";
import {
  Users,
  Building2,
  LogIn,
  Clock,
  ArrowRight,
  CalendarRange,
  FileText,
} from "lucide-react";
import { getDb } from "@/database/connection";
import { getCurrentUser } from "@/lib/auth";
import { employees } from "@/database/schema/employees";
import { offices } from "@/database/schema/offices";
import { attendanceRecords } from "@/database/schema/attendance_records";
import { getLanguage } from "@/lib/settings";
import { translate } from "@/lib/i18n";

async function getStats(organizationId: number) {
  const db = await getDb();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [empRow] = await db
    .select({
      total: sql<number>`count(*)`,
      active: sql<number>`sum(case when ${employees.isActive} then 1 else 0 end)`,
    })
    .from(employees)
    .where(eq(employees.organizationId, organizationId));

  const [officeRow] = await db
    .select({ total: sql<number>`count(*)` })
    .from(offices)
    .where(eq(offices.organizationId, organizationId));

  const [todayRow] = await db
    .select({
      checkIns: sql<number>`sum(case when ${attendanceRecords.type} = 'CHECK_IN' then 1 else 0 end)`,
      late: sql<number>`sum(case when ${attendanceRecords.status} = 'LATE' then 1 else 0 end)`,
    })
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.organizationId, organizationId),
        gte(attendanceRecords.serverTime, startOfDay)
      )
    );

  return {
    employeesTotal: Number(empRow?.total ?? 0),
    employeesActive: Number(empRow?.active ?? 0),
    offices: Number(officeRow?.total ?? 0),
    checkInsToday: Number(todayRow?.checkIns ?? 0),
    lateToday: Number(todayRow?.late ?? 0),
  };
}

function StatTile({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-body text-text-muted">{label}</span>
        <Icon size={18} className="text-accent" />
      </div>
      <div className="mt-2 text-display text-primary">{value}</div>
      {hint && <div className="text-xs text-text-muted">{hint}</div>}
    </div>
  );
}

const quickLinks = [
  { href: "/admin/employees", labelKey: "nav.employees", icon: Users },
  { href: "/admin/offices", labelKey: "nav.offices", icon: Building2 },
  { href: "/admin/schedules", labelKey: "nav.schedules", icon: CalendarRange },
  { href: "/admin/reports", labelKey: "nav.reports", icon: FileText },
] as const;

export default async function AdminDashboard() {
  const [user, locale] = await Promise.all([getCurrentUser(), getLanguage()]);
  const stats = user ? await getStats(user.organizationId) : null;
  const t = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) =>
    translate(locale, key, vars);

  return (
    <div>
      <h1 className="text-display text-primary">{t("dashboard.title")}</h1>
      <p className="text-body text-text-muted">{t("dashboard.subtitle")}</p>

      {stats && (
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile
            label={t("dashboard.employees")}
            value={stats.employeesTotal}
            icon={Users}
            hint={t("dashboard.active", { n: stats.employeesActive })}
          />
          <StatTile
            label={t("dashboard.offices")}
            value={stats.offices}
            icon={Building2}
          />
          <StatTile
            label={t("dashboard.checkInsToday")}
            value={stats.checkInsToday}
            icon={LogIn}
          />
          <StatTile
            label={t("dashboard.lateToday")}
            value={stats.lateToday}
            icon={Clock}
          />
        </div>
      )}

      <h2 className="mt-8 text-heading text-primary">
        {t("dashboard.quickLinks")}
      </h2>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {quickLinks.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:border-accent"
            >
              <span className="flex items-center gap-2 text-body text-primary">
                <Icon size={18} className="text-accent" />
                {t(link.labelKey)}
              </span>
              <ArrowRight size={16} className="text-text-muted" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
