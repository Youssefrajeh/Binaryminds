const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SOURCE_BYTES = 10 * 1024 * 1024;

/**
 * Center-crops an image file to a square and scales it down to `size` px,
 * returning a JPEG data URL small enough to store on the profile.
 */
export async function toSquareAvatar(file: File, size = 256): Promise<string> {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new Error("Please choose a JPEG, PNG or WebP image");
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error("Image is too large (max 10 MB)");
  }

  const bitmap = await createImageBitmap(file);
  try {
    const side = Math.min(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not process image");

    // White background so transparent PNGs don't turn black as JPEG
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      size,
      size
    );

    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    bitmap.close();
  }
}
