"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Save, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { useT } from "@/lib/i18n";

function EmployeeForm() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");
  const isEdit = !!editId;

  const [form, setForm] = useState({
    employeeId: "",
    fullName: "",
    email: "",
    password: "",
    phone: "",
    position: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!editId) return;
    fetch("/api/admin/employees")
      .then((r) => r.json())
      .then((list) => {
        const emp = Array.isArray(list)
          ? list.find((e) => String(e.id) === editId)
          : null;
        if (emp) {
          setForm({
            employeeId: emp.employeeId,
            fullName: emp.fullName,
            email: emp.email,
            password: "",
            phone: emp.phone || "",
            position: emp.position || "",
          });
        }
      })
      .catch(() => setError(t("employees.loadError")));
  }, [editId, t]);

  function update(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = isEdit
        ? await fetch("/api/admin/employees", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: Number(editId),
              fullName: form.fullName,
              email: form.email,
              phone: form.phone,
              position: form.position,
              ...(form.password ? { password: form.password } : {}),
            }),
          })
        : await fetch("/api/admin/employees", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form),
          });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || t("employees.new.createFailed"));
        return;
      }
      router.push("/admin/employees");
      router.refresh();
    } catch {
      setError(t("common.connectionError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-[520px]">
      <div className="flex items-center gap-2 mb-5">
        <UserPlus size={22} className="text-accent" />
        <h1 className="text-display text-primary">
          {isEdit ? t("employees.new.edit") : t("employees.new.title")}
        </h1>
      </div>
      {!isEdit && (
        <p className="mb-5 text-body text-text-muted">
          {t("employees.new.note")}
        </p>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}
        <div className="space-y-2">
          <Label htmlFor="employeeId">{t("employees.new.employeeId")}</Label>
          <Input
            id="employeeId"
            value={form.employeeId}
            onChange={update("employeeId")}
            required
            disabled={isEdit}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fullName">{t("employees.new.fullName")}</Label>
          <Input
            id="fullName"
            value={form.fullName}
            onChange={update("fullName")}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">{t("employees.email")}</Label>
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={update("email")}
            required
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">
            {isEdit
              ? t("employees.new.resetPassword")
              : t("employees.new.password")}
          </Label>
          <Input
            id="password"
            type="password"
            value={form.password}
            onChange={update("password")}
            required={!isEdit}
            minLength={8}
            autoComplete="new-password"
          />
          <p className="text-xs text-text-muted">
            {isEdit
              ? t("employees.new.resetPasswordHint")
              : t("employees.new.passwordHint")}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">{t("employees.new.phone")}</Label>
          <Input id="phone" value={form.phone} onChange={update("phone")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="position">{t("employees.position")}</Label>
          <Input
            id="position"
            value={form.position}
            onChange={update("position")}
          />
        </div>
        <Button type="submit" disabled={saving}>
          <Save size={16} />
          {saving ? t("common.saving") : t("employees.new.save")}
        </Button>
      </form>
    </div>
  );
}

export default function NewEmployeePage() {
  return (
    <Suspense fallback={null}>
      <EmployeeForm />
    </Suspense>
  );
}
