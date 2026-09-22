import {
  DRAWING_CANVAS_HEIGHT,
  DRAWING_CANVAS_WIDTH,
  DRAWING_LIMITS,
  DrawingDocument,
  DrawingPoint,
  DrawingStroke,
  validateDrawingDocument
} from "../../../../shared/contracts/index";

export type RgbaColor = {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
  readonly alpha: number;
};

function parseColor(value: string): RgbaColor {
  if (!/^#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?$/.test(value)) {
    throw new Error(`Invalid drawing color: ${value}`);
  }
  return {
    red: parseInt(value.slice(1, 3), 16),
    green: parseInt(value.slice(3, 5), 16),
    blue: parseInt(value.slice(5, 7), 16),
    alpha: value.length === 9 ? parseInt(value.slice(7, 9), 16) : 255
  };
}

function distanceSquaredToSegment(
  px: number,
  py: number,
  start: DrawingPoint,
  end: DrawingPoint
): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) {
    const pointX = px - start.x;
    const pointY = py - start.y;
    return pointX * pointX + pointY * pointY;
  }
  const amount = Math.max(
    0,
    Math.min(1, ((px - start.x) * dx + (py - start.y) * dy) / (dx * dx + dy * dy))
  );
  const nearestX = start.x + amount * dx;
  const nearestY = start.y + amount * dy;
  const offsetX = px - nearestX;
  const offsetY = py - nearestY;
  return offsetX * offsetX + offsetY * offsetY;
}

function strokeMask(stroke: DrawingStroke): Uint8Array {
  const mask = new Uint8Array(DRAWING_CANVAS_WIDTH * DRAWING_CANVAS_HEIGHT);
  const radius = stroke.width / 2;
  const points = stroke.points;
  const markSegment = (start: DrawingPoint, end: DrawingPoint): void => {
    const pointRadius =
      start.x === end.x && start.y === end.y ? Math.max(radius, Math.SQRT1_2 + 1e-9) : radius;
    const pointRadiusSquared = pointRadius * pointRadius;
    const left = Math.max(0, Math.floor(Math.min(start.x, end.x) - pointRadius - 1));
    const right = Math.min(
      DRAWING_CANVAS_WIDTH - 1,
      Math.ceil(Math.max(start.x, end.x) + pointRadius + 1)
    );
    const top = Math.max(0, Math.floor(Math.min(start.y, end.y) - pointRadius - 1));
    const bottom = Math.min(
      DRAWING_CANVAS_HEIGHT - 1,
      Math.ceil(Math.max(start.y, end.y) + pointRadius + 1)
    );
    for (let y = top; y <= bottom; y += 1) {
      for (let x = left; x <= right; x += 1) {
        if (distanceSquaredToSegment(x + 0.5, y + 0.5, start, end) <= pointRadiusSquared) {
          mask[y * DRAWING_CANVAS_WIDTH + x] = 255;
        }
      }
    }
  };
  if (points.length === 1) {
    markSegment(points[0], points[0]);
  } else {
    for (let index = 1; index < points.length; index += 1) {
      markSegment(points[index - 1], points[index]);
    }
  }
  return mask;
}

function sourceOverChannel(
  destination: number,
  destinationAlpha: number,
  source: number,
  sourceAlpha: number,
  outputAlpha: number
): number {
  return Math.round(
    (source * sourceAlpha + destination * destinationAlpha * (1 - sourceAlpha)) / outputAlpha
  );
}

/**
 * Deterministic straight-alpha RGBA rasterizer. A complete stroke is first
 * reduced to a binary coverage mask, then composited once. This is important
 * for markers: many move events within one stroke do not repeatedly increase
 * opacity at the same pixel.
 */
export class RasterSurface {
  private pixels = new Uint8Array(DRAWING_CANVAS_WIDTH * DRAWING_CANVAS_HEIGHT * 4);
  private strokes: DrawingStroke[] = [];

  public getPixels(): Uint8Array {
    return this.pixels.slice();
  }

  public getStrokes(): readonly DrawingStroke[] {
    return this.strokes.map((stroke) => ({
      ...stroke,
      points: stroke.points.map((point) => ({ x: point.x, y: point.y }))
    }));
  }

