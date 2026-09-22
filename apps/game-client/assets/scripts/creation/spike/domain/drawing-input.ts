import {
  DRAWING_CANVAS_HEIGHT,
  DRAWING_CANVAS_WIDTH,
  DRAWING_LIMITS,
  DrawingPoint,
  DrawingStroke,
  DrawingTool
} from "../../../../shared/contracts/index";

export type DisplayRect = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
};

export type LocalDisplayTransform = {
  readonly width: number;
  readonly height: number;
  readonly anchorX: number;
  readonly anchorY: number;
};

/**
 * Maps a point in the display rectangle to the contract's top-left-origin
 * logical canvas. Invalid rectangles and coordinates are rejected rather than
 * producing a NaN point. Points outside the rectangle are clamped so a stroke
 * that briefly leaves the node still ends at its edge.
 */
export function mapDisplayPoint(x: number, y: number, rect: DisplayRect): DrawingPoint | undefined {
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(rect.left) ||
    !Number.isFinite(rect.top) ||
    !Number.isFinite(rect.width) ||
    !Number.isFinite(rect.height) ||
    rect.width <= 0 ||
    rect.height <= 0
  ) {
    return undefined;
  }
  const normalizedX = Math.max(0, Math.min(1, (x - rect.left) / rect.width));
  const normalizedY = Math.max(0, Math.min(1, (y - rect.top) / rect.height));
  return {
    x: normalizedX * DRAWING_CANVAS_WIDTH,
    y: normalizedY * DRAWING_CANVAS_HEIGHT
  };
}

export const mapDisplayToLogical = mapDisplayPoint;

/**
 * Converts a Cocos UITransform's already-converted anchor-relative local
 * coordinate into the contract's top-left logical coordinate. The caller is
 * responsible for obtaining local coordinates with convertToNodeSpaceAR, so
 * node scale and world transforms are not approximated here.
 */
export function mapLocalToLogical(
  localX: number,
  localY: number,
  transform: LocalDisplayTransform
): DrawingPoint | undefined {
  if (
    !Number.isFinite(localX) ||
    !Number.isFinite(localY) ||
    !Number.isFinite(transform.width) ||
    !Number.isFinite(transform.height) ||
    !Number.isFinite(transform.anchorX) ||
    !Number.isFinite(transform.anchorY) ||
    transform.width <= 0 ||
    transform.height <= 0
  ) {
    return undefined;
  }
  return {
    x: ((localX + transform.width * transform.anchorX) / transform.width) * DRAWING_CANVAS_WIDTH,
    y:
      (1 - (localY + transform.height * transform.anchorY) / transform.height) *
      DRAWING_CANVAS_HEIGHT
  };
}

export type DrawingInputOptions = {
  createStrokeId: () => string;
  color: string;
  width: number;
  tool: DrawingTool;
};

/**
 * Pointer lifecycle shared by mouse and touch adapters. The first active
 * pointer owns the stroke; other pointers are ignored until it ends. The
 * controller deliberately has no clock or ID generator of its own.
 */
export class DrawingInputController {
  private readonly surface: DrawingSurfaceLike;
  private readonly options: DrawingInputOptions;
  private committedStrokes: DrawingStroke[];
  private activePointerId: number | string | undefined;
  private activeStroke: DrawingStroke | undefined;

  public constructor(surface: DrawingSurfaceLike, options: DrawingInputOptions) {
    this.surface = surface;
    this.options = options;
    this.committedStrokes = surface.getStrokes().slice();
  }

  public begin(pointerId: number | string, x: number, y: number, rect: DisplayRect): boolean {
    if (this.activePointerId !== undefined) {
      return false;
    }
    const point = mapDisplayPoint(x, y, rect);
    return point ? this.beginLogical(pointerId, point) : false;
  }

