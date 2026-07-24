import {
  int,
  json,
  mysqlTable,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { organizations } from "./organizations";

export const settings = mysqlTable("settings", {
  id: int("id").primaryKey().autoincrement(),
  organizationId: int("organization_id")
    .notNull()
    .references(() => organizations.id),
  key: varchar("key", { length: 255 }).notNull(),
  value: json("value").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
