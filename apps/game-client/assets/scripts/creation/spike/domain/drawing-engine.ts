import {
  DRAWING_CANVAS_HEIGHT,
  DRAWING_CANVAS_WIDTH,
  DRAWING_SCHEMA_VERSION,
  DrawingDraft,
  validateDrawingDraft
} from "../../../../shared/contracts/index";
import { DrawingInputController, DrawingInputOptions } from "./drawing-input";
import { RasterSurface } from "./raster-surface";

export type DrawingEngineOptions = {
  readonly artworkId: string;
  readonly artworkRevision: number;
};

/**
 * Owns the contract payload and its deterministic pixel projection. The
 * payload remains the source of truth; pixels are rebuilt from strokes when
 * input is updated so marker compositing cannot depend on event frequency.
 */
export class DrawingEngine extends RasterSurface {
  public readonly artworkId: string;
  public readonly artworkRevision: number;

  public constructor(options: DrawingEngineOptions) {
    super();
    const validation = validateDrawingDraft({
      schemaVersion: DRAWING_SCHEMA_VERSION,
      artworkId: options.artworkId,
      revision: options.artworkRevision,
      drawing: this.getDocument()
    });
    if (!validation.success) {
      throw new Error(validation.issues.map((item) => `${item.path}: ${item.message}`).join(" "));
    }
    this.artworkId = validation.data.artworkId;
    this.artworkRevision = validation.data.revision;
  }

  public createInputController(options: DrawingInputOptions): DrawingInputController {
    return new DrawingInputController(this, options);
  }

  public getDraft(): DrawingDraft {
    return {
      schemaVersion: DRAWING_SCHEMA_VERSION,
      artworkId: this.artworkId,
      revision: this.artworkRevision,
      drawing: this.getDocument()
    };
  }

  public countTransparentPixels(): number {
    const pixels = this.getPixels();
    let transparent = 0;
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index] === 0) {
        transparent += 1;
      }
    }
    return transparent;
  }

  public getLogicalSize(): { readonly width: number; readonly height: number } {
    return { width: DRAWING_CANVAS_WIDTH, height: DRAWING_CANVAS_HEIGHT };
  }

  public get exportSize(): { readonly width: number; readonly height: number } {
    return { width: DRAWING_CANVAS_WIDTH, height: DRAWING_CANVAS_HEIGHT };
  }
}
