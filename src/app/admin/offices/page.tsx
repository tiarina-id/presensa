"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Plus, Building2, MapPin, LocateFixed, Pencil, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useT } from "@/lib/i18n";

const LocationPicker = dynamic(
  () => import("@/components/location-picker").then((m) => m.LocationPicker),
  { ssr: false, loading: () => <Skeleton className="h-[260px] w-full" /> }
);

interface Office {
  id: number;
  name: string;
  address: string | null;
  latitude: string;
  longitude: string;
  allowedRadiusMeter: number;
  maximumAccuracyMeter: number;
  timezone: string;
  isActive: boolean;
}

const EMPTY = {
  name: "",
  address: "",
  latitude: null as number | null,
  longitude: null as number | null,
  allowedRadiusMeter: 100,
  maximumAccuracyMeter: 50,
  timezone: "UTC",
};

export default function OfficesPage() {
  const t = useT();
  const [offices, setOffices] = useState<Office[]>([]);
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
    fetch("/api/admin/offices")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => setOffices(Array.isArray(data) ? data : []))
      .catch(() => setError(t("offices.loadError")))
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

  function openEdit(o: Office) {
    setEditingId(o.id);
    setForm({
      name: o.name,
      address: o.address || "",
      latitude: Number(o.latitude),
      longitude: Number(o.longitude),
      allowedRadiusMeter: o.allowedRadiusMeter,
      maximumAccuracyMeter: o.maximumAccuracyMeter,
      timezone: o.timezone || "UTC",
    });
    setFormError("");
    setShowForm(true);
  }

  function useMyLocation() {
    navigator.geolocation?.getCurrentPosition((pos) =>
      setForm((f) => ({
        ...f,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      }))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (form.latitude == null || form.longitude == null) {
      setFormError(t("offices.pickLocation"));
      return;
    }
    setSaving(true);
    try {
      const res = editingId
        ? await fetch("/api/admin/offices", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: editingId, ...form }),
          })
        : await fetch("/api/admin/offices", {
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

  async function toggleActive(o: Office) {
    setBusyId(o.id);
    try {
      if (o.isActive) {
        await fetch(`/api/admin/offices/${o.id}`, { method: "DELETE" });
      } else {
        await fetch("/api/admin/offices", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: o.id, isActive: true }),
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
          <Building2 size={22} className="text-accent" />
          <div>
            <h1 className="text-display text-primary">{t("offices.title")}</h1>
            <p className="text-body text-text-muted">{t("offices.subtitle")}</p>
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
              {t("offices.add")}
            </>
          )}
        </Button>
      </div>

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="max-w-[560px] mb-6 p-4 bg-card rounded-lg border border-border space-y-3"
        >
          <div className="text-heading text-primary">
            {editingId ? t("offices.edit") : t("offices.add")}
          </div>
          {formError && <Alert variant="error">{formError}</Alert>}
          <div className="space-y-2">
            <Label htmlFor="name">{t("offices.name")}</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">{t("offices.address")}</Label>
            <Input
              id="address"
              value={form.address}
              onChange={(e) =>
                setForm((f) => ({ ...f, address: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t("offices.location")}</Label>
              <button
                type="button"
                onClick={useMyLocation}
                className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
              >
                <LocateFixed size={14} />
                {t("offices.useMyLocation")}
              </button>
            </div>
            <LocationPicker
              latitude={form.latitude}
              longitude={form.longitude}
              onChange={(lat, lng) =>
                setForm((f) => ({ ...f, latitude: lat, longitude: lng }))
              }
            />
            <p className="text-xs text-text-muted">
              {form.latitude != null && form.longitude != null
                ? t("offices.selected", {
                    coords: `${form.latitude.toFixed(6)}, ${form.longitude.toFixed(6)}`,
                  })
                : t("offices.tapMap")}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="radius">{t("offices.radius")}</Label>
              <Input
                id="radius"
                type="number"
                value={form.allowedRadiusMeter}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    allowedRadiusMeter: parseInt(e.target.value) || 100,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accuracy">{t("offices.maxAccuracy")}</Label>
              <Input
                id="accuracy"
                type="number"
                value={form.maximumAccuracyMeter}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    maximumAccuracyMeter: parseInt(e.target.value) || 50,
                  }))
                }
              />
            </div>
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? t("common.saving") : t("offices.save")}
          </Button>
        </form>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : offices.length === 0 ? (
        <p className="text-body text-text-muted text-center py-8">
          {t("offices.empty")}
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {offices.map((office) => (
            <div
              key={office.id}
              className="p-4 bg-card rounded-lg border border-border"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-heading text-primary">{office.name}</h3>
                <Badge variant={office.isActive ? "success" : "neutral"}>
                  {office.isActive ? t("common.active") : t("common.inactive")}
                </Badge>
              </div>
              {office.address && (
                <p className="text-body text-text-muted">{office.address}</p>
              )}
              <p className="mt-2 flex items-center gap-1.5 text-mono text-text-muted">
                <MapPin size={14} />
                {Number(office.latitude).toFixed(5)},{" "}
                {Number(office.longitude).toFixed(5)}
              </p>
              <p className="text-body text-text-muted">
                {t("offices.radiusLabel", {
                  r: office.allowedRadiusMeter,
                  a: office.maximumAccuracyMeter,
                })}
              </p>
              <div className="mt-3 flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => openEdit(office)}>
                  <Pencil size={14} />
                  {t("common.edit")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busyId === office.id}
                  onClick={() => toggleActive(office)}
                >
                  <Power size={14} />
                  {office.isActive
                    ? t("common.deactivate")
                    : t("common.activate")}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
