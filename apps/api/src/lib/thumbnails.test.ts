import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { backfillThumbnails, makeThumbnail, MAX_FALLBACK_CHARS, NO_THUMBNAIL, THUMBNAIL_SIZE, thumbnailToStore } from "./thumbnails.js";

async function png(width: number, height: number, pixel: (i: number) => number): Promise<string> {
  const pixels = Buffer.alloc(width * height * 3);
  for (let i = 0; i < pixels.length; i++) pixels[i] = pixel(i);
  const data = await sharp(pixels, { raw: { width, height, channels: 3 } }).png().toBuffer();
  return `data:image/png;base64,${data.toString("base64")}`;
}

/** A photo-like PNG: fine random detail that PNG stores at close to full size */
function photo(width: number, height: number) {
  // xorshift32: 32-bit integer steps, so the sequence never loses precision
  let state = 2463534242;
  return png(width, height, () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) & 255;
  });
}

/** A small repeating pattern that PNG compresses better than WebP does */
function pattern(width: number, height: number) {
  return png(width, height, (i) => (i * 2654435761) % 256);
}

function bytesOf(dataUrl: string) {
  return Buffer.from(dataUrl.split(",")[1], "base64");
}

describe("makeThumbnail", () => {
  it("shrinks a large photo to a small WebP no bigger than the thumbnail size", async () => {
    const original = await photo(2000, 1500);

    const thumbnail = await makeThumbnail(original);

    expect(thumbnail).toMatch(/^data:image\/webp;base64,/);
    const meta = await sharp(bytesOf(thumbnail!)).metadata();
    expect(meta.width).toBe(THUMBNAIL_SIZE);
    expect(meta.height).toBe(600); // keeps the 4:3 shape
    expect(bytesOf(thumbnail!).length).toBeLessThan(bytesOf(original).length / 4);
  });

  it("keeps a photo that is already smaller than its thumbnail would be", async () => {
    const small = await pattern(300, 200);
    expect(await makeThumbnail(small)).toBe(small);
  });

  it("returns null for something that is not a readable photo", async () => {
    expect(await makeThumbnail("data:image/png;base64,bm90IGFuIGltYWdl")).toBeNull();
    // Has a PNG signature, so upload checks accept it, but the data is damaged
    expect(await makeThumbnail("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4WQAAAAASUVORK5CYII=")).toBeNull();
    expect(await makeThumbnail("https://example.com/photo.png")).toBeNull();
  });

  it("keeps a small photo it cannot read, but never stores a large one as its thumbnail", async () => {
    const small = "data:image/jpeg;base64,/9j/AAAA";
    expect(await thumbnailToStore(small)).toBe(small);
    const large = `data:image/jpeg;base64,/9j/${"A".repeat(MAX_FALLBACK_CHARS)}`;
    expect(await thumbnailToStore(large)).toBe(NO_THUMBNAIL);
    expect(await thumbnailToStore(null)).toBe(NO_THUMBNAIL);
  });
});

describe("backfillThumbnails", () => {
  it("returns thumbnails only for rows with a usable photo and marks the rest as done", async () => {
    const original = await photo(1200, 1200);
    const save = vi.fn().mockResolvedValue(undefined);

    const result = await backfillThumbnails(
      ["a", "b", "c"],
      async () => [{ id: "a", source: original }, { id: "b", source: null }, { id: "c", source: `data:image/jpeg;base64,/9j/${"A".repeat(MAX_FALLBACK_CHARS)}` }],
      save,
    );

    expect([...result.keys()]).toEqual(["a"]);
    expect(save.mock.calls).toEqual([["a", result.get("a")], ["b", NO_THUMBNAIL], ["c", NO_THUMBNAIL]]);
  });

  it("still returns the thumbnail when saving it fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const original = await photo(1200, 1200);

    const result = await backfillThumbnails(["a"], async () => [{ id: "a", source: original }], () => Promise.reject(new Error("write conflict")));

    expect(result.get("a")).toMatch(/^data:image\/webp;base64,/);
  });

  it("does no work when nothing is missing", async () => {
    const load = vi.fn();
    expect((await backfillThumbnails([], load, vi.fn())).size).toBe(0);
    expect(load).not.toHaveBeenCalled();
  });
});
