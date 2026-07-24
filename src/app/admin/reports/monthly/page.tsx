"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { CalendarDays, Download, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { TableSkeleton } from "@/components/ui/skeleton";
import { useT } from "@/lib/i18n";
import {
  TableContainer,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

interface Row {
  employeeId: number;
  code: string;
  fullName: string;
  isActive: boolean;
  present: number;
  late: number;
  scheduledDays: number;
  absent: number;
  totalHours: number;
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function MonthlyReportPage() {
  const t = useT();
  const [month, setMonth] = useState(currentMonth());
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (m: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/reports/monthly?month=${m}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRows(Array.isArray(data.rows) ? data.rows : []);
    } catch {
      setError(t("monthly.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load(month);
  }, [load, month]);

  function handleExportCSV() {
    const headers = [
      "Employee",
      "Code",
      "Present",
      "Late",
      "Scheduled Days",
      "Absent",
      "Total Hours",
    ];
    const body = rows.map((r) => [
      r.fullName,
      r.code,
      r.present,
      r.late,
      r.scheduledDays,
      r.absent,
      r.totalHours,
    ]);
    const csv = [headers, ...body]
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `recap-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <CalendarDays size={22} className="text-accent" />
          <div>
            <h1 className="text-display text-primary">{t("monthly.title")}</h1>
            <p className="text-body text-text-muted">{t("monthly.subtitle")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/reports">
            <Button variant="outline">
              <List size={16} />
              {t("reports.detail")}
            </Button>
          </Link>
          <Button
            variant="outline"
            onClick={handleExportCSV}
            disabled={rows.length === 0}
          >
            <Download size={16} />
            {t("reports.export")}
          </Button>
        </div>
      </div>

      <div className="mb-5 flex items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="month">{t("monthly.month")}</Label>
          <Input
            id="month"
            type="month"
            className="w-auto"
            value={month}
            onChange={(e) => setMonth(e.target.value || currentMonth())}
          />
        </div>
      </div>

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}

      {loading ? (
        <TableSkeleton rows={6} cols={7} />
      ) : (
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("monthly.employee")}</TableHead>
                <TableHead className="text-right">{t("monthly.present")}</TableHead>
                <TableHead className="text-right">{t("monthly.late")}</TableHead>
                <TableHead className="text-right">{t("monthly.scheduled")}</TableHead>
                <TableHead className="text-right">{t("monthly.absent")}</TableHead>
                <TableHead className="text-right">{t("monthly.hours")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.employeeId}>
                  <TableCell>
                    <div>{r.fullName}</div>
                    <div className="font-mono text-xs text-text-muted">
                      {r.code}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{r.present}</TableCell>
                  <TableCell className="text-right">
                    {r.late > 0 ? (
                      <Badge variant="warning">{r.late}</Badge>
                    ) : (
                      0
                    )}
                  </TableCell>
                  <TableCell className="text-right">{r.scheduledDays}</TableCell>
                  <TableCell className="text-right">
                    {r.absent > 0 ? (
                      <Badge variant="danger">{r.absent}</Badge>
                    ) : (
                      0
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {r.totalHours.toFixed(1)}
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-8 text-center text-text-muted"
                  >
                    {t("monthly.empty")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </div>
  );
}
