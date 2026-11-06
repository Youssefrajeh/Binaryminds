import { MAX_SHARED_FILE_BYTES, SHARED_FILE_TYPES, sharedFileExtension } from "@campushub/shared";
import api from "./api";

/** The same checks the API makes, so students hear about a bad file before it uploads. */
export function sharedFileProblem(file: File): string | null {
  if (!Object.hasOwn(SHARED_FILE_TYPES, sharedFileExtension(file.name))) return "Share a PDF, Word, PowerPoint, Excel, text or image file.";
  if (file.size === 0) return "That file is empty.";
  if (file.size > MAX_SHARED_FILE_BYTES) return "Files can be at most 5 MB.";
  return null;
}

export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("That file could not be read."));
    reader.readAsDataURL(file);
  });
}

/** Sign-in uses a header token, which a plain link cannot send, so fetch the file first. */
export async function downloadSharedFile(id: string, name: string) {
  const response = await api.get<Blob>(`/files/${id}/download`, { responseType: "blob" });
  const url = URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
