import {
  _decorator,
  Component,
  EventMouse,
  EventTouch,
  input,
  Input,
  Node,
  Sprite,
  SpriteFrame,
  sys,
  Texture2D,
  UITransform,
  Vec3
} from "cc";
import {
  DRAWING_CANVAS_HEIGHT,
  DRAWING_CANVAS_WIDTH,
  DRAWING_LIMITS,
  DrawingTool,
  PngExportResult,
  ThumbnailExportResult
} from "../../../../shared/contracts/index";
import { DrawingEngine } from "../domain/drawing-engine";
import { DrawingInputController, mapLocalToLogical } from "../domain/drawing-input";
import { exportPng, exportThumbnail } from "../export/png-export";
import { readSharedImportProbe, SharedImportProbe } from "./shared-import-probe";
import { prepareCocosTextureRgba } from "./texture-orientation";

const { ccclass, property } = _decorator;

export type DrawingDiagnostics = {
  readonly logicalWidth: number;
  readonly logicalHeight: number;
  readonly displayWidth: number;
  readonly displayHeight: number;
  readonly displayLocalWidth: number;
  readonly displayLocalHeight: number;
  readonly displayWorldWidth: number;
  readonly displayWorldHeight: number;
  readonly strokeCount: number;
  readonly samplePointCount: number;
  readonly tool: DrawingTool;
  readonly exportWidth: number;
  readonly exportHeight: number;
  readonly pngByteLength: number;
  readonly lastExportKind: "artwork" | "thumbnail" | undefined;
  readonly transparentPixelCount: number;
  readonly artworkId: string;
  readonly artworkRevision: number;
  readonly sharedImport: SharedImportProbe;
  readonly lastError: string | undefined;
};

@ccclass("DrawBornDrawingSpike")
export class DrawingSpike extends Component {
  @property(Sprite)
  public displaySprite: Sprite | null = null;

  @property(UITransform)
  public drawingArea: UITransform | null = null;

  @property
  public artworkId = "drawing-spike";

  @property
  public artworkRevision = 1;

  private engine: DrawingEngine | undefined;
  private input: DrawingInputController | undefined;
  private texture: Texture2D | undefined;
  private spriteFrame: SpriteFrame | undefined;
  private tool: DrawingTool = "pencil";
  private color = "#111827";
  private lineWidth = 8;
  private displayWidth = 0;
  private displayHeight = 0;
  private lastPngByteLength = 0;
  private lastExportWidth = 0;
  private lastExportHeight = 0;
  private lastExportKind: "artwork" | "thumbnail" | undefined;
  private lastError: string | undefined;
  private boundInputMode: "touch" | "mouse" | undefined;

  protected onLoad(): void {
    try {
      this.engine = new DrawingEngine({
        artworkId: this.artworkId,
        artworkRevision: this.artworkRevision
      });
      this.input = this.engine.createInputController({
        createStrokeId: () => `stroke-${this.engine?.getStrokes().length ?? 0}`,
        tool: this.tool,
        color: this.color,
        width: this.lineWidth
      });
      this.refreshTexture();
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : "Drawing component failed to load.";
    }
  }

  protected onDestroy(): void {
    this.unbindEvents();
    this.spriteFrame?.destroy();
    this.texture?.destroy();
    this.spriteFrame = undefined;
    this.texture = undefined;
    this.input = undefined;
    this.engine = undefined;
  }

  protected onEnable(): void {
    this.bindEvents();
    try {
      if (this.engine) {
        this.refreshTexture();
      }
    } catch (error) {
      this.captureError(error, "Unable to refresh drawing texture.");
    }
  }

  protected onDisable(): void {
    try {
      this.input?.cancelActive();
      if (this.engine) {
        this.refreshTexture();
      }
    } catch (error) {
      this.captureError(error, "Unable to cancel disabled drawing stroke.");
    }
    this.unbindEvents();
  }

