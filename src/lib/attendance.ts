import { and, desc, eq, gte, isNull, lte, or } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { offices } from "@/database/schema/offices";
import { schedules } from "@/database/schema/schedules";
import { shifts } from "@/database/schema/shifts";
import { haversineDistance } from "@/lib/geo";

type OfficeRow = typeof offices.$inferSelect;

export type AttendanceStatus =
  | "PRESENT"
  | "LATE"
  | "OUTSIDE_LOCATION"
  | "LOW_GPS_ACCURACY";

export interface LocationEvaluation {
  matchedOffice: OfficeRow | null;
  nearestOffice: OfficeRow | null;
  /** Distance to the nearest office in meters, or -1 when unknown. */
  distance: number;
  withinRadius: boolean;
  accuracyValid: boolean;
  hasLocation: boolean;
  hasOffices: boolean;
}

/**
 * Evaluate a coordinate against the org's offices. Picks the NEAREST office
 * as the reference (fixes the previous bug where the last-iterated office won).
 */
export function evaluateLocation(
  officeList: OfficeRow[],
  latitude: unknown,
  longitude: unknown,
  accuracy: unknown
): LocationEvaluation {
  const lat = latitude != null ? parseFloat(String(latitude)) : NaN;
  const lng = longitude != null ? parseFloat(String(longitude)) : NaN;
  const acc = accuracy != null ? parseFloat(String(accuracy)) : NaN;
  const hasLocation = !Number.isNaN(lat) && !Number.isNaN(lng);
  const hasOffices = officeList.length > 0;

  if (!hasLocation || !hasOffices) {
    return {
      matchedOffice: null,
      nearestOffice: null,
      distance: -1,
      withinRadius: false,
      // Unknown → do not penalize (status logic decides).
      accuracyValid: true,
      hasLocation,
      hasOffices,
    };
  }

  let nearest: OfficeRow | null = null;
  let nearestDist = Infinity;
  for (const office of officeList) {
    const d = haversineDistance(
      lat,
      lng,
      parseFloat(office.latitude as string),
      parseFloat(office.longitude as string)
    );
    if (d < nearestDist) {
      nearestDist = d;
      nearest = office;
    }
  }

  const ref = nearest!;
  const withinRadius = nearestDist <= ref.allowedRadiusMeter;
  const accuracyValid = Number.isNaN(acc)
    ? true
    : acc <= ref.maximumAccuracyMeter;

  return {
    matchedOffice: withinRadius && accuracyValid ? ref : null,
    nearestOffice: nearest,
    distance: Number.isFinite(nearestDist) ? nearestDist : -1,
    withinRadius,
    accuracyValid,
    hasLocation,
    hasOffices,
  };
}

export type LocationBlockCode =
  | "LOCATION_REQUIRED"
  | "LOW_GPS_ACCURACY"
  | "OUTSIDE_LOCATION";

export interface LocationBlock {
  code: LocationBlockCode;
  distance: number;
  accuracy: number | null;
}

/**
 * Enforce the location policy: attendance outside the office radius or with GPS
 * accuracy below the office limit is rejected. Returns a block reason, or null
 * when the check-in is allowed. When no offices are configured, enforcement is
 * skipped (nothing to verify against).
 */
export function enforceLocation(
  ev: LocationEvaluation,
  accuracy: unknown
): LocationBlock | null {
  if (!ev.hasOffices) return null;
  const acc = accuracy != null ? parseFloat(String(accuracy)) : null;
  if (!ev.hasLocation) {
    return { code: "LOCATION_REQUIRED", distance: -1, accuracy: null };
  }
  if (!ev.accuracyValid) {
    return { code: "LOW_GPS_ACCURACY", distance: ev.distance, accuracy: acc };
  }
  if (!ev.withinRadius) {
    return { code: "OUTSIDE_LOCATION", distance: ev.distance, accuracy: acc };
  }
  return null;
}

/**
 * Base status from the location evaluation. When no offices are configured or
 * no location was supplied, the server cannot verify location, so it does not
 * penalize the employee (returns PRESENT).
 */
export function resolveBaseStatus(
  ev: LocationEvaluation
): "PRESENT" | "OUTSIDE_LOCATION" | "LOW_GPS_ACCURACY" {
  if (!ev.hasOffices || !ev.hasLocation) return "PRESENT";
  if (!ev.accuracyValid) return "LOW_GPS_ACCURACY";
  if (!ev.withinRadius) return "OUTSIDE_LOCATION";
  return "PRESENT";
}

export interface ScheduleShift {
  scheduleId: number;
  startTime: string; // HH:MM:SS
  lateThresholdMinutes: number;
}

/** Parse a "0,1,2" weekday CSV into a set of numbers (0=Sun … 6=Sat). */
export function parseDaysOfWeek(csv: string | null | undefined): number[] {
  if (!csv) return [];
  return csv
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
}

/** Whether a schedule's weekday set applies on the given date. */
export function scheduleAppliesOn(daysOfWeek: string, date: Date): boolean {
  return parseDaysOfWeek(daysOfWeek).includes(date.getDay());
}

/**
 * Find the employee's active schedule + shift effective on `when`, honoring the
 * per-weekday pattern (e.g. Mon/Wed/Fri = morning shift).
 */
export async function findActiveScheduleShift(
  db: MySql2Database,
  organizationId: number,
  employeeId: number,
  when: Date
): Promise<ScheduleShift | null> {
  const day = new Date(when);
  day.setHours(0, 0, 0, 0);
  const rows = await db
    .select({
      scheduleId: schedules.id,
      daysOfWeek: schedules.daysOfWeek,
      startTime: shifts.startTime,
      lateThresholdMinutes: shifts.lateThresholdMinutes,
    })
    .from(schedules)
    .innerJoin(shifts, eq(schedules.shiftId, shifts.id))
    .where(
      and(
        eq(schedules.organizationId, organizationId),
        eq(schedules.employeeId, employeeId),
        eq(schedules.isActive, true),
        lte(schedules.effectiveFrom, day),
        or(isNull(schedules.effectiveTo), gte(schedules.effectiveTo, day))
      )
    )
    .orderBy(desc(schedules.effectiveFrom));

  const match = rows.find((r) => scheduleAppliesOn(r.daysOfWeek, when));
  if (!match) return null;
  return {
    scheduleId: match.scheduleId,
    startTime: match.startTime,
    lateThresholdMinutes: match.lateThresholdMinutes,
  };
}

/**
 * Whether a check-in at `serverTime` is late for the given shift.
 * Compares against shift start + late threshold, in server local time.
 */
export function isLate(serverTime: Date, shift: ScheduleShift): boolean {
  const parts = shift.startTime.split(":").map((n) => parseInt(n, 10));
  const [h, m, s] = [parts[0] || 0, parts[1] || 0, parts[2] || 0];
  const cutoff = new Date(serverTime);
  cutoff.setHours(h, m + (shift.lateThresholdMinutes || 0), s, 0);
  return serverTime.getTime() > cutoff.getTime();
}
