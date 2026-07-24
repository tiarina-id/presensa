import {
  boolean,
  int,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

export const storageSettings = mysqlTable("storage_settings", {
  id: int("id").primaryKey().autoincrement(),
  driver: varchar("driver", { length: 64 }).notNull(),
  endpoint: varchar("endpoint", { length: 512 }),
  region: varchar("region", { length: 128 }),
  bucket: varchar("bucket", { length: 255 }).notNull(),
  accessKeyEncrypted: text("access_key_encrypted").notNull(),
  secretKeyEncrypted: text("secret_key_encrypted").notNull(),
  forcePathStyle: boolean("force_path_style").default(false).notNull(),
  publicUrl: varchar("public_url", { length: 512 }),
  objectPrefix: varchar("object_prefix", { length: 255 }),
  signedUrlExpiration: int("signed_url_expiration").default(3600).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