  public setTool(tool: DrawingTool): void {
    try {
      if (tool !== "pencil" && tool !== "marker" && tool !== "eraser") {
        throw new Error("Unknown drawing tool.");
      }
      this.tool = tool;
      this.input?.setTool(tool);
      this.lastError = undefined;
    } catch (error) {
      this.recordError(error, "Unable to set drawing tool.");
    }
  }

  public setColor(color: string): void {
    try {
      if (!/^#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?$/.test(color)) {
        throw new Error("Drawing color must be RGB or RGBA hexadecimal.");
      }
      this.color = color;
      this.input?.setColor(color);
      this.lastError = undefined;
    } catch (error) {
      this.recordError(error, "Unable to set drawing color.");
    }
  }

  public setLineWidth(width: number): void {
    try {
      if (
        !Number.isFinite(width) ||
        width < DRAWING_LIMITS.minLineWidth ||
        width > DRAWING_LIMITS.maxLineWidth
      ) {
        throw new Error(
          `Drawing line width must be between ${DRAWING_LIMITS.minLineWidth} and ${DRAWING_LIMITS.maxLineWidth}.`
        );
      }
      this.lineWidth = width;
      this.input?.setLineWidth(width);
      this.lastError = undefined;
    } catch (error) {
      this.recordError(error, "Unable to set drawing line width.");
    }
  }

  public clear(): void {
    try {
      this.input?.cancelActive();
      this.requireEngine().clear();
      this.lastPngByteLength = 0;
      this.lastExportWidth = 0;
      this.lastExportHeight = 0;
      this.lastExportKind = undefined;
      this.refreshTexture();
      this.lastError = undefined;
    } catch (error) {
      this.recordError(error, "Unable to clear drawing.");
    }
  }

  public exportArtwork(): PngExportResult {
    try {
      const engine = this.requireEngine();
      const result = exportPng(
        {
          artworkId: engine.artworkId,
          artworkRevision: engine.artworkRevision,
          width: DRAWING_CANVAS_WIDTH,
          height: DRAWING_CANVAS_HEIGHT
        },
        engine.getPixels()
      );
      this.lastPngByteLength = result.bytes.length;
      this.lastExportWidth = result.width;
      this.lastExportHeight = result.height;
      this.lastExportKind = "artwork";
      this.lastError = undefined;
      return result;
    } catch (error) {
      this.recordError(error, "Unable to export artwork.");
    }
  }

  public exportThumbnail(): ThumbnailExportResult {
    try {
      const engine = this.requireEngine();
      const result = exportThumbnail(
        {
          artworkId: engine.artworkId,
          artworkRevision: engine.artworkRevision,
          width: 256,
          height: 256
        },
        engine.getPixels()
      );
      this.lastPngByteLength = result.bytes.length;
      this.lastExportWidth = result.width;
      this.lastExportHeight = result.height;
      this.lastExportKind = "thumbnail";
      this.lastError = undefined;
      return result;
    } catch (error) {
      this.recordError(error, "Unable to export thumbnail.");
    }
  }

  public loadTestPattern(): void {
    try {
      this.input?.cancelActive();
      this.requireEngine().loadTestPattern();
      this.refreshTexture();
      this.lastError = undefined;
    } catch (error) {
      this.recordError(error, "Unable to load test pattern.");
    }
  }

