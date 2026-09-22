import { inflateSync } from "node:zlib";
import { readFileSync } from "node:fs";
import ts41 from "typescript-4-1";
import { describe, expect, it } from "vitest";
import {
  DRAWING_LIMITS,
  DRAWING_SCHEMA_VERSION
} from "../../apps/game-client/assets/shared/contracts/index";
import { validateDrawingDraft } from "../../packages/contracts/src/creation";
import {
  DrawingInputController,
  mapLocalToLogical,
  mapDisplayPoint
} from "../../apps/game-client/assets/scripts/creation/spike/domain/drawing-input";
import { DrawingEngine } from "../../apps/game-client/assets/scripts/creation/spike/domain/drawing-engine";
import {
  encodePngRgba,
  downsampleRgbaBox,
  exportPng,
  exportThumbnail,
  RasterExportPort
} from "../../apps/game-client/assets/scripts/creation/spike/export/png-export";
import { readSharedImportProbe } from "../../apps/game-client/assets/scripts/creation/spike/cocos/shared-import-probe";
import { prepareCocosTextureRgba } from "../../apps/game-client/assets/scripts/creation/spike/cocos/texture-orientation";

function crc32ForTest(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc ^= bytes[index];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function decodePng(png: Uint8Array): { width: number; height: number; pixels: Uint8Array } {
  expect(Array.from(png.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  const readUint32 = (offset: number): number =>
    (((png[offset] << 24) >>> 0) |
      (png[offset + 1] << 16) |
      (png[offset + 2] << 8) |
      png[offset + 3]) >>>
    0;
  const width = readUint32(16);
  const height = readUint32(20);
  const idat: number[] = [];
  let offset = 8;
  while (offset < png.length) {
    const length = readUint32(offset);
    const type = String.fromCharCode(...png.subarray(offset + 4, offset + 8));
    const crcInput = new Uint8Array(4 + length);
    crcInput.set(png.subarray(offset + 4, offset + 8), 0);
    crcInput.set(png.subarray(offset + 8, offset + 8 + length), 4);
    expect(readUint32(offset + 8 + length)).toBe(crc32ForTest(crcInput));
    if (type === "IDAT") {
      for (let index = 0; index < length; index += 1) {
        idat.push(png[offset + 8 + index]);
      }
    }
    offset += length + 12;
  }
  const inflated = new Uint8Array(inflateSync(new Uint8Array(idat)));
  const pixels = new Uint8Array(width * height * 4);
  const rowSize = width * 4;
  for (let y = 0; y < height; y += 1) {
    expect(inflated[y * (rowSize + 1)]).toBe(0);
    pixels.set(inflated.subarray(y * (rowSize + 1) + 1, (y + 1) * (rowSize + 1)), y * rowSize);
  }
  return { width, height, pixels };
}

describe("drawing input and deterministic raster surface", () => {
  it("creates, retrieves and exports identities accepted by the authoritative draft validator", () => {
    for (const [artworkId, artworkRevision] of [
      ["Audit_1.test:ok-2", 1],
      ["A".repeat(DRAWING_LIMITS.maxIdLength), 2147483647]
    ] as const) {
      const engine = new DrawingEngine({ artworkId, artworkRevision });
      expect(validateDrawingDraft(engine.getDraft()).success).toBe(true);
      engine.appendStroke({
        id: "identity-stroke",
        tool: "pencil",
        points: [{ x: 10, y: 10 }],
        width: 8,
        color: "#ff0000"
      });
      const draft = engine.getDraft();
      expect(draft).toMatchObject({
        schemaVersion: DRAWING_SCHEMA_VERSION,
        artworkId,
        revision: artworkRevision,
        drawing: { width: 1024, height: 1024 }
      });
      expect(validateDrawingDraft(draft)).toEqual({ success: true, data: draft });
      for (const result of [
        exportPng({ artworkId, artworkRevision, width: 1024, height: 1024 }, engine.getPixels()),
        exportThumbnail({ artworkId, artworkRevision, width: 256, height: 256 }, engine.getPixels())
      ]) {
        expect(result).toMatchObject({ artworkId, artworkRevision, mimeType: "image/png" });
        expect(result.bytes.length).toBeGreaterThan(0);
      }
      engine.clear();
      expect(validateDrawingDraft(engine.getDraft()).success).toBe(true);
    }
  });

  it.each(["", "-bad", "bad id", "bad/id", "画作", "A".repeat(DRAWING_LIMITS.maxIdLength + 1)])(
    "rejects invalid artwork ID at construction: %s",
    (artworkId) => {
      expect(() => new DrawingEngine({ artworkId, artworkRevision: 1 })).toThrow("artworkId");
    }
  );

  it.each([0, -1, 1.5, 2147483648, Number.NaN, Infinity, -Infinity])(
    "rejects invalid revision at construction: %s",
    (artworkRevision) => {
      expect(() => new DrawingEngine({ artworkId: "valid", artworkRevision })).toThrow("revision");
    }
  );

  it("maps aspect ratios, edges and rejects invalid display input", () => {
    expect(mapDisplayPoint(50, 100, { left: 50, top: 100, width: 200, height: 100 })).toEqual({
      x: 0,
      y: 0
    });
    expect(mapDisplayPoint(250, 200, { left: 50, top: 100, width: 200, height: 100 })).toEqual({
      x: 1024,
      y: 1024
    });
    expect(mapDisplayPoint(-100, 9999, { left: 0, top: 0, width: 300, height: 600 })).toEqual({
      x: 0,
      y: 1024
    });
    expect(mapDisplayPoint(1, 1, { left: 0, top: 0, width: 0, height: 20 })).toBeUndefined();
    expect(
      mapDisplayPoint(Number.NaN, 1, { left: 0, top: 0, width: 20, height: 20 })
    ).toBeUndefined();
  });

  it("maps converted local coordinates with non-default anchors and nonuniform scale", () => {
    expect(
      mapLocalToLogical(-25, 10, { width: 100, height: 50, anchorX: 0.25, anchorY: 0.8 })
    ).toEqual({ x: 0, y: 0 });
    expect(
      mapLocalToLogical(75, -40, { width: 100, height: 50, anchorX: 0.25, anchorY: 0.8 })
    ).toEqual({ x: 1024, y: 1024 });
    const source = new Uint8Array([255, 0, 0, 255, 0, 0, 255, 255]);
    const texturePixels = prepareCocosTextureRgba(source, 1, 2);
    expect(texturePixels).toEqual(source);
    expect(texturePixels.slice(0, 4)).toEqual(new Uint8Array([255, 0, 0, 255]));
    expect(texturePixels.slice(4, 8)).toEqual(new Uint8Array([0, 0, 255, 255]));
    expect(texturePixels).not.toBe(source);
  });

  it("handles one pointer, continuous samples, cancellation and duplicate end", () => {
    const engine = new DrawingEngine({ artworkId: "input", artworkRevision: 1 });
    let nextId = 0;
    const input = new DrawingInputController(engine, {
      createStrokeId: () => `stroke-${nextId++}`,
      tool: "pencil",
      color: "#ff0000",
      width: 12
    });
    const rect = { left: 0, top: 0, width: 512, height: 256 };
    expect(input.begin(1, 2, 4, rect)).toBe(true);
    expect(input.begin(2, 4, 4, rect)).toBe(false);
    expect(input.beginLogical(2, { x: 40, y: 40 })).toBe(false);
    expect(input.move(2, 200, 100, rect)).toBe(false);
    expect(input.move(1, 200, 100, rect)).toBe(true);
    expect(input.move(1, 400, 200, rect)).toBe(true);
    expect(input.end(1)).toBe(true);
    expect(input.end(1)).toBe(false);
    expect(engine.getStrokes()[0].points).toHaveLength(3);
    expect(input.begin(3, 10, 10, rect)).toBe(true);
    expect(input.cancel(3)).toBe(true);
    expect(input.cancel(3)).toBe(false);
    expect(engine.getStrokes()).toHaveLength(1);
  });

  it("rolls back a failed direct begin and keeps the active pointer state", () => {
    const engine = new DrawingEngine({ artworkId: "failed-input", artworkRevision: 1 });
    const input = new DrawingInputController(engine, {
      createStrokeId: () => "same-id",
      tool: "pencil",
      color: "#ff0000",
      width: 8
    });
    expect(input.beginLogical(1, { x: 20, y: 20 })).toBe(true);
    expect(input.end(1)).toBe(true);
    expect(() => input.beginLogical(2, { x: 40, y: 40 })).toThrow("unique");
    expect(input.active).toBe(false);
    expect(engine.getStrokes()).toHaveLength(1);
    expect(() => input.beginLogical(3, { x: 40, y: 40 })).toThrow("unique");
    expect(input.active).toBe(false);
    expect(engine.getStrokes()).toHaveLength(1);
  });

  it("commits mouse leave once and ignores later releases without affecting touch ownership", () => {
    const engine = new DrawingEngine({ artworkId: "mouse-leave", artworkRevision: 1 });
    let nextId = 0;
    const input = engine.createInputController({
      createStrokeId: () => `mouse-${nextId++}`,
      tool: "pencil",
      color: "#ff0000",
      width: 8
    });
    expect(input.beginLogical("mouse", { x: 10, y: 10 })).toBe(true);
    expect(input.moveLogical("mouse", { x: 20, y: 20 })).toBe(true);
    expect(input.end("mouse")).toBe(true); // Node MOUSE_LEAVE commits.
    expect(input.end("mouse")).toBe(false); // Later node MOUSE_UP.
    expect(input.end("mouse")).toBe(false); // Later global MOUSE_UP.
    expect(input.active).toBe(false);
    const committed = engine.getDraft();
    expect(committed.drawing.strokes).toHaveLength(1);
    expect(input.beginLogical(1, { x: 30, y: 30 })).toBe(true);
    expect(input.beginLogical(2, { x: 40, y: 40 })).toBe(false);
    expect(input.end("mouse")).toBe(false);
    expect(input.cancel(1)).toBe(true);
    expect(engine.getDraft()).toEqual(committed);
  });

  it("renders minimum-width dots at integer coordinates including both corners", () => {
    const engine = new DrawingEngine({ artworkId: "dots", artworkRevision: 1 });
    engine.replaceStrokes([
      { id: "top-left", tool: "pencil", points: [{ x: 0, y: 0 }], width: 1, color: "#ff0000" },
      {
        id: "bottom-right",
        tool: "pencil",
        points: [{ x: 1024, y: 1024 }],
        width: 1,
        color: "#00ff00"
      }
    ]);
    const pixels = engine.getPixels();
    expect(pixels.slice(0, 4)).toEqual(new Uint8Array([255, 0, 0, 255]));
    const bottomRight = (1023 * 1024 + 1023) * 4;
    expect(pixels.slice(bottomRight, bottomRight + 4)).toEqual(new Uint8Array([0, 255, 0, 255]));
  });

  it("deep-copies returned strokes so callers cannot desynchronize pixels", () => {
    const engine = new DrawingEngine({ artworkId: "copy", artworkRevision: 1 });
    engine.replaceStrokes([
      { id: "copy-stroke", tool: "pencil", points: [{ x: 20, y: 20 }], width: 8, color: "#ff0000" }
    ]);
    const strokes = engine.getStrokes() as Array<{ points: Array<{ x: number; y: number }> }>;
    strokes[0].points[0].x = 900;
    expect(engine.getStrokes()[0].points[0].x).toBe(20);
    expect(engine.getDocument().strokes[0].points[0].x).toBe(20);
  });

  it("keeps marker opacity stable inside a stroke and composites strokes source-over", () => {
    const one = new DrawingEngine({ artworkId: "marker", artworkRevision: 1 });
    const many = new DrawingEngine({ artworkId: "marker", artworkRevision: 1 });
    const oneStroke = {
      id: "one",
      tool: "marker" as const,
      points: [
        { x: 400, y: 400 },
        { x: 600, y: 400 }
      ],
      width: 40,
      color: "#ff0000"
    };
    one.replaceStrokes([oneStroke]);
    many.replaceStrokes([
      {
        ...oneStroke,
        id: "many",
        points: [
          { x: 400, y: 400 },
          { x: 450, y: 400 },
          { x: 500, y: 400 },
          { x: 550, y: 400 },
          { x: 600, y: 400 }
        ]
      }
    ]);
    const onePixels = one.getPixels();
    const manyPixels = many.getPixels();
    [400, 450, 500, 550, 600].forEach((x) => {
      const offset = (400 * 1024 + x) * 4;
      expect(manyPixels.slice(offset, offset + 4)).toEqual(onePixels.slice(offset, offset + 4));
    });
    const overlap = new DrawingEngine({ artworkId: "marker", artworkRevision: 1 });
    overlap.replaceStrokes([
      oneStroke,
      {
        ...oneStroke,
        id: "two",
        points: [
          { x: 400, y: 400 },
          { x: 600, y: 400 }
        ]
      }
    ]);
    expect(overlap.getPixels()[(400 * 1024 + 500) * 4 + 3]).toBeGreaterThan(
      one.getPixels()[(400 * 1024 + 500) * 4 + 3]
    );
  });

  it("clears alpha with eraser and clears the complete canvas", () => {
    const engine = new DrawingEngine({ artworkId: "erase", artworkRevision: 1 });
    engine.replaceStrokes([
      {
        id: "paint",
        tool: "pencil",
        points: [{ x: 100, y: 100 }],
        width: 80,
        color: "#00ff00"
      },
      {
        id: "erase",
        tool: "eraser",
        points: [{ x: 100, y: 100 }],
        width: 80
      }
    ]);
    const pixels = engine.getPixels();
    const offset = (100 * 1024 + 100) * 4;
    expect(pixels[offset + 3]).toBe(0);
    expect(pixels[offset]).toBe(0);
    engine.clear();
    expect(engine.getPixels().every((value) => value === 0)).toBe(true);
  });

  it("exports valid 1024 PNGs and 256 thumbnails with transparent alpha", () => {
    const engine = new DrawingEngine({ artworkId: "pattern", artworkRevision: 7 });
    engine.loadTestPattern();
    const result = exportPng(
      { artworkId: "pattern", artworkRevision: 7, width: 1024, height: 1024 },
      engine.getPixels()
    );
    const decoded = decodePng(result.bytes);
    expect(decoded.width).toBe(1024);
    expect(decoded.height).toBe(1024);
    expect(result).toMatchObject({
      artworkId: "pattern",
      artworkRevision: 7,
      width: 1024,
      height: 1024,
      mimeType: "image/png"
    });
    expect(decoded.pixels.slice(0, 4)).toEqual(new Uint8Array([255, 0, 0, 255]));
    expect(decoded.pixels.slice((0 * 1024 + 1023) * 4, (0 * 1024 + 1023) * 4 + 4)).toEqual(
      new Uint8Array([0, 255, 0, 255])
    );
    expect(decoded.pixels.slice((1023 * 1024 + 0) * 4, (1023 * 1024 + 0) * 4 + 4)).toEqual(
      new Uint8Array([0, 0, 255, 255])
    );
    expect(decoded.pixels.slice((1023 * 1024 + 1023) * 4, (1023 * 1024 + 1023) * 4 + 4)).toEqual(
      new Uint8Array([0, 0, 0, 0])
    );
    expect(decoded.pixels[(512 * 1024 + 512) * 4 + 3]).toBe(0);
    const thumbnailResult = exportThumbnail(
      { artworkId: "pattern", artworkRevision: 7, width: 256, height: 256 },
      engine.getPixels()
    );
    expect(thumbnailResult).toMatchObject({
      artworkId: "pattern",
      artworkRevision: 7,
      width: 256,
      height: 256,
      mimeType: "image/png"
    });
    const thumbnail = decodePng(thumbnailResult.bytes);
    expect([thumbnail.width, thumbnail.height]).toEqual([256, 256]);
    const thumbnailPixel = (x: number, y: number): number[] => {
      const offset = (y * thumbnail.width + x) * 4;
      return Array.from(thumbnail.pixels.slice(offset, offset + 4));
    };
    expect(thumbnailPixel(0, 0)).toEqual([255, 0, 0, 255]);
    expect(thumbnailPixel(255, 0)).toEqual([0, 255, 0, 255]);
    expect(thumbnailPixel(0, 255)).toEqual([0, 0, 255, 255]);
    expect(thumbnailPixel(255, 255)).toEqual([0, 0, 0, 0]);
    expect(thumbnailPixel(128, 128)).toEqual([0, 0, 0, 0]);
  });

  it("rejects invalid exports and retains artwork revision binding", async () => {
    const engine = new DrawingEngine({ artworkId: "bound", artworkRevision: 2 });
    expect(() =>
      exportPng({ artworkId: "bound", artworkRevision: 2, width: 1, height: 1 }, new Uint8Array(4))
    ).toThrow();
    expect(() =>
      exportPng(
        { artworkId: "bad id", artworkRevision: 2, width: 1024, height: 1024 },
        engine.getPixels()
      )
    ).toThrow();
    expect(() =>
      exportPng(
        { artworkId: "bound", artworkRevision: Number.NaN, width: 1024, height: 1024 },
        engine.getPixels()
      )
    ).toThrow();
    expect(() =>
      exportThumbnail(
        { artworkId: "bound", artworkRevision: 2, width: 64, height: 64 },
        engine.getPixels()
      )
    ).toThrow();
    expect(() => encodePngRgba(new Uint8Array(4), Number.POSITIVE_INFINITY, 1)).toThrow(
      "dimensions"
    );
    expect(() => downsampleRgbaBox(new Uint8Array(4), 0, 1)).toThrow("dimensions");
    const port = new RasterExportPort(() => engine.getPixels(), "bound", 2);
    await expect(
      port.exportPng({
        artworkId: "other",
        artworkRevision: 2,
        width: 1024,
        height: 1024
      })
    ).rejects.toThrow("identity");
    expect(DRAWING_LIMITS.maxStrokes).toBe(512);
  });
});

describe("Cocos source boundary and TS 4.1 syntax guard", () => {
  const readAdapterAst = () => {
    const source = readFileSync(
      "apps/game-client/assets/scripts/creation/spike/cocos/DrawingSpike.ts",
      "utf8"
    );
    const parsed = ts41.createSourceFile("DrawingSpike.ts", source, ts41.ScriptTarget.Latest, true);
    const component = parsed.statements.find(ts41.isClassDeclaration);
    const body = (name: string) => {
      const method = component?.members.find(
        (member) => ts41.isMethodDeclaration(member) && member.name.getText(parsed) === name
      );
      if (!method || !ts41.isMethodDeclaration(method) || !method.body) {
        throw new Error(`Missing component method: ${name}`);
      }
      return method.body;
    };
    const compact = (node: ts41.Node): string => node.getText(parsed).replace(/\s+/g, "");
    return { parsed, body, compact };
  };

  it.each([
    ["bindEvents", "on"],
    ["unbindEvents", "off"]
  ])("%s uses exclusive input branches and symmetric saved-mode listeners", (name, action) => {
    const { parsed, body, compact } = readAdapterAst();
    const binding = action === "on";
    const statements = body(name).statements;
    expect(statements).toHaveLength(3);
    expect(compact(statements[0])).toBe(
      binding
        ? "if(this.boundInputMode!==undefined){return;}"
        : "if(this.boundInputMode===undefined){return;}"
    );
    if (binding) {
      const assignment = statements[1];
      if (
        !ts41.isExpressionStatement(assignment) ||
        !ts41.isBinaryExpression(assignment.expression)
      ) {
        throw new Error("Binding must save the selected mode before registering listeners");
      }
      const selection = assignment.expression.right;
      expect(ts41.isConditionalExpression(selection)).toBe(true);
      expect(compact(assignment)).toBe('this.boundInputMode=sys.isMobile?"touch":"mouse";');
      expect(
        parsed.statements.some((statement) => {
          if (
            !ts41.isImportDeclaration(statement) ||
            statement.moduleSpecifier.getText(parsed) !== '"cc"'
          ) {
            return false;
          }
          const imports = statement.importClause?.namedBindings;
          return (
            imports &&
            ts41.isNamedImports(imports) &&
            imports.elements.some((element) => element.name.text === "sys" && !element.propertyName)
          );
        })
      ).toBe(true);
    } else {
      expect(compact(body(name))).not.toContain("sys");
      expect(compact(statements[2])).toBe("this.boundInputMode=undefined;");
    }
    const route = statements[binding ? 2 : 1];
    if (
      !ts41.isIfStatement(route) ||
      !ts41.isBlock(route.thenStatement) ||
      !route.elseStatement ||
      !ts41.isBlock(route.elseStatement)
    ) {
      throw new Error("Listeners must be inside one mutually exclusive if/else");
    }
    expect(compact(route.expression)).toBe('this.boundInputMode==="touch"');
    // Exact AST statement lists prohibit listeners outside their route or hidden
    // behind additional conditions, and check the handler/context on removal.
    expect(route.thenStatement.statements.every(ts41.isExpressionStatement)).toBe(true);
    expect(route.elseStatement.statements.every(ts41.isExpressionStatement)).toBe(true);
    expect(route.thenStatement.statements.map(compact)).toEqual([
      `this.node.${action}(Node.EventType.TOUCH_START,this.onTouchStart,this);`,
      `this.node.${action}(Node.EventType.TOUCH_MOVE,this.onTouchMove,this);`,
      `this.node.${action}(Node.EventType.TOUCH_END,this.onTouchEnd,this);`,
      `this.node.${action}(Node.EventType.TOUCH_CANCEL,this.onTouchCancel,this);`
    ]);
    expect(route.elseStatement.statements.map(compact)).toEqual([
      `this.node.${action}(Node.EventType.MOUSE_DOWN,this.onMouseDown,this);`,
      `this.node.${action}(Node.EventType.MOUSE_MOVE,this.onMouseMove,this);`,
      `this.node.${action}(Node.EventType.MOUSE_UP,this.onMouseUp,this);`,
      `this.node.${action}(Node.EventType.MOUSE_LEAVE,this.onMouseUp,this);`,
      `input.${action}(Input.EventType.MOUSE_UP,this.onMouseUp,this);`
    ]);
  });

  it("keeps enable/disable cancellation and repeat-safe saved-mode lifecycle guards", () => {
    const { body, compact } = readAdapterAst();
    expect(compact(body("onEnable").statements[0])).toBe("this.bindEvents();");
    const disabled = body("onDisable").statements;
    expect(disabled).toHaveLength(2);
    const cancellation = disabled[0];
    if (!ts41.isTryStatement(cancellation)) {
      throw new Error("Disable must cancel active input before unbinding");
    }
    expect(compact(cancellation.tryBlock.statements[0])).toBe("this.input?.cancelActive();");
    expect(compact(disabled[1])).toBe("this.unbindEvents();");
    expect(compact(body("onDestroy").statements[0])).toBe("this.unbindEvents();");
  });

  it("keeps real touch handlers without the ineffective simulate filter", () => {
    const { body, compact } = readAdapterAst();
    for (const name of ["onTouchStart", "onTouchMove", "onTouchEnd", "onTouchCancel"]) {
      const handler = body(name);
      expect(compact(handler.statements[0])).toBe("constpointerId=event.getID();");
      expect(compact(handler.statements[1])).toBe("if(pointerId===null){return;}");
      expect(compact(handler)).not.toContain("simulate");
      if (name === "onTouchStart" || name === "onTouchMove") {
        expect(compact(handler)).toContain("event.getUILocation()");
      }
    }
    expect(compact(body("onTouchCancel"))).toContain("this.input?.cancel(pointerId)");
    expect(compact(body("onTouchCancel"))).toContain("this.refreshTexture()");
  });

  it("restricts mouse UI coordinates to node events and keeps global release coordinate-free", () => {
    const source = readFileSync(
      "apps/game-client/assets/scripts/creation/spike/cocos/DrawingSpike.ts",
      "utf8"
    );
    const parsed = ts41.createSourceFile("DrawingSpike.ts", source, ts41.ScriptTarget.Latest, true);
    const component = parsed.statements.find(ts41.isClassDeclaration);
    const methodBody = (name: string): string => {
      const method = component?.members.find(
        (member) => ts41.isMethodDeclaration(member) && member.name.getText(parsed) === name
      );
      if (!method || !ts41.isMethodDeclaration(method) || !method.body) {
        throw new Error(`Missing component method: ${name}`);
      }
      return method.body.getText(parsed).replace(/\s+/g, "");
    };
    const compact = source.replace(/\s+/g, "");
    expect(compact).not.toContain("Input.EventType.MOUSE_MOVE");
    for (const [method, action] of [
      ["bindEvents", "on"],
      ["unbindEvents", "off"]
    ]) {
      const body = methodBody(method);
      expect(body).toContain(
        `this.node.${action}(Node.EventType.MOUSE_MOVE,this.onMouseMove,this)`
      );
      expect(body).toContain(
        `this.node.${action}(Node.EventType.MOUSE_DOWN,this.onMouseDown,this)`
      );
      expect(body).toContain(`this.node.${action}(Node.EventType.MOUSE_LEAVE,this.onMouseUp,this)`);
      expect(body.match(/input\.(?:on|off)\([^;]+/g)).toEqual([
        `input.${action}(Input.EventType.MOUSE_UP,this.onMouseUp,this)`
      ]);
    }
    expect(
      methodBody("onMouseDown").startsWith(
        "{if(event.getButton()!==EventMouse.BUTTON_LEFT){return;}constlocation=event.getUILocation();"
      )
    ).toBe(true);
    expect(methodBody("onMouseMove")).toContain("event.getUILocation()");
    expect(methodBody("onMouseUp")).not.toContain("getUILocation");
    expect(methodBody("onMouseUp")).toContain('this.input?.end("mouse")');
    expect(methodBody("onMouseUp")).not.toContain("cancel");
  });

  it("keeps the runtime adapter on cc and mirrored shared imports", () => {
    const source = readFileSync(
      "apps/game-client/assets/scripts/creation/spike/cocos/DrawingSpike.ts",
      "utf8"
    );
    expect(source).toContain('from "cc"');
    expect(source).not.toContain("../../../.. /shared");
    expect(source).toContain("../../../../shared/contracts/index");
    expect(source).not.toMatch(/from ["'](?:node:|fs|zlib)/);
    expect(source).toContain("convertToNodeSpaceAR");
    expect(source).toContain("Sprite.SizeMode.CUSTOM");
    expect(source).toContain("onEnable");
    expect(source).toContain("onDisable");
    expect(source).toContain("const location = event.getUILocation()");
    expect(source).not.toContain("event.getLocation()");
  });

  it("executes the shared runtime import probe without Cocos typings", () => {
    const probe = readSharedImportProbe();
    expect(probe.contractsLoaded).toBe(true);
    expect(probe.gameDataLoaded).toBe(true);
    expect(probe.logicalWidth).toBe(1024);
    expect(probe.logicalHeight).toBe(1024);
    expect(probe.classCount).toBeGreaterThan(0);
    expect(probe.visualTagCount).toBeGreaterThan(0);
    expect(probe.startingSkillCount).toBeGreaterThan(0);
  });

  it("parses the Cocos adapter with the pinned TypeScript 4.1 compiler", () => {
    const source = readFileSync(
      "apps/game-client/assets/scripts/creation/spike/cocos/DrawingSpike.ts",
      "utf8"
    );
    const result = ts41.transpileModule(source, {
      compilerOptions: { target: ts41.ScriptTarget.ES2019, module: ts41.ModuleKind.ESNext },
      reportDiagnostics: true
    });
    expect(result.diagnostics ?? []).toHaveLength(0);
  });
});
