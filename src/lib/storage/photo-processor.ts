import sharp from "sharp";
import crypto from "crypto";

export interface ProcessedPhoto {
  buffer: Buffer;
  width: number;
  height: number;
  size: number;
  checksum: string;
  mimeType: string;
}

export async function processPhoto(
  input: Buffer,
  maxWidth = 1280,
  maxHeight = 1280,
  quality = 78
): Promise<ProcessedPhoto> {
  const image = sharp(input);
  const metadata = await image.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("Invalid image file");
  }

  if (metadata.width > 5000 || metadata.height > 5000) {
    throw new Error("Image dimensions too large");
  }

  const processed = image
    .rotate()
    .resize({
      width: maxWidth,
      height: maxHeight,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality, effort: 4 });

  const buffer = await processed.toBuffer();
  const checksum = crypto.createHash("sha256").update(buffer).digest("hex");
  const resultMetadata = await sharp(buffer).metadata();

  return {
    buffer,
    width: resultMetadata.width || 0,
    height: resultMetadata.height || 0,
    size: buffer.length,
    checksum,
    mimeType: "image/webp",
  };
}

export function generateObjectKey(
  organizationId: number,
  employeeId: number,
  attendanceId: number,
  type: "checkin" | "checkout" | "manual-correction"
): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");

  return `organizations/${organizationId}/employees/${employeeId}/attendance/${year}/${month}/${attendanceId}-${type}.webp`;
}
