import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * Parse and validate a JSON request body against a Zod schema.
 * On success returns `{ data }`; on failure returns `{ response }` with a 400.
 */
export async function parseBody<T extends z.ZodTypeAny>(
  request: Request,
  schema: T
): Promise<
  | { data: z.infer<T>; response?: undefined }
  | { data?: undefined; response: NextResponse }
> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return {
      response: NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      ),
    };
  }

  const result = schema.safeParse(json);
  if (!result.success) {
    return {
      response: NextResponse.json(
        {
          error: "Validation failed",
          details: result.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
        { status: 400 }
      ),
    };
  }

  return { data: result.data };
}

/** Common reusable field schemas. */
export const latitudeSchema = z.coerce.number().min(-90).max(90);
export const longitudeSchema = z.coerce.number().min(-180).max(180);
