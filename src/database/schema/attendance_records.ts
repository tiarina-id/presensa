import {
  boolean,
  decimal,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { organizations } from "./organizations";
import { employees } from "./employees";
import { offices } from "./offices";
import { schedules } from "./schedules";

export const attendanceRecords = mysqlTable("attendance_records", {
  id: int("id").primaryKey().autoincrement(),
  organizationId: int("organization_id")
    .notNull()
    .references(() => organizations.id),
  employeeId: int("employee_id")
    .notNull()
    .references(() => employees.id),
  officeId: int("office_id").references(() => offices.id),
  scheduleId: int("schedule_id").references(() => schedules.id),
  type: mysqlEnum("type", [
    "CHECK_IN",
    "CHECK_OUT",
    "BREAK_START",
    "BREAK_END",
  ]).notNull(),
  status: mysqlEnum("status", [
    "PRESENT",
    "LATE",
    "MANUAL",
    "REJECTED",
  ]).notNull(),
  serverTime: timestamp("server_time").notNull(),
  clientTime: timestamp("client_time"),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  accuracy: decimal("accuracy", { precision: 10, scale: 2 }),
  distanceFromOffice: decimal("distance_from_office", {
    precision: 10,
    scale: 2,
  }),
  withinRadius: boolean("within_radius"),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("attendance_emp_time_idx").on(t.employeeId, t.serverTime),
  index("attendance_org_time_idx").on(t.organizationId, t.serverTime),
  index("attendance_status_idx").on(t.status),
]);
