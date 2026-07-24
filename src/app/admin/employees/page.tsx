"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Users, Pencil, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { TableSkeleton } from "@/components/ui/skeleton";
import {
  TableContainer,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { useT } from "@/lib/i18n";

interface Employee {
  id: number;
  employeeId: string;
  fullName: string;
  email: string;
  position: string | null;
  isActive: boolean;
}

export default function EmployeesPage() {
  const t = useT();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  function load() {
    setError("");
    fetch("/api/admin/employees")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => setEmployees(Array.isArray(data) ? data : []))
      .catch(() => setError(t("employees.loadError")))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleActive(emp: Employee) {
    setBusyId(emp.id);
    try {
      if (emp.isActive) {
        await fetch(`/api/admin/employees/${emp.id}`, { method: "DELETE" });
      } else {
        await fetch("/api/admin/employees", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: emp.id, isActive: true }),
        });
      }
      load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <Users size={22} className="text-accent" />
          <div>
            <h1 className="text-display text-primary">{t("employees.title")}</h1>
            <p className="text-body text-text-muted">
              {t("employees.subtitle")}
            </p>
          </div>
        </div>
        <Link href="/admin/employees/new">
          <Button>
            <Plus size={16} />
            {t("employees.add")}
          </Button>
        </Link>
      </div>

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}

      {loading ? (
        <TableSkeleton rows={5} cols={6} />
      ) : (
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("employees.id")}</TableHead>
                <TableHead>{t("employees.name")}</TableHead>
                <TableHead>{t("employees.email")}</TableHead>
                <TableHead>{t("employees.position")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead className="text-right">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((emp) => (
                <TableRow key={emp.id}>
                  <TableCell className="font-mono text-xs">
                    {emp.employeeId}
                  </TableCell>
                  <TableCell>{emp.fullName}</TableCell>
                  <TableCell className="text-text-muted">{emp.email}</TableCell>
                  <TableCell>{emp.position || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={emp.isActive ? "success" : "neutral"}>
                      {emp.isActive ? t("common.active") : t("common.inactive")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/admin/employees/new?id=${emp.id}`}>
                        <Button variant="ghost" size="sm">
                          <Pencil size={14} />
                          {t("common.edit")}
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busyId === emp.id}
                        onClick={() => toggleActive(emp)}
                      >
                        <Power size={14} />
                        {emp.isActive
                          ? t("common.deactivate")
                          : t("common.activate")}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {employees.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-8 text-center text-text-muted"
                  >
                    {t("employees.empty")}
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
