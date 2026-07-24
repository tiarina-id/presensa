import {
  index,
  int,
  json,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { organizations } from "./organizations";

export const auditLogs = mysqlTable(
  "audit_logs",
  {
    id: int("id").primaryKey().autoincrement(),
    organizationId: int("organization_id")
      .notNull()
      .references(() => organizations.id),
    actorUserId: int("actor_user_id"),
    action: varchar("action", { length: 255 }).notNull(),
    entityType: varchar("entity_type", { length: 255 }).notNull(),
    entityId: varchar("entity_id", { length: 255 }),
    oldValues: json("old_values"),
    newValues: json("new_values"),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("audit_org_created_idx").on(t.organizationId, t.createdAt)]
);