  public getDocument(): DrawingDocument {
    return {
      width: DRAWING_CANVAS_WIDTH,
      height: DRAWING_CANVAS_HEIGHT,
      strokes: this.getStrokes()
    };
  }

  public replaceStrokes(strokes: readonly DrawingStroke[]): void {
    const drawingPayload: DrawingDocument = {
      width: DRAWING_CANVAS_WIDTH,
      height: DRAWING_CANVAS_HEIGHT,
      strokes
    };
    const validation = validateDrawingDocument(drawingPayload);
    if (!validation.success) {
      throw new Error(validation.issues.map((item) => item.message).join(" "));
    }
    this.strokes = strokes.map((stroke) => ({
      ...stroke,
      points: stroke.points.map((point) => ({ x: point.x, y: point.y }))
    }));
    this.pixels = new Uint8Array(DRAWING_CANVAS_WIDTH * DRAWING_CANVAS_HEIGHT * 4);
    this.strokes.forEach((stroke) => this.compositeStroke(stroke));
  }

  public appendStroke(stroke: DrawingStroke): void {
    if (this.strokes.length >= DRAWING_LIMITS.maxStrokes) {
      throw new Error("Drawing exceeds its stroke limit.");
    }
    this.replaceStrokes([...this.strokes, stroke]);
  }

  public clear(): void {
    this.strokes = [];
    this.pixels = new Uint8Array(DRAWING_CANVAS_WIDTH * DRAWING_CANVAS_HEIGHT * 4);
  }

  /**
   * A deterministic orientation fixture used only by the local spike. It is
   * made from normal strokes, followed by a real alpha-clearing eraser stroke.
   */
  public loadTestPattern(): void {
    const quadrant = (
      id: string,
      color: string,
      x0: number,
      y0: number,
      x1: number,
      y1: number
    ): DrawingStroke => {
      const points: DrawingPoint[] = [];
      for (let y = y0; y <= y1; y += 8) {
        points.push({ x: x0, y });
        points.push({ x: x1, y });
      }
      return {
        id: `test-${id}-${x0}-${y0}`,
        tool: "pencil",
        points,
        width: 8,
        color
      };
    };
    this.replaceStrokes([
      quadrant("red", "#ff0000", 0, 0, 511, 511),
      quadrant("green", "#00ff00", 512, 0, 1024, 511),
      quadrant("blue", "#0000ff", 0, 512, 511, 1024),
      {
        id: "test-eraser-center",
        tool: "eraser",
        points: [
          { x: 448, y: 512 },
          { x: 576, y: 512 }
        ],
        width: 128
      }
    ]);
  }

  private compositeStroke(stroke: DrawingStroke): void {
    const mask = strokeMask(stroke);
    if (stroke.tool === "eraser") {
      for (let index = 0; index < mask.length; index += 1) {
        if (mask[index] !== 0) {
          const offset = index * 4;
          this.pixels[offset + 3] = 0;
          this.pixels[offset] = 0;
          this.pixels[offset + 1] = 0;
          this.pixels[offset + 2] = 0;
        }
      }
      return;
    }
    const color = parseColor(stroke.color);
    const toolOpacity = stroke.tool === "marker" ? 0.5 : 1;
    const alpha = (color.alpha / 255) * toolOpacity;
    for (let index = 0; index < mask.length; index += 1) {
      if (mask[index] !== 0 && alpha > 0) {
        const offset = index * 4;
        const destinationAlpha = this.pixels[offset + 3] / 255;
        const outputAlpha = alpha + destinationAlpha * (1 - alpha);
        if (outputAlpha === 0) {
          continue;
        }
        this.pixels[offset] = sourceOverChannel(
          this.pixels[offset],
          destinationAlpha,
          color.red,
          alpha,
          outputAlpha
        );
        this.pixels[offset + 1] = sourceOverChannel(
          this.pixels[offset + 1],
          destinationAlpha,
          color.green,
          alpha,
          outputAlpha
        );
        this.pixels[offset + 2] = sourceOverChannel(
          this.pixels[offset + 2],
          destinationAlpha,
          color.blue,
          alpha,
          outputAlpha
        );
        this.pixels[offset + 3] = Math.round(outputAlpha * 255);
      }
    }
  }
}

export { parseColor };
export const DrawingRasterizer = RasterSurface;
