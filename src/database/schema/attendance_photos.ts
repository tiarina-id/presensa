import {
  int,
  mysqlEnum,
  mysqlTable,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { organizations } from "./organizations";
import { employees } from "./employees";
import { attendanceRecords } from "./attendance_records";

export const attendancePhotos = mysqlTable("attendance_photos", {
  id: int("id").primaryKey().autoincrement(),
  organizationId: int("organization_id")
    .notNull()
    .references(() => organizations.id),
  employeeId: int("employee_id")
    .notNull()
    .references(() => employees.id),
  attendanceId: int("attendance_id")
    .notNull()
    .references(() => attendanceRecords.id),
  type: mysqlEnum("type", ["checkin", "checkout", "manual-correction"]).notNull(),
  objectKey: varchar("object_key", { length: 512 }).notNull(),
  mimeType: varchar("mime_type", { length: 64 }).notNull().default("image/webp"),
  originalSize: int("original_size").notNull(),
  compressedSize: int("compressed_size").notNull(),
  width: int("width").notNull(),
  height: int("height").notNull(),
  checksum: varchar("checksum", { length: 64 }).notNull(),
  storageDriver: varchar("storage_driver", { length: 64 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