  public beginLogical(pointerId: number | string, point: DrawingPoint): boolean {
    if (this.activePointerId !== undefined) {
      return false;
    }
    const safePoint = this.clampPoint(point);
    if (!safePoint || !this.validWidth(this.options.width) || this.options.color.length === 0) {
      return false;
    }
    const previousPointerId = this.activePointerId;
    const previousStroke = this.activeStroke;
    const previousCommitted = this.committedStrokes;
    const previousSurface = this.surface.getStrokes();
    try {
      this.activePointerId = pointerId;
      this.committedStrokes = this.surface.getStrokes().slice();
      this.activeStroke =
        this.options.tool === "eraser"
          ? {
              id: this.options.createStrokeId(),
              tool: "eraser",
              points: [safePoint],
              width: this.options.width
            }
          : {
              id: this.options.createStrokeId(),
              tool: this.options.tool,
              points: [safePoint],
              width: this.options.width,
              color: this.options.color
            };
      this.publish();
      return true;
    } catch (error) {
      this.activePointerId = previousPointerId;
      this.activeStroke = previousStroke;
      this.committedStrokes = previousCommitted;
      this.surface.replaceStrokes(previousSurface);
      throw error;
    }
  }

  public move(pointerId: number | string, x: number, y: number, rect: DisplayRect): boolean {
    if (this.activePointerId !== pointerId || !this.activeStroke) {
      return false;
    }
    const point = mapDisplayPoint(x, y, rect);
    return point ? this.moveLogical(pointerId, point) : false;
  }

  public moveLogical(pointerId: number | string, point: DrawingPoint): boolean {
    if (this.activePointerId !== pointerId || !this.activeStroke) {
      return false;
    }
    const safePoint = this.clampPoint(point);
    if (!safePoint || this.activeStroke.points.length >= DRAWING_LIMITS.maxPointsPerStroke) {
      return false;
    }
    const previous = this.activeStroke;
    const previousSurface = this.surface.getStrokes();
    this.activeStroke = { ...previous, points: [...previous.points, safePoint] };
    try {
      this.publish();
      return true;
    } catch (error) {
      this.activeStroke = previous;
      this.surface.replaceStrokes(previousSurface);
      throw error;
    }
  }

  public end(pointerId: number | string): boolean {
    if (this.activePointerId !== pointerId || !this.activeStroke) {
      return false;
    }
    this.committedStrokes = [...this.committedStrokes, this.activeStroke];
    this.activePointerId = undefined;
    this.activeStroke = undefined;
    return true;
  }

  public cancel(pointerId: number | string): boolean {
    if (this.activePointerId !== pointerId || !this.activeStroke) {
      return false;
    }
    this.activePointerId = undefined;
    this.activeStroke = undefined;
    this.surface.replaceStrokes(this.committedStrokes);
    return true;
  }

  public cancelActive(): boolean {
    if (this.activePointerId === undefined) {
      return false;
    }
    return this.cancel(this.activePointerId);
  }

  public setTool(tool: DrawingTool): void {
    this.options.tool = tool;
  }

  public setColor(color: string): void {
    this.options.color = color;
  }

  public setLineWidth(width: number): void {
    this.options.width = width;
  }

  public get active(): boolean {
    return this.activePointerId !== undefined;
  }

  private validWidth(width: number): boolean {
    return (
      Number.isFinite(width) &&
      width >= DRAWING_LIMITS.minLineWidth &&
      width <= DRAWING_LIMITS.maxLineWidth
    );
  }

  private clampPoint(point: DrawingPoint): DrawingPoint | undefined {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      return undefined;
    }
    return {
      x: Math.max(0, Math.min(DRAWING_CANVAS_WIDTH, point.x)),
      y: Math.max(0, Math.min(DRAWING_CANVAS_HEIGHT, point.y))
    };
  }

  private publish(): void {
    if (this.activeStroke) {
      this.surface.replaceStrokes([...this.committedStrokes, this.activeStroke]);
    }
  }
}

export interface DrawingSurfaceLike {
  getStrokes(): readonly DrawingStroke[];
  replaceStrokes(strokes: readonly DrawingStroke[]): void;
}
