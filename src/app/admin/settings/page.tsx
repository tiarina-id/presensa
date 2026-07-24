"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Save, Settings as SettingsIcon, Upload, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useT } from "@/lib/i18n";

export default function SettingsPage() {
  const t = useT();
  const router = useRouter();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => setSettings(data || {}))
      .catch(() => setLoadError(t("settings.loadError")))
      .finally(() => setLoading(false));
  }, []);

  function pickImage(key: "logo" | "favicon", maxKb: number) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/svg+xml,image/webp,image/x-icon";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        setFeedback({ kind: "error", text: t("settings.imageInvalid") });
        return;
      }
      if (file.size > maxKb * 1024) {
        setFeedback({
          kind: "error",
          text: t("settings.imageTooLarge", { kb: maxKb }),
        });
        return;
      }
      const reader = new FileReader();
      reader.onload = () =>
        setSettings((s) => ({ ...s, [key]: String(reader.result) }));
      reader.readAsDataURL(file);
    };
    input.click();
  }

  async function handleSave() {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error();
      setFeedback({ kind: "success", text: t("settings.saved") });
      // Re-render server components so the new language/app name apply.
      router.refresh();
    } catch {
      setFeedback({ kind: "error", text: t("settings.saveFailed") });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-[600px]">
      <h1 className="text-display text-primary flex items-center gap-2">
        <SettingsIcon size={22} className="text-accent" />
        {t("settings.title")}
      </h1>
      <p className="text-body text-text-muted">{t("settings.subtitle")}</p>

      {loadError && <Alert variant="error" className="mt-4">{loadError}</Alert>}

      {loading ? (
        <div className="mt-5 space-y-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : (
        <>
          <div className="mt-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="appName">{t("settings.appName")}</Label>
              <Input
                id="appName"
                value={settings.app_name || ""}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, app_name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="language">{t("settings.language")}</Label>
              <Select
                id="language"
                value={settings.language || "en"}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, language: e.target.value }))
                }
              >
                <option value="en">English</option>
                <option value="id">Bahasa Indonesia</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone">{t("settings.timezone")}</Label>
              <Select
                id="timezone"
                value={settings.timezone || "UTC"}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, timezone: e.target.value }))
                }
              >
                <option value="UTC">UTC</option>
                <option value="Asia/Jakarta">Asia/Jakarta</option>
                <option value="Asia/Makassar">Asia/Makassar</option>
                <option value="Asia/Jayapura">Asia/Jayapura</option>
                <option value="Asia/Singapore">Asia/Singapore</option>
              </Select>
            </div>
          </div>

          <h2 className="mt-8 text-heading text-primary">
            {t("settings.branding")}
          </h2>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("settings.logo")}</Label>
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-md border border-border bg-surface overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
                  <img
                    src={settings.logo || "/logo.png"}
                    alt="Logo"
                    className="h-full w-full object-contain"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => pickImage("logo", 200)}
                  >
                    <Upload size={14} />
                    {t("settings.upload")}
                  </Button>
                  {settings.logo && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setSettings((s) => ({ ...s, logo: "" }))
                      }
                    >
                      <Trash2 size={14} />
                      {t("settings.remove")}
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-xs text-text-muted">{t("settings.logoHint")}</p>
            </div>

            <div className="space-y-2">
              <Label>{t("settings.favicon")}</Label>
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-md border border-border bg-surface overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
                  <img
                    src={settings.favicon || "/favicon.ico"}
                    alt="Favicon"
                    className="h-8 w-8 object-contain"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => pickImage("favicon", 50)}
                  >
                    <Upload size={14} />
                    {t("settings.upload")}
                  </Button>
                  {settings.favicon && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setSettings((s) => ({ ...s, favicon: "" }))
                      }
                    >
                      <Trash2 size={14} />
                      {t("settings.remove")}
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-xs text-text-muted">
                {t("settings.faviconHint")}
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <Button onClick={handleSave} disabled={saving}>
              <Save size={16} />
              {saving ? t("common.saving") : t("settings.save")}
            </Button>
            {feedback && (
              <Alert variant={feedback.kind}>{feedback.text}</Alert>
            )}
          </div>
        </>
      )}
    </div>
  );
}
