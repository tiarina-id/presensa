"use client";

import { useState, useEffect } from "react";
import { Plus, Clock, Pencil, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

interface Shift {
  id: number;
  name: string;
  startTime: string;
  endTime: string;
  lateThresholdMinutes: number;
  isActive: boolean;
}

const EMPTY = {
  name: "",
  startTime: "08:00",
  endTime: "17:00",
  lateThresholdMinutes: 0,
};

export default function ShiftsPage() {
  const t = useT();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY);

  function load() {
    setError("");
    fetch("/api/admin/shifts")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => setShifts(Array.isArray(data) ? data : []))
      .catch(() => setError(t("shifts.loadError")))
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

  function openEdit(s: Shift) {
    setEditingId(s.id);
    setForm({
      name: s.name,
      startTime: s.startTime.slice(0, 5),
      endTime: s.endTime.slice(0, 5),
      lateThresholdMinutes: s.lateThresholdMinutes,
    });
    setFormError("");
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      const res = editingId
        ? await fetch("/api/admin/shifts", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: editingId, ...form }),
          })
        : await fetch("/api/admin/shifts", {
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

  async function toggleActive(s: Shift) {
    setBusyId(s.id);
    try {
      if (s.isActive) {
        await fetch(`/api/admin/shifts/${s.id}`, { method: "DELETE" });
      } else {
        await fetch("/api/admin/shifts", {
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

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <Clock size={22} className="text-accent" />
          <div>
            <h1 className="text-display text-primary">{t("shifts.title")}</h1>
            <p className="text-body text-text-muted">{t("shifts.subtitle")}</p>
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
              {t("shifts.add")}
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
            {editingId ? t("shifts.edit") : t("shifts.add")}
          </div>
          {formError && <Alert variant="error">{formError}</Alert>}
          <div className="space-y-2">
            <Label htmlFor="name">{t("shifts.name")}</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start">{t("shifts.start")}</Label>
              <Input
                id="start"
                type="time"
                value={form.startTime}
                onChange={(e) =>
                  setForm((f) => ({ ...f, startTime: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end">{t("shifts.end")}</Label>
              <Input
                id="end"
                type="time"
                value={form.endTime}
                onChange={(e) =>
                  setForm((f) => ({ ...f, endTime: e.target.value }))
                }
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="late">{t("shifts.late")}</Label>
            <Input
              id="late"
              type="number"
              min={0}
              value={form.lateThresholdMinutes}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  lateThresholdMinutes: parseInt(e.target.value) || 0,
                }))
              }
            />
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? t("common.saving") : t("shifts.save")}
          </Button>
        </form>
      )}

      {loading ? (
        <TableSkeleton rows={4} cols={5} />
      ) : (
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("shifts.name")}</TableHead>
                <TableHead>{t("shifts.startCol")}</TableHead>
                <TableHead>{t("shifts.endCol")}</TableHead>
                <TableHead>{t("shifts.lateCol")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead className="text-right">
                  {t("common.actions")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shifts.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.name}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {s.startTime.slice(0, 5)}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {s.endTime.slice(0, 5)}
                  </TableCell>
                  <TableCell>
                    {t("shifts.minutes", { n: s.lateThresholdMinutes })}
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
              {shifts.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-8 text-center text-text-muted"
                  >
                    {t("shifts.empty")}
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
