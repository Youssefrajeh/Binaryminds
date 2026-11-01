import { z } from "zod";
import { MAX_LOST_FOUND_PHOTO_BYTES } from "@campushub/shared";

// Event and lost/found uploads use the same 2 MB storage limit.
const maxBytes = MAX_LOST_FOUND_PHOTO_BYTES;
const maxChars = Math.ceil(maxBytes / 3) * 4 + 32;

function validPhoto(value: string): boolean {
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) return false;
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length > maxBytes || bytes.toString("base64") !== match[2]) return false;
  if (match[1] === "png") return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (match[1] === "jpeg") return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  return bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
}

export const photoSchema = z.string().max(maxChars, "Photo must be at most 2 MB")
  .refine(validPhoto, "Choose a valid JPG, PNG or WebP photo of at most 2 MB");
