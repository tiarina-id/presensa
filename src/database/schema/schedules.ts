import {
  boolean,
  date,
  int,
  mysqlTable,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { organizations } from "./organizations";
import { employees } from "./employees";
import { shifts } from "./shifts";

export const schedules = mysqlTable("schedules", {
  id: int("id").primaryKey().autoincrement(),
  organizationId: int("organization_id")
    .notNull()
    .references(() => organizations.id),
  employeeId: int("employee_id")
    .notNull()
    .references(() => employees.id),
  shiftId: int("shift_id")
    .notNull()
    .references(() => shifts.id),
  // CSV of weekday numbers this schedule applies to (0=Sunday … 6=Saturday).
  // Defaults to every day for backward compatibility with old schedules.
  daysOfWeek: varchar("days_of_week", { length: 20 })
    .notNull()
    .default("0,1,2,3,4,5,6"),
  effectiveFrom: date("effective_from").notNull(),
  effectiveTo: date("effective_to"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