  public getDiagnostics(): DrawingDiagnostics {
    const engine = this.requireEngine();
    const dimensions = this.getDisplayDimensions();
    return {
      logicalWidth: DRAWING_CANVAS_WIDTH,
      logicalHeight: DRAWING_CANVAS_HEIGHT,
      displayWidth: dimensions.worldWidth,
      displayHeight: dimensions.worldHeight,
      displayLocalWidth: dimensions.localWidth,
      displayLocalHeight: dimensions.localHeight,
      displayWorldWidth: dimensions.worldWidth,
      displayWorldHeight: dimensions.worldHeight,
      strokeCount: engine.getStrokes().length,
      samplePointCount: engine
        .getStrokes()
        .reduce((total, stroke) => total + stroke.points.length, 0),
      tool: this.tool,
      exportWidth: this.lastExportWidth,
      exportHeight: this.lastExportHeight,
      pngByteLength: this.lastPngByteLength,
      lastExportKind: this.lastExportKind,
      transparentPixelCount: engine.countTransparentPixels(),
      artworkId: engine.artworkId,
      artworkRevision: engine.artworkRevision,
      sharedImport: readSharedImportProbe(),
      lastError: this.lastError
    };
  }

  private requireEngine(): DrawingEngine {
    if (!this.engine) {
      throw new Error("Drawing component is not loaded.");
    }
    return this.engine;
  }

  private recordError(error: unknown, fallback: string): never {
    this.lastError = error instanceof Error ? error.message : fallback;
    throw error instanceof Error ? error : new Error(fallback);
  }

  private captureError(error: unknown, fallback: string): void {
    this.lastError = error instanceof Error ? error.message : fallback;
  }

  private bindEvents(): void {
    if (this.boundInputMode !== undefined) {
      return;
    }
    // Desktop Safari may emit touch events for right clicks, even with simulate=false.
    // Select one route per binding session instead of inspecting individual events.
    this.boundInputMode = sys.isMobile ? "touch" : "mouse";
    if (this.boundInputMode === "touch") {
      this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
      this.node.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
      this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
      this.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
    } else {
      this.node.on(Node.EventType.MOUSE_DOWN, this.onMouseDown, this);
      this.node.on(Node.EventType.MOUSE_MOVE, this.onMouseMove, this);
      this.node.on(Node.EventType.MOUSE_UP, this.onMouseUp, this);
      // Leaving commits once; later node/global releases are idempotent.
      this.node.on(Node.EventType.MOUSE_LEAVE, this.onMouseUp, this);
      // Global release only ends the active stroke; never reads UI coordinates.
      input.on(Input.EventType.MOUSE_UP, this.onMouseUp, this);
    }
  }

