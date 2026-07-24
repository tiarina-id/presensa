"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { ArrowLeft, ArrowRight, Check, Wrench, LocateFixed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

const LocationPicker = dynamic(
  () => import("@/components/location-picker").then((m) => m.LocationPicker),
  { ssr: false, loading: () => <Skeleton className="h-[260px] w-full" /> }
);

const TIMEZONES = [
  "UTC",
  "Asia/Jakarta",
  "Asia/Makassar",
  "Asia/Jayapura",
  "Asia/Singapore",
  "Asia/Kuala_Lumpur",
  "Asia/Bangkok",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Australia/Sydney",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
];

const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "id", name: "Bahasa Indonesia" },
];

const STEP_TITLES = [
  "Administrator account",
  "Application name",
  "Organization",
  "Language",
  "Timezone",
  "Office location",
  "Attendance radius",
  "GPS accuracy",
  "Object storage",
  "Finish",
];

interface SetupData {
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  appName: string;
  organizationName: string;
  language: string;
  timezone: string;
  officeName: string;
  officeAddress: string;
  officeLatitude: number | null;
  officeLongitude: number | null;
  allowedRadiusMeter: number;
  maximumAccuracyMeter: number;
  storageDriver: string;
  storageEndpoint: string;
  storageRegion: string;
  storageBucket: string;
  storageAccessKey: string;
  storageSecretKey: string;
  storageForcePathStyle: boolean;
}

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<SetupData>({
    adminName: "",
    adminEmail: "",
    adminPassword: "",
    appName: "Presensa",
    organizationName: "",
    language: "en",
    timezone: "UTC",
    officeName: "",
    officeAddress: "",
    officeLatitude: null,
    officeLongitude: null,
    allowedRadiusMeter: 100,
    maximumAccuracyMeter: 50,
    storageDriver: "s3",
    storageEndpoint: "",
    storageRegion: "",
    storageBucket: "presensa",
    storageAccessKey: "",
    storageSecretKey: "",
    storageForcePathStyle: false,
  });

  function update<K extends keyof SetupData>(field: K, value: SetupData[K]) {
    setData((prev) => ({ ...prev, [field]: value }));
  }

  const totalSteps = STEP_TITLES.length;
  const isLastStep = step === totalSteps - 1;

  function canProceed(): boolean {
    switch (step) {
      case 0:
        return (
          !!data.adminName &&
          /.+@.+\..+/.test(data.adminEmail) &&
          data.adminPassword.length >= 8
        );
      case 1:
        return data.appName.trim().length > 0;
      case 2:
        return data.organizationName.trim().length > 0;
      case 5:
        // Office is optional, but if a name is given, require coordinates.
        return (
          !data.officeName ||
          (data.officeLatitude != null && data.officeLongitude != null)
        );
      case 8:
        // Storage is optional, but keys come as a pair.
        return (
          (!data.storageAccessKey && !data.storageSecretKey) ||
          (!!data.storageAccessKey && !!data.storageSecretKey)
        );
      default:
        return true;
    }
  }

  async function handleSubmit() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/setup/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminName: data.adminName,
          adminEmail: data.adminEmail,
          adminPassword: data.adminPassword,
          appName: data.appName,
          organizationName: data.organizationName,
          language: data.language,
          timezone: data.timezone,
          officeName: data.officeName || undefined,
          officeAddress: data.officeAddress || undefined,
          officeLatitude: data.officeLatitude ?? undefined,
          officeLongitude: data.officeLongitude ?? undefined,
          allowedRadiusMeter: data.allowedRadiusMeter,
          maximumAccuracyMeter: data.maximumAccuracyMeter,
          storageProvider:
            data.storageAccessKey && data.storageSecretKey
              ? {
                  driver: data.storageDriver,
                  endpoint: data.storageEndpoint,
                  region: data.storageRegion,
                  bucket: data.storageBucket,
                  accessKey: data.storageAccessKey,
                  secretKey: data.storageSecretKey,
                  forcePathStyle: data.storageForcePathStyle,
                }
              : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error || "Setup failed");
        return;
      }
      router.push("/login");
      router.refresh();
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function useMyLocation() {
    navigator.geolocation?.getCurrentPosition((pos) =>
      setData((d) => ({
        ...d,
        officeLatitude: pos.coords.latitude,
        officeLongitude: pos.coords.longitude,
      }))
    );
  }

  function renderStep() {
    switch (step) {
      case 0:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="adminName">Full Name</Label>
              <Input
                id="adminName"
                value={data.adminName}
                onChange={(e) => update("adminName", e.target.value)}
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adminEmail">Email</Label>
              <Input
                id="adminEmail"
                type="email"
                value={data.adminEmail}
                onChange={(e) => update("adminEmail", e.target.value)}
                placeholder="admin@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adminPassword">Password</Label>
              <Input
                id="adminPassword"
                type="password"
                value={data.adminPassword}
                onChange={(e) => update("adminPassword", e.target.value)}
                placeholder="At least 8 characters"
                minLength={8}
              />
            </div>
          </div>
        );
      case 1:
        return (
          <div className="space-y-2">
            <Label htmlFor="appName">Application Name</Label>
            <Input
              id="appName"
              value={data.appName}
              onChange={(e) => update("appName", e.target.value)}
              placeholder="Presensa"
            />
          </div>
        );
      case 2:
        return (
          <div className="space-y-2">
            <Label htmlFor="orgName">Organization Name</Label>
            <Input
              id="orgName"
              value={data.organizationName}
              onChange={(e) => update("organizationName", e.target.value)}
              placeholder="My Company"
            />
          </div>
        );
      case 3:
        return (
          <div className="space-y-2">
            <Label htmlFor="language">Language</Label>
            <Select
              id="language"
              value={data.language}
              onChange={(e) => update("language", e.target.value)}
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </Select>
          </div>
        );
      case 4:
        return (
          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Select
              id="timezone"
              value={data.timezone}
              onChange={(e) => update("timezone", e.target.value)}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </Select>
          </div>
        );
      case 5:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="officeName">Office Name</Label>
              <Input
                id="officeName"
                value={data.officeName}
                onChange={(e) => update("officeName", e.target.value)}
                placeholder="Head Office (optional)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="officeAddress">Address</Label>
              <Input
                id="officeAddress"
                value={data.officeAddress}
                onChange={(e) => update("officeAddress", e.target.value)}
                placeholder="123 Main Street"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Location</Label>
                <button
                  type="button"
                  onClick={useMyLocation}
                  className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                >
                  <LocateFixed size={14} />
                  Use my location
                </button>
              </div>
              <LocationPicker
                latitude={data.officeLatitude}
                longitude={data.officeLongitude}
                onChange={(lat, lng) =>
                  setData((d) => ({
                    ...d,
                    officeLatitude: lat,
                    officeLongitude: lng,
                  }))
                }
              />
              <p className="text-xs text-text-muted">
                {data.officeLatitude != null && data.officeLongitude != null
                  ? `Selected: ${data.officeLatitude.toFixed(6)}, ${data.officeLongitude.toFixed(6)}`
                  : "Tap the map to place the office marker (optional)."}
              </p>
            </div>
          </div>
        );
      case 6:
        return (
          <div className="space-y-2">
            <Label htmlFor="radius">Allowed Radius (meters)</Label>
            <Input
              id="radius"
              type="number"
              value={data.allowedRadiusMeter}
              onChange={(e) =>
                update("allowedRadiusMeter", parseInt(e.target.value) || 100)
              }
            />
            <p className="text-xs text-text-muted">
              Maximum distance from the office for a valid check-in.
            </p>
          </div>
        );
      case 7:
        return (
          <div className="space-y-2">
            <Label htmlFor="accuracy">Maximum GPS Accuracy (meters)</Label>
            <Input
              id="accuracy"
              type="number"
              value={data.maximumAccuracyMeter}
              onChange={(e) =>
                update("maximumAccuracyMeter", parseInt(e.target.value) || 50)
              }
            />
            <p className="text-xs text-text-muted">
              Lower value = more accurate location required.
            </p>
          </div>
        );
      case 8:
        return (
          <div className="space-y-4">
            <p className="text-body text-text-muted">
              Configure S3-compatible storage for attendance photos. You can also
              set this up later from the admin panel.
            </p>
            <div className="space-y-2">
              <Label htmlFor="driver">Driver</Label>
              <Select
                id="driver"
                value={data.storageDriver}
                onChange={(e) => update("storageDriver", e.target.value)}
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
              <Label htmlFor="endpoint">Endpoint</Label>
              <Input
                id="endpoint"
                value={data.storageEndpoint}
                onChange={(e) => update("storageEndpoint", e.target.value)}
                placeholder="https://s3.amazonaws.com"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="region">Region</Label>
                <Input
                  id="region"
                  value={data.storageRegion}
                  onChange={(e) => update("storageRegion", e.target.value)}
                  placeholder="us-east-1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bucket">Bucket</Label>
                <Input
                  id="bucket"
                  value={data.storageBucket}
                  onChange={(e) => update("storageBucket", e.target.value)}
                  placeholder="presensa"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="accessKey">Access Key</Label>
              <Input
                id="accessKey"
                value={data.storageAccessKey}
                onChange={(e) => update("storageAccessKey", e.target.value)}
                placeholder="AKIA…"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="secretKey">Secret Key</Label>
              <Input
                id="secretKey"
                type="password"
                value={data.storageSecretKey}
                onChange={(e) => update("storageSecretKey", e.target.value)}
                placeholder="Your secret key"
                autoComplete="new-password"
              />
            </div>
          </div>
        );
      case 9:
        return (
          <div className="text-center space-y-3 py-6">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15">
              <Check size={24} className="text-emerald-600" />
            </div>
            <div className="text-heading text-primary">Setup Complete!</div>
            <p className="text-body text-text-muted">
              Your organization is ready. Click Finish to proceed to login.
            </p>
          </div>
        );
      default:
        return null;
    }
  }

  const progress = ((step + 1) / totalSteps) * 100;

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-surface p-4">
      <Card className="w-full max-w-[520px]">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <Wrench size={20} className="text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-heading text-primary">
            {STEP_TITLES[step]}
          </CardTitle>
          <p className="text-body text-text-muted">
            Step {step + 1} of {totalSteps}
          </p>
        </CardHeader>
        <CardContent>
          {/* Progress bar (replaces the overflowing 10-box indicator) */}
          <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-surface">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="min-h-[220px]">{renderStep()}</div>

          {error && (
            <Alert variant="error" className="mt-3">
              {error}
            </Alert>
          )}

          <div className="mt-6 flex justify-between">
            <Button
              variant="outline"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
            >
              <ArrowLeft size={16} />
              Back
            </Button>
            {isLastStep ? (
              <Button onClick={handleSubmit} disabled={loading}>
                <Check size={16} />
                {loading ? "Finishing…" : "Finish"}
              </Button>
            ) : (
              <Button
                onClick={() => setStep((s) => s + 1)}
                disabled={!canProceed()}
              >
                Next
                <ArrowRight size={16} />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
