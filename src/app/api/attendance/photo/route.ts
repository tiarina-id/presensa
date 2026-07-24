import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/database/connection";
import { employees } from "@/database/schema/employees";
import { attendanceRecords } from "@/database/schema/attendance_records";
import { attendancePhotos } from "@/database/schema/attendance_photos";
import { getCurrentUser } from "@/lib/auth";
import { processPhoto, generateObjectKey } from "@/lib/storage/photo-processor";
import { uploadPhoto, deletePhoto } from "@/lib/storage";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("photo") as File | null;
  const attendanceId = formData.get("attendanceId") as string;
  const photoType = formData.get("type") as "checkin" | "checkout" | "manual-correction";

  if (!file || !attendanceId || !photoType) {
    return NextResponse.json(
      { error: "Missing required fields: photo, attendanceId, type" },
      { status: 400 }
    );
  }

  if (!["checkin", "checkout", "manual-correction"].includes(photoType)) {
    return NextResponse.json({ error: "Invalid photo type" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File too large. Maximum size is 10MB" },
      { status: 400 }
    );
  }

  if (file.type && !ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json(
      { error: "Unsupported image type. Use JPEG, PNG, or WebP" },
      { status: 400 }
    );
  }

  const db = await getDb();

  const [emp] = await db
    .select()
    .from(employees)
    .where(
      and(eq(employees.userId, user.id), eq(employees.organizationId, user.organizationId))
    )
    .limit(1);

  if (!emp) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  const [record] = await db
    .select()
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.id, parseInt(attendanceId)),
        eq(attendanceRecords.organizationId, user.organizationId),
        eq(attendanceRecords.employeeId, emp.id)
      )
    )
    .limit(1);

  if (!record) {
    return NextResponse.json({ error: "Attendance record not found" }, { status: 404 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const inputBuffer = Buffer.from(arrayBuffer);

  let processed;
  try {
    processed = await processPhoto(inputBuffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Image processing failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const objectKey = generateObjectKey(
    user.organizationId,
    emp.id,
    record.id,
    photoType
  );

  try {
    await uploadPhoto(processed.buffer, objectKey, processed.mimeType);
  } catch {
    return NextResponse.json(
      { error: "Failed to upload photo to storage" },
      { status: 500 }
    );
  }

  try {
    await db.insert(attendancePhotos).values({
      organizationId: user.organizationId,
      employeeId: emp.id,
      attendanceId: record.id,
      type: photoType,
      objectKey,
      mimeType: processed.mimeType,
      originalSize: file.size,
      compressedSize: processed.size,
      width: processed.width,
      height: processed.height,
      checksum: processed.checksum,
      storageDriver: "s3",
    });
  } catch (error) {
    // Compensate: remove the just-uploaded object so it isn't orphaned.
    try {
      await deletePhoto(objectKey);
    } catch (cleanupErr) {
      console.error("[photo] orphan cleanup failed", cleanupErr);
    }
    console.error("[photo] metadata insert failed", error);
    return NextResponse.json(
      { error: "Failed to save photo metadata" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    objectKey,
    size: processed.size,
    width: processed.width,
    height: processed.height,
  });
}
