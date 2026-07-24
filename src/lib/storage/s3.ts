import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getDb } from "@/database/connection";
import { storageSettings } from "@/database/schema/storage_settings";
import { decryptSecret } from "@/lib/crypto";

interface StorageConfig {
  driver: string;
  endpoint: string | null;
  region: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  forcePathStyle: boolean;
  publicUrl: string | null;
  signedUrlExpiration: number;
  objectPrefix: string;
}

let _client: S3Client | null = null;
let _config: StorageConfig | null = null;

/** Clear the cached client/config after storage settings change. */
export function invalidateStorageCache() {
  _client = null;
  _config = null;
}

async function loadConfig(): Promise<StorageConfig> {
  if (_config) return _config;

  const db = await getDb();
  const [row] = await db.select().from(storageSettings).limit(1);
  if (!row) {
    throw new Error("Storage not configured");
  }

  _config = {
    driver: row.driver,
    endpoint: row.endpoint,
    region: row.region || "auto",
    bucket: row.bucket,
    accessKey: decryptSecret(row.accessKeyEncrypted),
    secretKey: decryptSecret(row.secretKeyEncrypted),
    forcePathStyle: row.forcePathStyle,
    publicUrl: row.publicUrl,
    signedUrlExpiration: row.signedUrlExpiration,
    objectPrefix: row.objectPrefix || "",
  };
  return _config;
}

/** Public-facing subset of the storage config (no secrets). */
export async function getStorageConfig() {
  const config = await loadConfig();
  return {
    bucket: config.bucket,
    publicUrl: config.publicUrl,
    signedUrlExpiration: config.signedUrlExpiration,
    objectPrefix: config.objectPrefix,
  };
}

async function getClient(): Promise<S3Client> {
  if (_client) return _client;
  const config = await loadConfig();

  _client = new S3Client({
    endpoint: config.endpoint || undefined,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretKey,
    },
    forcePathStyle: config.forcePathStyle,
  });
  return _client;
}

/** Prepend the configured object prefix (if any) to a key. */
function withPrefix(objectKey: string, prefix: string): string {
  if (!prefix) return objectKey;
  const clean = prefix.replace(/\/+$/, "");
  return `${clean}/${objectKey}`;
}

export async function uploadPhoto(
  buffer: Buffer,
  objectKey: string,
  contentType: string
) {
  const client = await getClient();
  const config = await loadConfig();
  const key = withPrefix(objectKey, config.objectPrefix);

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );

  return key;
}

export async function getPhotoUrl(objectKey: string) {
  const config = await loadConfig();
  const key = objectKey.startsWith(config.objectPrefix)
    ? objectKey
    : withPrefix(objectKey, config.objectPrefix);

  if (config.publicUrl) {
    return `${config.publicUrl.replace(/\/+$/, "")}/${key}`;
  }

  const client = await getClient();
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: config.bucket, Key: key }),
    { expiresIn: config.signedUrlExpiration }
  );
}

export async function deletePhoto(objectKey: string) {
  const client = await getClient();
  const config = await loadConfig();
  const key = objectKey.startsWith(config.objectPrefix)
    ? objectKey
    : withPrefix(objectKey, config.objectPrefix);

  await client.send(
    new DeleteObjectCommand({ Bucket: config.bucket, Key: key })
  );
}

/**
 * Round-trip test: put → head → get → delete a small test object.
 * Returns a structured result; never leaks credentials.
 */
export async function testStorageConnection(): Promise<{
  success: boolean;
  message: string;
  steps?: Record<string, boolean>;
}> {
  const steps: Record<string, boolean> = {
    upload: false,
    head: false,
    download: false,
    delete: false,
  };
  const testKey = `__presensa_test__/${Date.now()}.txt`;
  try {
    const client = await getClient();
    const config = await loadConfig();
    const key = withPrefix(testKey, config.objectPrefix);
    const body = Buffer.from("presensa-storage-test");

    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: body,
        ContentType: "text/plain",
      })
    );
    steps.upload = true;

    await client.send(
      new HeadObjectCommand({ Bucket: config.bucket, Key: key })
    );
    steps.head = true;

    const got = await client.send(
      new GetObjectCommand({ Bucket: config.bucket, Key: key })
    );
    steps.download = !!got.Body;

    await client.send(
      new DeleteObjectCommand({ Bucket: config.bucket, Key: key })
    );
    steps.delete = true;

    return { success: true, message: "Connection successful", steps };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Storage connection failed";
    return { success: false, message, steps };
  }
}
