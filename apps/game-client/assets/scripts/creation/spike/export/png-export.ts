import {
  DRAWING_CANVAS_HEIGHT,
  DRAWING_CANVAS_WIDTH,
  DRAWING_LIMITS,
  ArtworkExportResult,
  DrawingExportPort,
  PngExportRequest,
  ThumbnailExportRequest,
  ThumbnailExportResult
} from "../../../../shared/contracts/index";

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const MAX_RGBA_BYTES = 64 * 1024 * 1024;

function validateIdentity(artworkId: string, artworkRevision: number): void {
  if (
    typeof artworkId !== "string" ||
    artworkId.length === 0 ||
    artworkId.length > DRAWING_LIMITS.maxIdLength ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(artworkId)
  ) {
    throw new Error("PNG export requires a valid artwork ID.");
  }
  if (!Number.isInteger(artworkRevision) || artworkRevision < 1 || artworkRevision > 2147483647) {
    throw new Error("PNG export requires a positive artwork revision.");
  }
}

function checkedRgbaByteLength(width: number, height: number): number {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0) {
    throw new Error("Image dimensions must be positive safe integers.");
  }
  const byteLength = width * height * 4;
  if (!Number.isSafeInteger(byteLength) || byteLength > MAX_RGBA_BYTES) {
    throw new Error("Image dimensions exceed the export buffer limit.");
  }
  return byteLength;
}

