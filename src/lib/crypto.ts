import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

/**
 * Symmetric encryption for secrets at rest (e.g. S3 credentials).
 * Key is derived from APP_SECRET. Output format: `v1:<iv>:<tag>:<ciphertext>`
 * (all base64). AES-256-GCM provides confidentiality + integrity.
 */

const ALGO = "aes-256-gcm";
const KEY_SALT = "presensa:secret-encryption:v1";
const PREFIX = "v1";

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const secret = process.env.APP_SECRET;
  if (!secret) {
    throw new Error("APP_SECRET is required to encrypt/decrypt secrets");
  }
  cachedKey = scryptSync(secret, KEY_SALT, 32);
  return cachedKey;
}

export function encryptSecret(plaintext: string): string {
  if (plaintext === "") return "";
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    PREFIX,
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

export function decryptSecret(value: string): string {
  if (value === "") return "";
  const parts = value.split(":");
  // Backwards-compatibility: values stored before encryption existed are
  // plaintext (no "v1:" prefix). Return them as-is so nothing breaks.
  if (parts.length !== 4 || parts[0] !== PREFIX) {
    return value;
  }
  const [, ivB64, tagB64, dataB64] = parts;
  const decipher = createDecipheriv(
    ALGO,
    getKey(),
    Buffer.from(ivB64, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

/** True if the value is in our encrypted envelope format. */
export function isEncrypted(value: string): boolean {
  const parts = value.split(":");
  return parts.length === 4 && parts[0] === PREFIX;
}
