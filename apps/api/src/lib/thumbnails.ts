import sharp from "sharp";

/*
 * Photos are stored as base64 data URLs of up to 2 MB. Lists and chat cards
 * show them at a few hundred pixels, so they get a small WebP copy instead of
 * the full photo, which keeps a page of results to a few hundred KB.
 */

/** Longest side of a thumbnail, in pixels: crisp on a wide card at 2x density */
export const THUMBNAIL_SIZE = 800;
const DATA_URL = /^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

/**
 * Returns a WebP thumbnail of a photo data URL. A photo that is already
 * smaller than its thumbnail would be is returned as it is, and anything
 * that cannot be decoded returns null so the caller can fall back.
 */
export async function makeThumbnail(dataUrl: string): Promise<string | null> {
  const match = DATA_URL.exec(dataUrl);
  if (!match) return null;
  const original = Buffer.from(match[1], "base64");
  try {
    const output = await sharp(original, { failOn: "error" })
      .rotate() // honour the camera's orientation before EXIF is dropped
      .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer();
    return output.length < original.length ? `data:image/webp;base64,${output.toString("base64")}` : dataUrl;
  } catch {
    return null;
  }
}

/** The thumbnail to store next to a photo; falls back to the photo itself */
export async function thumbnailOrOriginal(dataUrl: string): Promise<string> {
  return (await makeThumbnail(dataUrl)) ?? dataUrl;
}

/**
 * Rows saved before thumbnails existed have a photo but no thumbnail. This
 * loads the full photo for just those rows, makes and saves each thumbnail
 * once, and returns them by row id. Later requests read the saved copy.
 */
export async function backfillThumbnails(
  missingIds: string[],
  loadOriginals: (ids: string[]) => Promise<{ id: string; source: string | null }[]>,
  save: (id: string, thumbnail: string) => Promise<unknown>,
): Promise<Map<string, string>> {
  const thumbnails = new Map<string, string>();
  if (missingIds.length === 0) return thumbnails;
  // One at a time, so a page of large photos never sits in memory at once
  for (const row of await loadOriginals(missingIds)) {
    if (!row.source) continue;
    const thumbnail = await thumbnailOrOriginal(row.source);
    thumbnails.set(row.id, thumbnail);
    // A failed save only means the next request makes the thumbnail again
    await Promise.resolve()
      .then(() => save(row.id, thumbnail))
      .catch((err) => console.error("Thumbnail save error:", err));
  }
  return thumbnails;
}
