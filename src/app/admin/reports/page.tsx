"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { FileText, Download, Filter, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { StatusBadge } from "@/components/ui/badge";
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

interface Record {
  id: number;
  employeeName: string;
  employeeCode: string;
  type: string;
  status: string;
  serverTime: string;
  withinRadius: boolean | null;
  notes: string | null;
}

export default function ReportsPage() {
  const t = useT();
  const [records, setRecords] = useState<Record[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ from: "", to: "", status: "" });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    if (filters.status) params.set("status", filters.status);
    try {
      const res = await fetch(`/api/admin/reports/attendance?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRecords(Array.isArray(data) ? data : []);
    } catch {
      setError(t("reports.loadError"));
    } finally {
      setLoading(false);
    }
  }, [filters, t]);

  useEffect(() => {
    load();
  }, []);

  function handleExportCSV() {
    const headers = ["Employee", "ID", "Type", "Status", "Time", "Within Radius"];
    const rows = records.map((r) => [
      r.employeeName,
      r.employeeCode,
      r.type,
      r.status,
      new Date(r.serverTime).toISOString(),
      r.withinRadius ? "Yes" : "No",
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <FileText size={22} className="text-accent" />
          <div>
            <h1 className="text-display text-primary">{t("reports.title")}</h1>
            <p className="text-body text-text-muted">{t("reports.subtitle")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/reports/monthly">
            <Button variant="outline">
              <CalendarDays size={16} />
              {t("reports.monthly")}
            </Button>
          </Link>
          <Button
            variant="outline"
            onClick={handleExportCSV}
            disabled={records.length === 0}
          >
            <Download size={16} />
            {t("reports.export")}
          </Button>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="from">{t("reports.from")}</Label>
          <Input
            id="from"
            type="date"
            className="w-auto"
            value={filters.from}
            onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="to">{t("reports.to")}</Label>
          <Input
            id="to"
            type="date"
            className="w-auto"
            value={filters.to}
            onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="status">{t("reports.status")}</Label>
          <Select
            id="status"
            className="w-[180px]"
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          >
            <option value="">{t("reports.all")}</option>
            <option value="PRESENT">{t("status.PRESENT")}</option>
            <option value="LATE">{t("status.LATE")}</option>
            <option value="MANUAL">{t("status.MANUAL")}</option>
            <option value="REJECTED">{t("status.REJECTED")}</option>
          </Select>
        </div>
        <Button onClick={load}>
          <Filter size={16} />
          {t("common.filter")}
        </Button>
      </div>

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}

      {loading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : (
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("reports.employee")}</TableHead>
                <TableHead>{t("reports.type")}</TableHead>
                <TableHead>{t("reports.status")}</TableHead>
                <TableHead>{t("reports.time")}</TableHead>
                <TableHead>{t("reports.location")}</TableHead>
                <TableHead>{t("reports.notes")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div>{r.employeeName}</div>
                    <div className="font-mono text-xs text-text-muted">
                      {r.employeeCode}
                    </div>
                  </TableCell>
                  <TableCell>
                    {r.type === "CHECK_IN"
                      ? t("employee.checkIn")
                      : r.type === "CHECK_OUT"
                        ? t("employee.checkOut")
                        : r.type.replace(/_/g, " ")}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="font-mono text-xs whitespace-nowrap">
                    {new Date(r.serverTime).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {r.withinRadius
                      ? t("reports.inside")
                      : r.withinRadius === false
                        ? t("reports.outside")
                        : "—"}
                  </TableCell>
                  <TableCell className="text-text-muted">
                    {r.notes || "—"}
                  </TableCell>
                </TableRow>
              ))}
              {records.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-8 text-center text-text-muted"
                  >
                    {t("reports.empty")}
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
