import { prisma } from "./prisma.js";
import { backfillThumbnails } from "./thumbnails.js";

/*
 * Thumbnail lookups for each kind of photo. Each takes rows that were loaded
 * without their full photo and returns a thumbnail per row id, creating any
 * that are missing for rows saved before thumbnails existed.
 */

type WithThumbnail = { id: string; thumbnailUrl?: string | null };

/** Rows whose thumbnail was never made; NO_THUMBNAIL ("") counts as made */
function missing(rows: WithThumbnail[]) {
  return rows.filter((row) => row.thumbnailUrl == null).map((row) => row.id);
}

async function resolve(
  rows: WithThumbnail[],
  loadOriginals: (ids: string[]) => Promise<{ id: string; source: string | null }[]>,
  save: (id: string, thumbnail: string) => Promise<unknown>,
): Promise<Map<string, string | null>> {
  const created = await backfillThumbnails(missing(rows), loadOriginals, save);
  return new Map(rows.map((row) => [row.id, row.thumbnailUrl || created.get(row.id) || null]));
}

/** Thumbnails of listing photos (ListingImage rows); unreadable photos map to null */
export function listingImageThumbnails(images: WithThumbnail[]) {
  return resolve(
    images,
    async (ids) => (await prisma.listingImage.findMany({ where: { id: { in: ids } }, select: { id: true, url: true } }))
      .map((image) => ({ id: image.id, source: image.url })),
    (id, thumbnailUrl) => prisma.listingImage.update({ where: { id }, data: { thumbnailUrl } }),
  );
}

/** Thumbnails of event photos; events without a photo map to null */
export function eventThumbnails(events: WithThumbnail[]) {
  return resolve(
    events,
    async (ids) => (await prisma.event.findMany({ where: { id: { in: ids } }, select: { id: true, imageUrl: true } }))
      .map((event) => ({ id: event.id, source: event.imageUrl })),
    (id, thumbnailUrl) => prisma.event.update({ where: { id }, data: { thumbnailUrl } }),
  );
}

/** Thumbnails of lost & found photos; posts without a photo map to null */
export function lostFoundThumbnails(posts: WithThumbnail[]) {
  return resolve(
    posts,
    async (ids) => (await prisma.lostFoundPost.findMany({ where: { id: { in: ids } }, select: { id: true, imageUrl: true } }))
      .map((post) => ({ id: post.id, source: post.imageUrl })),
    (id, thumbnailUrl) => prisma.lostFoundPost.update({ where: { id }, data: { thumbnailUrl } }),
  );
}
