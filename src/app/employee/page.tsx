"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  LogIn,
  LogOut,
  Camera,
  CheckCircle,
  XCircle,
  MapPin,
  Clock,
  History,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { StatusBadge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useT } from "@/lib/i18n";

// Above this GPS accuracy (meters) a check-in is likely to be rejected.
const ACCURACY_WARN_METERS = 50;

interface GeoLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
}

interface AttendanceRecord {
  id: number;
  type: string;
  status: string;
  serverTime: string;
}

interface TodayData {
  date?: string;
  hasCheckIn?: boolean;
  hasCheckOut?: boolean;
}

export default function EmployeeDashboard() {
  const t = useT();
  const [today, setToday] = useState<TodayData | null>(null);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [checking, setChecking] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [location, setLocation] = useState<GeoLocation | null>(null);
  const [geoError, setGeoError] = useState("");
  const [status, setStatus] = useState<{
    kind: "info" | "success" | "error";
    text: string;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // Continuous location updates + cleanup.
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setGeoError(t("employee.geoUnsupported"));
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setGeoError("");
        setLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      () => setGeoError(t("employee.geoError")),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Stop the camera when leaving the page.
  useEffect(() => stopCamera, [stopCamera]);

  // Manage the object URL for the photo preview.
  useEffect(() => {
    if (!photoBlob) {
      setPhotoUrl(null);
      return;
    }
    const url = URL.createObjectURL(photoBlob);
    setPhotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photoBlob]);

  const loadData = useCallback(async () => {
    setLoadError("");
    try {
      const [tdRes, histRes] = await Promise.all([
        fetch("/api/attendance/today"),
        fetch("/api/attendance/history"),
      ]);
      if (!tdRes.ok || !histRes.ok) throw new Error("Failed to load data");
      const td = await tdRes.json();
      const hist = await histRes.json();
      setToday(td);
      setHistory(Array.isArray(hist) ? hist : []);
    } catch {
      setLoadError(t("employee.loadError"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function retryLocation() {
    setGeoError("");
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      () => setGeoError(t("employee.geoError")),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function startCamera() {
    setStatus(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 1280, height: 720 },
      });
      streamRef.current = stream;
      setShowCamera(true);
      // Attach after the <video> mounts.
      requestAnimationFrame(() => {
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.onloadedmetadata = () => video.play().catch(() => {});
        }
      });
    } catch {
      setStatus({ kind: "error", text: t("employee.cameraDenied") });
    }
  }

  function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) setPhotoBlob(blob);
      },
      "image/jpeg",
      0.85
    );
    stopCamera();
    setShowCamera(false);
  }

  function cancelCamera() {
    stopCamera();
    setShowCamera(false);
    setPhotoBlob(null);
  }

  async function doAttendance(type: "check-in" | "check-out") {
    if (!location) {
      setStatus({ kind: "error", text: t("employee.waitingGps") });
      return;
    }
    setChecking(true);
    setStatus({ kind: "info", text: t("employee.recording") });
    try {
      const endpoint =
        type === "check-in"
          ? "/api/attendance/check-in"
          : "/api/attendance/check-out";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        let text = data.error || t("common.connectionError");
        if (data.code === "OUTSIDE_LOCATION") {
          text = t("employee.blockedOutside", {
            dist: Math.round(data.distance ?? 0),
          });
        } else if (data.code === "LOW_GPS_ACCURACY") {
          text = t("employee.blockedAccuracy", {
            acc: data.accuracy != null ? Math.round(data.accuracy) : "?",
          });
        } else if (data.code === "LOCATION_REQUIRED") {
          text = t("employee.blockedNoLocation");
        }
        setStatus({ kind: "error", text });
        return;
      }

      if (photoBlob) {
        setStatus({ kind: "info", text: t("employee.uploading") });
        const form = new FormData();
        form.append("photo", photoBlob, "photo.jpg");
        form.append("attendanceId", String(data.id));
        form.append("type", type === "check-in" ? "checkin" : "checkout");
        const photoRes = await fetch("/api/attendance/photo", {
          method: "POST",
          body: form,
        });
        if (!photoRes.ok) {
          setStatus({ kind: "error", text: t("employee.photoFailed") });
        }
      }

      setPhotoBlob(null);
      setStatus({
        kind: data.status === "PRESENT" || data.status === "LATE" ? "success" : "info",
        text:
          data.status === "PRESENT"
            ? t("employee.success")
            : t("employee.recordedWith", {
                status: t(`status.${data.status}` as never),
              }),
      });
      await loadData();
    } catch {
      setStatus({ kind: "error", text: t("common.connectionError") });
    } finally {
      setChecking(false);
    }
  }

  const lowAccuracy =
    location != null && location.accuracy > ACCURACY_WARN_METERS;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-accent" />
            <CardTitle className="text-heading text-primary">
              {t("employee.today")}
            </CardTitle>
          </div>
          <p className="text-body text-text-muted">
            {today?.date ?? new Date().toISOString().slice(0, 10)}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadError && <Alert variant="error">{loadError}</Alert>}

          {loading ? (
            <Skeleton className="h-9 w-40" />
          ) : (
            <div className="flex items-center gap-3 flex-wrap">
              {today?.hasCheckIn ? (
                <div className="flex items-center gap-2 text-body">
                  <CheckCircle size={18} className="text-emerald-600" />
                  {t("employee.checkedIn")}
                </div>
              ) : (
                <Button
                  onClick={startCamera}
                  disabled={checking || !location}
                >
                  <LogIn size={16} />
                  {t("employee.checkIn")}
                </Button>
              )}

              {today?.hasCheckIn && !today?.hasCheckOut ? (
                <Button
                  variant="outline"
                  onClick={startCamera}
                  disabled={checking || !location}
                >
                  <LogOut size={16} />
                  {t("employee.checkOut")}
                </Button>
              ) : today?.hasCheckOut ? (
                <div className="flex items-center gap-2 text-body">
                  <XCircle size={18} className="text-accent" />
                  {t("employee.checkedOut")}
                </div>
              ) : null}
            </div>
          )}

          {showCamera && (
            <div>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full max-w-[400px] rounded-lg bg-black"
              />
              <div className="mt-3 flex gap-2">
                <Button onClick={capturePhoto}>
                  <Camera size={16} />
                  {t("employee.capture")}
                </Button>
                <Button variant="outline" onClick={cancelCamera}>
                  {t("common.cancel")}
                </Button>
              </div>
            </div>
          )}

          {photoUrl && !showCamera && (
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
              <img
                src={photoUrl}
                alt="Captured selfie"
                className="w-full max-w-[400px] rounded-lg"
              />
              <div className="mt-3 flex gap-2">
                <Button
                  onClick={() =>
                    doAttendance(today?.hasCheckIn ? "check-out" : "check-in")
                  }
                  disabled={checking}
                >
                  <Camera size={16} />
                  {checking ? t("employee.submitting") : t("employee.submitPhoto")}
                </Button>
                <Button variant="outline" onClick={() => setPhotoBlob(null)}>
                  {t("employee.retake")}
                </Button>
              </div>
            </div>
          )}

          <canvas ref={canvasRef} className="hidden" />

          {geoError && (
            <Alert variant="error">
              <div className="flex items-center justify-between gap-3">
                <span>{geoError}</span>
                <button
                  onClick={retryLocation}
                  className="inline-flex items-center gap-1 underline"
                >
                  <RefreshCw size={14} />
                  {t("common.retry")}
                </button>
              </div>
            </Alert>
          )}

          {location && (
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-mono text-text-muted">
                <MapPin size={14} />
                {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}{" "}
                (&plusmn;{location.accuracy.toFixed(0)}m)
              </p>
              {lowAccuracy && (
                <Alert variant="error">
                  {t("employee.lowAccuracy", {
                    acc: location.accuracy.toFixed(0),
                  })}
                </Alert>
              )}
            </div>
          )}

          {status && <Alert variant={status.kind}>{status.text}</Alert>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <History size={18} className="text-accent" />
            <CardTitle className="text-heading text-primary">
              {t("employee.history")}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-body text-text-muted text-center py-6">
              {t("employee.noHistory")}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {history.map((record) => (
                <li
                  key={record.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {record.type === "CHECK_IN" ? (
                      <LogIn size={16} className="text-emerald-600 shrink-0" />
                    ) : (
                      <LogOut size={16} className="text-accent shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="text-body text-primary">
                        {record.type === "CHECK_IN"
                          ? t("employee.checkIn")
                          : record.type === "CHECK_OUT"
                            ? t("employee.checkOut")
                            : record.type.replace(/_/g, " ")}
                      </div>
                      <div className="text-mono text-text-muted">
                        {new Date(record.serverTime).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <StatusBadge status={record.status} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
