import { describe, expect, it } from "vitest";
import { toSquareAvatar } from "./image";

describe("toSquareAvatar", () => {
  it("rejects unsupported file types", async () => {
    const file = new File(["x"], "a.gif", { type: "image/gif" });
    await expect(toSquareAvatar(file)).rejects.toThrow("JPEG, PNG or WebP");
  });

  it("rejects files over 10 MB", async () => {
    const file = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "big.png", { type: "image/png" });
    await expect(toSquareAvatar(file)).rejects.toThrow("too large");
  });
});
