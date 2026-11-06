export const MAX_SHARED_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_SHARED_FILE_NAME = 120;

/** The server takes the stored MIME type from this list, never from the browser. */
export const SHARED_FILE_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  txt: "text/plain",
  md: "text/markdown",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

export const SHARED_FILE_ACCEPT = Object.keys(SHARED_FILE_TYPES).map((extension) => `.${extension}`).join(",");

export function sharedFileExtension(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

export const sharedFileUrl = (id: string) => `/api/files/${id}/download`;

/** Returns the stored file behind an attachment URL, or null for an external link. */
export function sharedFileIdFrom(url: string): string | null {
  return /^\/api\/files\/([A-Za-z0-9_-]+)\/download$/.exec(url)?.[1] ?? null;
}

export interface SharedFileInput {
  name: string;
  /** File contents, base64 encoded */
  data: string;
  /** Optional message to send with the file */
  text?: string;
  clientId?: string;
}

export interface SharedFileDto {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  courseCode: string;
  messageId: string;
  uploader: { id: string; displayName: string };
  createdAt: string;
}

export interface FileCourseDto {
  courseCode: string;
  fileCount: number;
}