  private unbindEvents(): void {
    if (this.boundInputMode === undefined) {
      return;
    }
    // Unbind the actual session mode; never re-read platform detection here.
    if (this.boundInputMode === "touch") {
      this.node.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
      this.node.off(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
      this.node.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
      this.node.off(Node.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
    } else {
      this.node.off(Node.EventType.MOUSE_DOWN, this.onMouseDown, this);
      this.node.off(Node.EventType.MOUSE_MOVE, this.onMouseMove, this);
      this.node.off(Node.EventType.MOUSE_UP, this.onMouseUp, this);
      this.node.off(Node.EventType.MOUSE_LEAVE, this.onMouseUp, this);
      input.off(Input.EventType.MOUSE_UP, this.onMouseUp, this);
    }
    this.boundInputMode = undefined;
  }

  private onTouchStart(event: EventTouch): void {
    const pointerId = event.getID();
    if (pointerId === null) {
      return;
    }
    const location = event.getUILocation();
    this.begin(pointerId, location.x, location.y);
  }

  private onTouchMove(event: EventTouch): void {
    const pointerId = event.getID();
    if (pointerId === null) {
      return;
    }
    const location = event.getUILocation();
    this.move(pointerId, location.x, location.y);
  }

  private onTouchEnd(event: EventTouch): void {
    const pointerId = event.getID();
    if (pointerId === null) {
      return;
    }
    try {
      this.input?.end(pointerId);
    } catch (error) {
      this.captureError(error, "Unable to finish touch stroke.");
    }
  }

  private onTouchCancel(event: EventTouch): void {
    const pointerId = event.getID();
    if (pointerId === null) {
      return;
    }
    try {
      if (this.input?.cancel(pointerId)) {
        this.refreshTexture();
      }
    } catch (error) {
      this.captureError(error, "Unable to cancel touch stroke.");
    }
  }

  private onMouseDown(event: EventMouse): void {
    if (event.getButton() !== EventMouse.BUTTON_LEFT) {
      return;
    }
    const location = event.getUILocation();
    this.begin("mouse", location.x, location.y);
  }

  private onMouseMove(event: EventMouse): void {
    const location = event.getUILocation();
    this.move("mouse", location.x, location.y);
  }

  private onMouseUp(): void {
    try {
      this.input?.end("mouse");
    } catch (error) {
      this.captureError(error, "Unable to finish mouse stroke.");
    }
  }

  private begin(pointerId: number | string, x: number, y: number): void {
    try {
      const input = this.input;
      if (!input) {
        return;
      }
      const point = this.toLogicalPoint(x, y);
      if (point && input.beginLogical(pointerId, point)) {
        this.refreshTexture();
      }
    } catch (error) {
      this.captureError(error, "Unable to begin drawing stroke.");
    }
  }

  private move(pointerId: number | string, x: number, y: number): void {
    try {
      const input = this.input;
      if (!input) {
        return;
      }
      const point = this.toLogicalPoint(x, y);
      if (point && input.moveLogical(pointerId, point)) {
        this.refreshTexture();
      }
    } catch (error) {
      this.captureError(error, "Unable to sample drawing stroke.");
    }
  }

  private toLogicalPoint(worldX: number, worldY: number): { x: number; y: number } | undefined {
    const area = this.drawingArea;
    if (!area) {
      return undefined;
    }
    const local = area.convertToNodeSpaceAR(new Vec3(worldX, worldY, 0));
    const width = area.width;
    const height = area.height;
    this.displayWidth = width;
    this.displayHeight = height;
    if (width <= 0 || height <= 0 || !Number.isFinite(local.x) || !Number.isFinite(local.y)) {
      return undefined;
    }
    return mapLocalToLogical(local.x, local.y, {
      width,
      height,
      anchorX: area.anchorX,
      anchorY: area.anchorY
    });
  }

  private getDisplayDimensions(): {
    readonly localWidth: number;
    readonly localHeight: number;
    readonly worldWidth: number;
    readonly worldHeight: number;
  } {
    const area = this.drawingArea;
    if (!area) {
      return {
        localWidth: this.displayWidth,
        localHeight: this.displayHeight,
        worldWidth: this.displayWidth,
        worldHeight: this.displayHeight
      };
    }
    const scale = area.node.worldScale;
    return {
      localWidth: area.width,
      localHeight: area.height,
      worldWidth: area.width * Math.abs(scale.x),
      worldHeight: area.height * Math.abs(scale.y)
    };
  }

  private refreshTexture(): void {
    const engine = this.requireEngine();
    const pixels = prepareCocosTextureRgba(
      engine.getPixels(),
      DRAWING_CANVAS_WIDTH,
      DRAWING_CANVAS_HEIGHT
    );
    if (!this.texture) {
      this.texture = new Texture2D();
      this.texture.reset({
        width: DRAWING_CANVAS_WIDTH,
        height: DRAWING_CANVAS_HEIGHT,
        format: Texture2D.PixelFormat.RGBA8888
      });
      this.spriteFrame = new SpriteFrame();
      this.spriteFrame.texture = this.texture;
      if (this.displaySprite && this.spriteFrame) {
        const displayTransform = this.displaySprite.getComponent(UITransform);
        const width = displayTransform?.width;
        const height = displayTransform?.height;
        this.displaySprite.spriteFrame = this.spriteFrame;
        this.displaySprite.sizeMode = Sprite.SizeMode.CUSTOM;
        if (displayTransform && width !== undefined && height !== undefined) {
          displayTransform.setContentSize(width, height);
        }
      }
    }
    this.texture.uploadData(pixels);
  }
}
