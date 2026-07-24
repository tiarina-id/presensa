"use client";

import { useState, useEffect } from "react";
import { Plus, CalendarRange, Pencil, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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

interface Schedule {
  id: number;
  employeeId: number;
  shiftId: number;
  employeeName: string;
  shiftName: string;
  daysOfWeek: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
}
interface Option {
  id: number;
  fullName?: string;
  name?: string;
  isActive?: boolean;
}

const WEEKDAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

const EMPTY = {
  employeeId: "",
  shiftId: "",
  daysOfWeek: [1, 2, 3, 4, 5] as number[],
  effectiveFrom: "",
  effectiveTo: "",
};

export default function SchedulesPage() {
  const t = useT();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [employees, setEmployees] = useState<Option[]>([]);
  const [shifts, setShifts] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY);

  function formatDays(csv: string): string {
    const set = new Set(csv.split(",").map((s) => parseInt(s.trim(), 10)));
    if (set.size === 7) return t("schedules.everyDay");
    return WEEKDAYS.filter((d) => set.has(d.value))
      .map((d) => d.label)
      .join(", ");
  }

  function load() {
    setError("");
    Promise.all([
      fetch("/api/admin/schedules").then((r) => r.json()),
      fetch("/api/admin/employees").then((r) => r.json()),
      fetch("/api/admin/shifts").then((r) => r.json()),
    ])
      .then(([s, e, sh]) => {
        setSchedules(Array.isArray(s) ? s : []);
        setEmployees(Array.isArray(e) ? e : []);
        setShifts(Array.isArray(sh) ? sh : []);
      })
      .catch(() => setError(t("schedules.loadError")))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY);
    setFormError("");
    setShowForm(true);
  }

  function openEdit(s: Schedule) {
    setEditingId(s.id);
    setForm({
      employeeId: String(s.employeeId),
      shiftId: String(s.shiftId),
      daysOfWeek: s.daysOfWeek
        .split(",")
        .map((n) => parseInt(n, 10))
        .filter((n) => !Number.isNaN(n)),
      effectiveFrom: s.effectiveFrom ? String(s.effectiveFrom).slice(0, 10) : "",
      effectiveTo: s.effectiveTo ? String(s.effectiveTo).slice(0, 10) : "",
    });
    setFormError("");
    setShowForm(true);
  }

  function toggleDay(value: number) {
    setForm((f) => ({
      ...f,
      daysOfWeek: f.daysOfWeek.includes(value)
        ? f.daysOfWeek.filter((d) => d !== value)
        : [...f.daysOfWeek, value],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (form.daysOfWeek.length === 0) {
      setFormError(t("schedules.selectDay"));
      return;
    }
    setSaving(true);
    try {
      const res = editingId
        ? await fetch("/api/admin/schedules", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: editingId,
              shiftId: form.shiftId,
              daysOfWeek: form.daysOfWeek,
              effectiveFrom: form.effectiveFrom,
              effectiveTo: form.effectiveTo,
            }),
          })
        : await fetch("/api/admin/schedules", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form),
          });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(data.error || t("common.connectionError"));
        return;
      }
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY);
      load();
    } catch {
      setFormError(t("common.connectionError"));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(s: Schedule) {
    setBusyId(s.id);
    try {
      if (s.isActive) {
        await fetch(`/api/admin/schedules/${s.id}`, { method: "DELETE" });
      } else {
        await fetch("/api/admin/schedules", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: s.id, isActive: true }),
        });
      }
      load();
    } finally {
      setBusyId(null);
    }
  }

  const activeEmployees = employees.filter((e) => e.isActive !== false);
  const activeShifts = shifts.filter((s) => s.isActive !== false);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <CalendarRange size={22} className="text-accent" />
          <div>
            <h1 className="text-display text-primary">{t("schedules.title")}</h1>
            <p className="text-body text-text-muted">
              {t("schedules.subtitle")}
            </p>
          </div>
        </div>
        <Button
          variant={showForm ? "outline" : "default"}
          onClick={() => (showForm ? setShowForm(false) : openCreate())}
        >
          {showForm ? (
            t("common.cancel")
          ) : (
            <>
              <Plus size={16} />
              {t("schedules.add")}
            </>
          )}
        </Button>
      </div>

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="max-w-[520px] mb-6 p-4 bg-card rounded-lg border border-border space-y-3"
        >
          <div className="text-heading text-primary">
            {editingId ? t("schedules.edit") : t("schedules.add")}
          </div>
          {formError && <Alert variant="error">{formError}</Alert>}
          <div className="space-y-2">
            <Label htmlFor="employee">{t("schedules.employee")}</Label>
            <Select
              id="employee"
              value={form.employeeId}
              onChange={(e) =>
                setForm((f) => ({ ...f, employeeId: e.target.value }))
              }
              required
              disabled={!!editingId}
            >
              <option value="">{t("schedules.selectEmployee")}</option>
              {activeEmployees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="shift">{t("schedules.shift")}</Label>
            <Select
              id="shift"
              value={form.shiftId}
              onChange={(e) =>
                setForm((f) => ({ ...f, shiftId: e.target.value }))
              }
              required
            >
              <option value="">{t("schedules.selectShift")}</option>
              {activeShifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("schedules.days")}</Label>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((d) => {
                const active = form.daysOfWeek.includes(d.value);
                return (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => toggleDay(d.value)}
                    aria-pressed={active}
                    className={
                      "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors " +
                      (active
                        ? "border-accent bg-accent text-accent-foreground"
                        : "border-border bg-background text-text-muted hover:border-accent")
                    }
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-text-muted">{t("schedules.daysHint")}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="from">{t("schedules.from")}</Label>
              <Input
                id="from"
                type="date"
                value={form.effectiveFrom}
                onChange={(e) =>
                  setForm((f) => ({ ...f, effectiveFrom: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="to">{t("schedules.to")}</Label>
              <Input
                id="to"
                type="date"
                value={form.effectiveTo}
                onChange={(e) =>
                  setForm((f) => ({ ...f, effectiveTo: e.target.value }))
                }
              />
            </div>
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? t("common.saving") : t("schedules.save")}
          </Button>
        </form>
      )}

      {loading ? (
        <TableSkeleton rows={4} cols={6} />
      ) : (
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("schedules.employee")}</TableHead>
                <TableHead>{t("schedules.shift")}</TableHead>
                <TableHead>{t("schedules.daysCol")}</TableHead>
                <TableHead>{t("schedules.fromCol")}</TableHead>
                <TableHead>{t("schedules.toCol")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead className="text-right">
                  {t("common.actions")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedules.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.employeeName}</TableCell>
                  <TableCell>{s.shiftName}</TableCell>
                  <TableCell className="text-xs">
                    {formatDays(s.daysOfWeek || "")}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {String(s.effectiveFrom).slice(0, 10)}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {s.effectiveTo ? String(s.effectiveTo).slice(0, 10) : "∞"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={s.isActive ? "success" : "neutral"}>
                      {s.isActive ? t("common.active") : t("common.inactive")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(s)}
                      >
                        <Pencil size={14} />
                        {t("common.edit")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busyId === s.id}
                        onClick={() => toggleActive(s)}
                      >
                        <Power size={14} />
                        {s.isActive
                          ? t("common.deactivate")
                          : t("common.activate")}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {schedules.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-8 text-center text-text-muted"
                  >
                    {t("schedules.empty")}
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