function writeUint32(target: number[], value: number): void {
  target.push((value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255);
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc ^= bytes[index];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (let index = 0; index < bytes.length; index += 1) {
    a = (a + bytes[index]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const bytes: number[] = [];
  writeUint32(bytes, data.length);
  const typeBytes = new Uint8Array(type.length);
  for (let index = 0; index < type.length; index += 1) {
    typeBytes[index] = type.charCodeAt(index);
    bytes.push(typeBytes[index]);
  }
  data.forEach((value) => bytes.push(value));
  writeUint32(bytes, crc32(new Uint8Array([...typeBytes, ...data])));
  return new Uint8Array(bytes);
}

function zlibStore(data: Uint8Array): Uint8Array {
  const output: number[] = [0x78, 0x01];
  let offset = 0;
  while (offset < data.length || offset === 0) {
    const length = Math.min(65535, data.length - offset);
    const finalBlock = offset + length >= data.length;
    output.push(finalBlock ? 1 : 0, length & 255, (length >>> 8) & 255);
    const complement = ~length & 0xffff;
    output.push(complement & 255, (complement >>> 8) & 255);
    for (let index = 0; index < length; index += 1) {
      output.push(data[offset + index]);
    }
    offset += length;
    if (finalBlock) {
      break;
    }
  }
  writeUint32(output, adler32(data));
  return new Uint8Array(output);
}

function pngRows(pixels: Uint8Array, width: number, height: number): Uint8Array {
  const rowSize = width * 4;
  const rows = new Uint8Array((rowSize + 1) * height);
  for (let y = 0; y < height; y += 1) {
    rows[y * (rowSize + 1)] = 0;
    rows.set(pixels.subarray(y * rowSize, (y + 1) * rowSize), y * (rowSize + 1) + 1);
  }
  return rows;
}

export function encodePngRgba(pixels: Uint8Array, width: number, height: number): Uint8Array {
  const byteLength = checkedRgbaByteLength(width, height);
  if (pixels.length !== byteLength) {
    throw new Error("PNG export requires a non-empty RGBA buffer matching its dimensions.");
  }
  const header = new Uint8Array(13);
  header[0] = (width >>> 24) & 255;
  header[1] = (width >>> 16) & 255;
  header[2] = (width >>> 8) & 255;
  header[3] = width & 255;
  header[4] = (height >>> 24) & 255;
  header[5] = (height >>> 16) & 255;
  header[6] = (height >>> 8) & 255;
  header[7] = height & 255;
  header[8] = 8;
  header[9] = 6;
  const idat = zlibStore(pngRows(pixels, width, height));
  const parts = [
    PNG_SIGNATURE,
    chunk("IHDR", header),
    chunk("IDAT", idat),
    chunk("IEND", new Uint8Array())
  ];
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  parts.forEach((part) => {
    result.set(part, offset);
    offset += part.length;
  });
  return result;
}

export const encodePng = encodePngRgba;

export function downsampleRgbaBox(
  pixels: Uint8Array,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth = 256,
  targetHeight = 256
): Uint8Array {
  const sourceByteLength = checkedRgbaByteLength(sourceWidth, sourceHeight);
  checkedRgbaByteLength(targetWidth, targetHeight);
  if (pixels.length !== sourceByteLength) {
    throw new Error("Thumbnail export requires a non-empty RGBA buffer matching its dimensions.");
  }
  const output = new Uint8Array(targetWidth * targetHeight * 4);
  for (let targetY = 0; targetY < targetHeight; targetY += 1) {
    const sourceTop = Math.floor((targetY * sourceHeight) / targetHeight);
    const sourceBottom = Math.max(
      sourceTop + 1,
      Math.ceil(((targetY + 1) * sourceHeight) / targetHeight)
    );
    for (let targetX = 0; targetX < targetWidth; targetX += 1) {
      const sourceLeft = Math.floor((targetX * sourceWidth) / targetWidth);
      const sourceRight = Math.max(
        sourceLeft + 1,
        Math.ceil(((targetX + 1) * sourceWidth) / targetWidth)
      );
      let alphaSum = 0;
      let redPremultiplied = 0;
      let greenPremultiplied = 0;
      let bluePremultiplied = 0;
      let count = 0;
      for (let sourceY = sourceTop; sourceY < sourceBottom; sourceY += 1) {
        for (let sourceX = sourceLeft; sourceX < sourceRight; sourceX += 1) {
          const sourceOffset = (sourceY * sourceWidth + sourceX) * 4;
          const alpha = pixels[sourceOffset + 3];
          alphaSum += alpha;
          redPremultiplied += pixels[sourceOffset] * alpha;
          greenPremultiplied += pixels[sourceOffset + 1] * alpha;
          bluePremultiplied += pixels[sourceOffset + 2] * alpha;
          count += 1;
        }
      }
      const outputOffset = (targetY * targetWidth + targetX) * 4;
      const averageAlpha = Math.round(alphaSum / count);
      output[outputOffset + 3] = averageAlpha;
      if (alphaSum > 0) {
        output[outputOffset] = Math.round(redPremultiplied / alphaSum);
        output[outputOffset + 1] = Math.round(greenPremultiplied / alphaSum);
        output[outputOffset + 2] = Math.round(bluePremultiplied / alphaSum);
      }
    }
  }
  return output;
}

export const createThumbnailPixels = downsampleRgbaBox;

export function exportPng(request: PngExportRequest, pixels: Uint8Array): ArtworkExportResult {
  validateIdentity(request.artworkId, request.artworkRevision);
  if (request.width !== DRAWING_CANVAS_WIDTH || request.height !== DRAWING_CANVAS_HEIGHT) {
    throw new Error("Artwork PNG export must be 1024 by 1024.");
  }
  return {
    ...request,
    mimeType: "image/png",
    bytes: encodePngRgba(pixels, request.width, request.height)
  };
}

export function exportThumbnail(
  request: ThumbnailExportRequest,
  pixels: Uint8Array
): ThumbnailExportResult {
  validateIdentity(request.artworkId, request.artworkRevision);
  if (request.width !== 256 || request.height !== 256) {
    throw new Error("Thumbnail export must be exactly 256 by 256.");
  }
  const thumbnailPixels = downsampleRgbaBox(
    pixels,
    DRAWING_CANVAS_WIDTH,
    DRAWING_CANVAS_HEIGHT,
    request.width,
    request.height
  );
  return {
    ...request,
    mimeType: "image/png",
    bytes: encodePngRgba(thumbnailPixels, request.width, request.height)
  };
}

export class RasterExportPort implements DrawingExportPort {
  private readonly pixels: () => Uint8Array;
  private readonly artworkId: string;
  private readonly artworkRevision: number;

  public constructor(pixels: () => Uint8Array, artworkId: string, artworkRevision: number) {
    this.pixels = pixels;
    validateIdentity(artworkId, artworkRevision);
    this.artworkId = artworkId;
    this.artworkRevision = artworkRevision;
  }

  public exportPng(request: PngExportRequest): Promise<ArtworkExportResult> {
    return Promise.resolve().then(() => {
      this.assertIdentity(request.artworkId, request.artworkRevision);
      return exportPng(request, this.pixels().slice());
    });
  }

  public exportThumbnail(request: ThumbnailExportRequest): Promise<ThumbnailExportResult> {
    return Promise.resolve().then(() => {
      this.assertIdentity(request.artworkId, request.artworkRevision);
      return exportThumbnail(request, this.pixels().slice());
    });
  }

  private assertIdentity(artworkId: string, artworkRevision: number): void {
    if (artworkId !== this.artworkId || artworkRevision !== this.artworkRevision) {
      throw new Error("Export request artwork identity does not match the bound pixel source.");
    }
  }
}
