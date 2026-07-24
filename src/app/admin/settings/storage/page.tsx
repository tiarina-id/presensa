"use client";

import { useState, useEffect } from "react";
import { Save, HardDrive, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useT } from "@/lib/i18n";

interface StorageConfig {
  driver: string;
  endpoint: string;
  region: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  forcePathStyle: boolean;
  publicUrl: string;
  objectPrefix: string;
  signedUrlExpiration: number;
}

export default function StorageSettingsPage() {
  const t = useT();
  const [config, setConfig] = useState<StorageConfig | null>(null);
  const [accessKeyDisplay, setAccessKeyDisplay] = useState("");
  const [hasSecretKey, setHasSecretKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error" | "info";
    text: string;
  } | null>(null);

  function set<K extends keyof StorageConfig>(key: K, value: StorageConfig[K]) {
    setConfig((c) => (c ? { ...c, [key]: value } : c));
  }

  useEffect(() => {
    fetch("/api/admin/storage")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => {
        setConfig({
          driver: data.driver || "s3",
          endpoint: data.endpoint || "",
          region: data.region || "",
          bucket: data.bucket || "presensa",
          accessKey: "",
          secretKey: "",
          forcePathStyle: data.forcePathStyle || false,
          publicUrl: data.publicUrl || "",
          objectPrefix: data.objectPrefix || "",
          signedUrlExpiration: data.signedUrlExpiration || 3600,
        });
        setAccessKeyDisplay(data.accessKeyDisplay || "");
        setHasSecretKey(!!data.hasSecretKey);
      })
      .catch(() => setLoadError(t("storage.loadError")))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    if (!config) return;
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/storage", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error();
      setFeedback({ kind: "success", text: t("storage.saved") });
    } catch {
      setFeedback({ kind: "error", text: t("storage.saveFailed") });
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setFeedback({ kind: "info", text: t("storage.testing") });
    try {
      const res = await fetch("/api/admin/storage/test", { method: "POST" });
      const data = await res.json();
      setFeedback({
        kind: data.success ? "success" : "error",
        text: data.success
          ? t("storage.testOk")
          : t("storage.testFail", { msg: data.message || "connection error" }),
      });
    } catch {
      setFeedback({ kind: "error", text: t("common.connectionError") });
    }
  }

  return (
    <div className="max-w-[600px]">
      <h1 className="text-display text-primary flex items-center gap-2">
        <HardDrive size={22} className="text-accent" />
        {t("storage.title")}
      </h1>
      <p className="text-body text-text-muted">{t("storage.subtitle")}</p>

      {loadError && <Alert variant="error" className="mt-4">{loadError}</Alert>}

      {loading || !config ? (
        <div className="mt-5 space-y-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : (
        <>
          <div className="mt-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="driver">{t("storage.driver")}</Label>
              <Select
                id="driver"
                value={config.driver}
                onChange={(e) => set("driver", e.target.value)}
              >
                <option value="s3">Amazon S3</option>
                <option value="r2">Cloudflare R2</option>
                <option value="minio">MinIO</option>
                <option value="wasabi">Wasabi</option>
                <option value="b2">Backblaze B2</option>
                <option value="spaces">DigitalOcean Spaces</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="endpoint">{t("storage.endpoint")}</Label>
              <Input
                id="endpoint"
                value={config.endpoint}
                onChange={(e) => set("endpoint", e.target.value)}
                placeholder="https://s3.amazonaws.com"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="region">{t("storage.region")}</Label>
                <Input
                  id="region"
                  value={config.region}
                  onChange={(e) => set("region", e.target.value)}
                  placeholder="us-east-1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bucket">{t("storage.bucket")}</Label>
                <Input
                  id="bucket"
                  value={config.bucket}
                  onChange={(e) => set("bucket", e.target.value)}
                  placeholder="presensa"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="accessKey">{t("storage.accessKey")}</Label>
              <Input
                id="accessKey"
                value={config.accessKey}
                onChange={(e) => set("accessKey", e.target.value)}
                placeholder={
                  accessKeyDisplay
                    ? `${accessKeyDisplay} (${t("storage.keepBlank")})`
                    : t("storage.accessKey")
                }
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="secretKey">{t("storage.secretKey")}</Label>
              <Input
                id="secretKey"
                type="password"
                value={config.secretKey}
                onChange={(e) => set("secretKey", e.target.value)}
                placeholder={
                  hasSecretKey
                    ? `•••••••• (${t("storage.keepBlank")})`
                    : t("storage.secretKey")
                }
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prefix">{t("storage.prefix")}</Label>
              <Input
                id="prefix"
                value={config.objectPrefix}
                onChange={(e) => set("objectPrefix", e.target.value)}
                placeholder="presensa"
              />
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={handleSave} disabled={saving}>
                <Save size={16} />
                {saving ? t("common.saving") : t("common.save")}
              </Button>
              <Button variant="outline" onClick={handleTest}>
                <Wifi size={16} />
                {t("storage.test")}
              </Button>
            </div>
            <p className="text-xs text-text-muted">{t("storage.testHint")}</p>
            {feedback && <Alert variant={feedback.kind}>{feedback.text}</Alert>}
          </div>
        </>
      )}
    </div>
  );
}
