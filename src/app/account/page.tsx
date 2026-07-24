"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, KeyRound, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/lib/i18n";

export default function AccountPage() {
  const t = useT();
  const router = useRouter();
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirm: "",
  });
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  function update(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    if (form.newPassword !== form.confirm) {
      setFeedback({ kind: "error", text: t("account.mismatch") });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: form.currentPassword,
          newPassword: form.newPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFeedback({
          kind: "error",
          text:
            data.code === "WRONG_PASSWORD"
              ? t("account.wrongCurrent")
              : data.error || t("common.connectionError"),
        });
        return;
      }
      setForm({ currentPassword: "", newPassword: "", confirm: "" });
      setFeedback({ kind: "success", text: t("account.saved") });
      router.refresh();
    } catch {
      setFeedback({ kind: "error", text: t("common.connectionError") });
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-[100dvh] bg-surface">
      <div className="mx-auto max-w-[480px] px-4 py-8">
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-1 text-body text-text-muted hover:text-primary"
        >
          <ArrowLeft size={16} />
          {t("account.back")}
        </Link>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <KeyRound size={20} className="text-accent" />
              <CardTitle className="text-heading text-primary">
                {t("account.title")}
              </CardTitle>
            </div>
            <p className="text-body text-text-muted">{t("account.subtitle")}</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {feedback && (
                <Alert variant={feedback.kind}>{feedback.text}</Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="current">{t("account.current")}</Label>
                <Input
                  id="current"
                  type="password"
                  value={form.currentPassword}
                  onChange={update("currentPassword")}
                  required
                  autoComplete="current-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new">{t("account.new")}</Label>
                <Input
                  id="new"
                  type="password"
                  value={form.newPassword}
                  onChange={update("newPassword")}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">{t("account.confirm")}</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={form.confirm}
                  onChange={update("confirm")}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              <Button type="submit" disabled={saving}>
                <Save size={16} />
                {saving ? t("common.saving") : t("account.save")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
