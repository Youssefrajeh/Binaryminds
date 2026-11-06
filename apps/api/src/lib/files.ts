import { randomUUID } from "node:crypto";
import { z } from "zod";
import { MAX_SHARED_FILE_BYTES, MAX_SHARED_FILE_NAME, SHARED_FILE_TYPES, sharedFileExtension } from "@campushub/shared";

export type SharedUpload = { id: string; name: string; mimeType: string; size: number; data: Buffer };

const maxChars = Math.ceil(MAX_SHARED_FILE_BYTES / 3) * 4;

export const uploadSchema = z.object({
  name: z.string().trim().min(1, "Choose a file to share").max(255, "That file name is too long"),
  data: z.string().min(1, "Choose a file to share").max(maxChars, "Files can be at most 5 MB").regex(/^[A-Za-z0-9+/]+={0,2}$/, "That file could not be read"),
  text: z.string().max(2000).optional(),
  clientId: z.string().min(1).max(64).optional(),
});

const startsWith = (bytes: Buffer, signature: number[]) => bytes.subarray(0, signature.length).equals(Buffer.from(signature));
const ZIP = [0x50, 0x4b, 0x03, 0x04];

/** Extensions are easy to fake, so each type must also carry its file signature. */
function matchesType(extension: string, bytes: Buffer): boolean {
  switch (extension) {
    case "pdf": return bytes.toString("latin1", 0, 5) === "%PDF-";
    case "docx": case "pptx": case "xlsx": return startsWith(bytes, ZIP);
    case "png": return startsWith(bytes, [137, 80, 78, 71, 13, 10, 26, 10]);
    case "jpg": case "jpeg": return startsWith(bytes, [255, 216, 255]);
    case "webp": return bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
    case "txt": case "md": return !bytes.includes(0);
    default: return false;
  }
}

/** Removes folders and control characters and keeps the extension within the length limit. */
export function cleanFileName(raw: string): string {
  const base = (raw.split(/[\\/]/).pop() ?? "").replace(/[\u0000-\u001f\u007f"]/g, "").trim();
  if (base.length <= MAX_SHARED_FILE_NAME) return base;
  const extension = `.${sharedFileExtension(base)}`;
  return base.slice(0, MAX_SHARED_FILE_NAME - extension.length) + extension;
}

/** Returns the checked file, or an error message suitable for showing to the student. */
export function parseUpload(name: string, data: string): SharedUpload | string {
  const cleaned = cleanFileName(name);
  const extension = sharedFileExtension(cleaned);
  const mimeType = Object.hasOwn(SHARED_FILE_TYPES, extension) ? SHARED_FILE_TYPES[extension] : undefined;
  if (!mimeType || !cleaned.includes(".")) return "Share a PDF, Word, PowerPoint, Excel, text or image file";
  const bytes = Buffer.from(data, "base64");
  if (bytes.length === 0) return "That file is empty";
  if (bytes.length > MAX_SHARED_FILE_BYTES) return "Files can be at most 5 MB";
  if (!matchesType(extension, bytes)) return "That file does not match its file type";
  return { id: randomUUID(), name: cleaned, mimeType, size: bytes.length, data: bytes };
}
