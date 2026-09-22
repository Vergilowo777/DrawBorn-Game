/**
 * The raster and PNG paths use top-left rows. This is the one explicit
 * Texture2D upload adapter; it currently preserves rows for Cocos Creator's
 * Texture2D.uploadData path. If local Web Preview proves a backend needs a
 * vertical flip, it belongs here rather than in the rasterizer or PNG encoder.
 */
export function prepareCocosTextureRgba(
  pixels: Uint8Array,
  width: number,
  height: number
): Uint8Array {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0) {
    throw new Error("Texture dimensions must be positive safe integers.");
  }
  if (pixels.length !== width * height * 4) {
    throw new Error("Texture pixels must match their dimensions.");
  }
  return pixels.slice();
}
