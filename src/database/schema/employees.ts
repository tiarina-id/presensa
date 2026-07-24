import {
  boolean,
  int,
  mysqlTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { organizations } from "./organizations";
import { users } from "./users";

export const employees = mysqlTable(
  "employees",
  {
    id: int("id").primaryKey().autoincrement(),
    organizationId: int("organization_id")
      .notNull()
      .references(() => organizations.id),
    userId: int("user_id").references(() => users.id),
    employeeId: varchar("employee_id", { length: 50 }).notNull(),
    fullName: varchar("full_name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 50 }),
    position: varchar("position", { length: 255 }),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [
    uniqueIndex("employees_org_code_unq").on(t.organizationId, t.employeeId),
  ]
);
