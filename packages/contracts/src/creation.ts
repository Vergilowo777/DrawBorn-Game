import { HeroClass, HeroElement, HERO_CLASSES, HERO_ELEMENTS } from "./enums";
import { asSkillId, asVisualTagId, SkillId, VisualTagId } from "./ids";

/**
 * Drawing coordinates use a fixed logical canvas. The origin is the top-left
 * corner, x increases to the right, y increases down, and line widths are
 * logical canvas units rather than device pixels.
 */
export const DRAWING_CANVAS_WIDTH = 1024;
export const DRAWING_CANVAS_HEIGHT = 1024;
export const DRAWING_SCHEMA_VERSION = 1 as const;

export const DRAWING_TOOLS = ["pencil", "marker", "eraser"] as const;
export type DrawingTool = (typeof DRAWING_TOOLS)[number];

export const DRAWING_LIMITS = {
  /** Maximum serialized input length in UTF-16 code units. */
  maxSerializedInputLength: 1000000,
  /** Maximum number of strokes in one drawing payload. */
  maxStrokes: 512,
  /** Maximum points in one stroke. */
  maxPointsPerStroke: 4096,
  /** Maximum points across all strokes in one payload. */
  maxTotalPoints: 65536,
  /** Logical line width range, in canvas units. */
  minLineWidth: 1,
  maxLineWidth: 128,
  /** Maximum lengths in UTF-16 code units. */
  maxIdLength: 128,
  maxNameLength: 40,
  maxBackgroundLength: 280,
  /** Maximum candidate/tag counts in an analysis suggestion. */
  maxVisualTags: 32,
  maxClassCandidates: 3,
  maxElementCandidates: 4,
  maxSkillCandidates: 3
} as const;

export type DrawingPoint = {
  readonly x: number;
  readonly y: number;
};

export type ColoredDrawingStroke = {
  readonly id: string;
  readonly tool: "pencil" | "marker";
  readonly points: readonly DrawingPoint[];
  readonly width: number;
  readonly color: string;
};

export type EraserDrawingStroke = {
  readonly id: string;
  readonly tool: "eraser";
  readonly points: readonly DrawingPoint[];
  readonly width: number;
};

export type DrawingStroke = ColoredDrawingStroke | EraserDrawingStroke;

export type DrawingDocument = {
  readonly width: typeof DRAWING_CANVAS_WIDTH;
  readonly height: typeof DRAWING_CANVAS_HEIGHT;
  readonly strokes: readonly DrawingStroke[];
};

export type DrawingDraft = {
  readonly schemaVersion: typeof DRAWING_SCHEMA_VERSION;
  readonly artworkId: string;
  readonly revision: number;
  readonly drawing: DrawingDocument;
};

export type HeroAnalysisSource = "mock" | "manual";

export type HeroAnalysisSuggestion = {
  readonly artworkId: string;
  readonly artworkRevision: number;
  readonly visualTagIds: readonly VisualTagId[];
  /**
   * Candidate class values remain strings at this boundary so business
   * filtering can report a useful reason for a closed or unknown class.
   */
  readonly classCandidates: readonly string[];
  readonly elementCandidates: readonly HeroElement[];
  readonly skillCandidates: readonly SkillId[];
  readonly suggestedName?: string | undefined;
  readonly suggestedBackground?: string | undefined;
  readonly source: HeroAnalysisSource;
};

/**
 * Phase 1.1 intentionally has no public or reviewed state. A later publishing
 * flow may add those states after implementing moderation.
 */
export type HeroVisibility = "private";
export type HeroReviewStatus = "unreviewed";

export type ConfirmedHero = {
  readonly heroId: string;
  readonly artworkId: string;
  readonly artworkRevision: number;
  readonly visualTagIds: readonly VisualTagId[];
  readonly heroClass: HeroClass;
  readonly element: HeroElement;
  readonly startingSkillId: SkillId;
  readonly name?: string | undefined;
  readonly background?: string | undefined;
  readonly visibility: HeroVisibility;
  readonly reviewStatus: HeroReviewStatus;
  readonly source: HeroAnalysisSource;
};

export type ArtworkExportRequest = {
  readonly artworkId: string;
  readonly artworkRevision: number;
  readonly width: number;
  readonly height: number;
};

export type PngExportRequest = ArtworkExportRequest;
export type ThumbnailExportRequest = ArtworkExportRequest;

export type ArtworkExportResult = ArtworkExportRequest & {
  readonly mimeType: "image/png";
  readonly bytes: Uint8Array;
};

export type PngExportResult = ArtworkExportResult;
export type ThumbnailExportResult = ArtworkExportResult;

/**
 * Port only: phase 1.1 does not provide a PNG encoder or a fake successful
 * implementation. Callers supply an adapter in a later client phase.
 */
export interface PngExportPort {
  exportPng(request: PngExportRequest): Promise<PngExportResult>;
}

export interface ThumbnailExportPort {
  exportThumbnail(request: ThumbnailExportRequest): Promise<ThumbnailExportResult>;
}

export interface DrawingExportPort extends PngExportPort, ThumbnailExportPort {}

export type VisualTagDefinition = {
  readonly id: VisualTagId;
  readonly label: string;
};

export type ValidationIssue = {
  readonly path: string;
  readonly code: string;
  readonly message: string;
};

export type ValidationResult<T> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly issues: readonly ValidationIssue[] };

function success<T>(data: T): ValidationResult<T> {
  return { success: true, data };
}

function failure<T>(issues: readonly ValidationIssue[]): ValidationResult<T> {
  return { success: false, issues };
}

function issue(path: string, code: string, message: string): ValidationIssue {
  return { path, code, message };
}

function isRecord(value: unknown): value is { readonly [key: string]: unknown } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isDenseArray(value: unknown): value is readonly unknown[] {
  if (!Array.isArray(value)) {
    return false;
  }
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) {
      return false;
    }
  }
  return true;
}

function hasOnlyKeys(value: { readonly [key: string]: unknown }, keys: readonly string[]): boolean {
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key));
}

function stringValue(
  value: unknown,
  path: string,
  maxLength: number,
  required = true
): ValidationIssue | undefined {
  if (value === undefined && !required) {
    return undefined;
  }
  if (typeof value !== "string") {
    return issue(path, "invalid_string", "Expected a string.");
  }
  if (value.length === 0) {
    return issue(path, "empty_string", "Value cannot be empty.");
  }
  if (value.length > maxLength) {
    return issue(path, "string_too_long", `Value exceeds ${maxLength} UTF-16 code units.`);
  }
  return undefined;
}

function finiteNumber(value: unknown, path: string): ValidationIssue | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? undefined
    : issue(path, "not_finite", "Expected a finite number.");
}

function integerInRange(
  value: unknown,
  path: string,
  minimum: number,
  maximum: number
): ValidationIssue | undefined {
  const finiteIssue = finiteNumber(value, path);
  if (finiteIssue) {
    return finiteIssue;
  }
  if (!Number.isInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    return issue(path, "out_of_range", `Expected an integer from ${minimum} through ${maximum}.`);
  }
  return undefined;
}

function validateArtworkId(value: unknown, path: string): ValidationIssue | undefined {
  const valueIssue = stringValue(value, path, DRAWING_LIMITS.maxIdLength);
  if (valueIssue) {
    return valueIssue;
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value as string)) {
    return issue(path, "invalid_id", "ID contains unsupported characters.");
  }
  return undefined;
}

function validateName(
  value: unknown,
  path: string,
  maxLength: number,
  optional: boolean
): ValidationIssue | undefined {
  const valueIssue = stringValue(value, path, maxLength, !optional);
  if (valueIssue || value === undefined) {
    return valueIssue;
  }
  if ((value as string).trim().length === 0) {
    return issue(path, "blank_string", "Value cannot contain only whitespace.");
  }
  return undefined;
}

function validateColor(value: unknown, path: string): ValidationIssue | undefined {
  const valueIssue = stringValue(value, path, 9);
  if (valueIssue) {
    return valueIssue;
  }
  return /^#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?$/.test(value as string)
    ? undefined
    : issue(path, "invalid_color", "Expected an RGB or RGBA hexadecimal color.");
}

export function validateDrawingPoint(input: unknown): ValidationResult<DrawingPoint> {
  if (!isRecord(input) || !hasOnlyKeys(input, ["x", "y"])) {
    return failure([issue("", "invalid_point", "Point must contain only x and y.")]);
  }
  const issues: ValidationIssue[] = [];
  const xIssue = finiteNumber(input.x, "x");
  const yIssue = finiteNumber(input.y, "y");
  if (xIssue) {
    issues.push(xIssue);
  } else if ((input.x as number) < 0 || (input.x as number) > DRAWING_CANVAS_WIDTH) {
    issues.push(issue("x", "out_of_bounds", "x must be inside the logical canvas."));
  }
  if (yIssue) {
    issues.push(yIssue);
  } else if ((input.y as number) < 0 || (input.y as number) > DRAWING_CANVAS_HEIGHT) {
    issues.push(issue("y", "out_of_bounds", "y must be inside the logical canvas."));
  }
  return issues.length > 0 ? failure(issues) : success(input as DrawingPoint);
}

export function validateDrawingStroke(input: unknown): ValidationResult<DrawingStroke> {
  if (!isRecord(input) || !hasOnlyKeys(input, ["id", "tool", "points", "width", "color"])) {
    return failure([issue("", "invalid_stroke", "Stroke contains unknown or missing fields.")]);
  }
  const issues: ValidationIssue[] = [];
  const idIssue = validateArtworkId(input.id, "id");
  if (idIssue) {
    issues.push(idIssue);
  }
  if (typeof input.tool !== "string" || !DRAWING_TOOLS.includes(input.tool as DrawingTool)) {
    issues.push(issue("tool", "invalid_tool", "Tool must be pencil, marker, or eraser."));
  }
  const widthIssue = finiteNumber(input.width, "width");
  if (widthIssue) {
    issues.push(widthIssue);
  } else if (
    (input.width as number) < DRAWING_LIMITS.minLineWidth ||
    (input.width as number) > DRAWING_LIMITS.maxLineWidth
  ) {
    issues.push(
      issue(
        "width",
        "out_of_range",
        `Line width must be from ${DRAWING_LIMITS.minLineWidth} through ${DRAWING_LIMITS.maxLineWidth}.`
      )
    );
  }
  if (!isDenseArray(input.points)) {
    issues.push(issue("points", "invalid_array", "Points must be a dense array."));
  } else if (input.points.length === 0) {
    issues.push(issue("points", "empty_points", "A stroke must contain at least one point."));
  } else if (input.points.length > DRAWING_LIMITS.maxPointsPerStroke) {
    issues.push(issue("points", "too_many_points", "Stroke exceeds its sampling-point limit."));
  } else {
    input.points.forEach((point, index) => {
      const pointResult = validateDrawingPoint(point);
      if (!pointResult.success) {
        pointResult.issues.forEach((pointIssue) => {
          issues.push({
            path: `points[${index}].${pointIssue.path}`.replace(/\.$/, ""),
            code: pointIssue.code,
            message: pointIssue.message
          });
        });
      }
    });
  }
  if (input.tool === "eraser") {
    if (Object.prototype.hasOwnProperty.call(input, "color")) {
      issues.push(issue("color", "eraser_color", "An eraser is not a white paint stroke."));
    }
  } else {
    const colorIssue = validateColor(input.color, "color");
    if (colorIssue) {
      issues.push(colorIssue);
    }
  }
  return issues.length > 0 ? failure(issues) : success(input as DrawingStroke);
}

export function validateDrawingDocument(input: unknown): ValidationResult<DrawingDocument> {
  if (!isRecord(input) || !hasOnlyKeys(input, ["width", "height", "strokes"])) {
    return failure([issue("", "invalid_document", "Drawing contains unknown or missing fields.")]);
  }
  const issues: ValidationIssue[] = [];
  if (input.width !== DRAWING_CANVAS_WIDTH) {
    issues.push(issue("width", "invalid_canvas", "Canvas width must be 1024 logical units."));
  }
  if (input.height !== DRAWING_CANVAS_HEIGHT) {
    issues.push(issue("height", "invalid_canvas", "Canvas height must be 1024 logical units."));
  }
  if (!isDenseArray(input.strokes)) {
    issues.push(issue("strokes", "invalid_array", "Strokes must be an array."));
  } else if (input.strokes.length > DRAWING_LIMITS.maxStrokes) {
    issues.push(issue("strokes", "too_many_strokes", "Drawing exceeds its stroke limit."));
  } else {
    let totalPoints = 0;
    const strokeIds = new Set<string>();
    input.strokes.forEach((stroke, index) => {
      const strokeResult = validateDrawingStroke(stroke);
      if (!strokeResult.success) {
        strokeResult.issues.forEach((strokeIssue) => {
          issues.push({
            path: `strokes[${index}].${strokeIssue.path}`.replace(/\.$/, ""),
            code: strokeIssue.code,
            message: strokeIssue.message
          });
        });
      } else {
        totalPoints += strokeResult.data.points.length;
        if (strokeIds.has(strokeResult.data.id)) {
          issues.push(
            issue(`strokes[${index}].id`, "duplicate_stroke_id", "Stroke IDs must be unique.")
          );
        }
        strokeIds.add(strokeResult.data.id);
      }
    });
    if (totalPoints > DRAWING_LIMITS.maxTotalPoints) {
      issues.push(
        issue("strokes", "too_many_points", "Drawing exceeds its total sampling-point limit.")
      );
    }
  }
  return issues.length > 0 ? failure(issues) : success(input as DrawingDocument);
}

export function validateDrawingDraft(input: unknown): ValidationResult<DrawingDraft> {
  if (
    !isRecord(input) ||
    !hasOnlyKeys(input, ["schemaVersion", "artworkId", "revision", "drawing"])
  ) {
    return failure([issue("", "invalid_draft", "Draft contains unknown or missing fields.")]);
  }
  const issues: ValidationIssue[] = [];
  if (input.schemaVersion !== DRAWING_SCHEMA_VERSION) {
    issues.push(
      issue(
        "schemaVersion",
        "unsupported_schema_version",
        `Only drawing schema version ${DRAWING_SCHEMA_VERSION} is supported.`
      )
    );
  }
  const artworkIssue = validateArtworkId(input.artworkId, "artworkId");
  if (artworkIssue) {
    issues.push(artworkIssue);
  }
  const revisionIssue = integerInRange(input.revision, "revision", 1, 2147483647);
  if (revisionIssue) {
    issues.push(revisionIssue);
  }
  const drawingResult = validateDrawingDocument(input.drawing);
  if (!drawingResult.success) {
    drawingResult.issues.forEach((drawingIssue) => {
      issues.push({
        path: `drawing.${drawingIssue.path}`.replace(/\.$/, ""),
        code: drawingIssue.code,
        message: drawingIssue.message
      });
    });
  }
  return issues.length > 0 ? failure(issues) : success(input as DrawingDraft);
}

export function serializeDrawingDraft(draft: DrawingDraft): string {
  const result = validateDrawingDraft(draft);
  if (!result.success) {
    throw new Error(
      `Cannot serialize DrawingDraft: ${result.issues.map((item) => item.message).join(" ")}`
    );
  }
  const serialized = JSON.stringify(result.data);
  if (serialized.length > DRAWING_LIMITS.maxSerializedInputLength) {
    throw new Error("Cannot serialize DrawingDraft: serialized input is too long.");
  }
  return serialized;
}

export function deserializeDrawingDraft(input: string): ValidationResult<DrawingDraft> {
  if (typeof input !== "string" || input.length > DRAWING_LIMITS.maxSerializedInputLength) {
    return failure([
      issue(
        "",
        "input_too_long",
        `Serialized input cannot exceed ${DRAWING_LIMITS.maxSerializedInputLength} UTF-16 code units.`
      )
    ]);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(input) as unknown;
  } catch {
    return failure([issue("", "invalid_json", "Input is not valid JSON.")]);
  }
  return validateDrawingDraft(parsed);
}

export function validateHeroAnalysisSuggestion(
  input: unknown
): ValidationResult<HeroAnalysisSuggestion> {
  if (
    !isRecord(input) ||
    !hasOnlyKeys(input, [
      "artworkId",
      "artworkRevision",
      "visualTagIds",
      "classCandidates",
      "elementCandidates",
      "skillCandidates",
      "suggestedName",
      "suggestedBackground",
      "source"
    ])
  ) {
    return failure([
      issue("", "invalid_suggestion", "Suggestion contains unknown or missing fields.")
    ]);
  }
  const issues: ValidationIssue[] = [];
  const artworkIssue = validateArtworkId(input.artworkId, "artworkId");
  if (artworkIssue) {
    issues.push(artworkIssue);
  }
  const revisionIssue = integerInRange(input.artworkRevision, "artworkRevision", 1, 2147483647);
  if (revisionIssue) {
    issues.push(revisionIssue);
  }
  if (
    !isDenseArray(input.visualTagIds) ||
    input.visualTagIds.length > DRAWING_LIMITS.maxVisualTags
  ) {
    issues.push(issue("visualTagIds", "invalid_candidate_list", "Visual tags exceed their limit."));
  } else {
    input.visualTagIds.forEach((tag, index) => {
      if (
        typeof tag !== "string" ||
        !/^tag\.[a-z0-9_.-]+$/.test(tag) ||
        tag.length > DRAWING_LIMITS.maxIdLength
      ) {
        issues.push(issue(`visualTagIds[${index}]`, "invalid_tag_id", "Invalid visual tag ID."));
      }
    });
  }
  if (
    !isDenseArray(input.classCandidates) ||
    input.classCandidates.length > DRAWING_LIMITS.maxClassCandidates ||
    input.classCandidates.some(
      (candidate) =>
        typeof candidate !== "string" ||
        candidate.length === 0 ||
        candidate.length > DRAWING_LIMITS.maxIdLength ||
        !/^[A-Za-z][A-Za-z0-9]*$/.test(candidate)
    )
  ) {
    issues.push(
      issue("classCandidates", "invalid_candidate_list", "Invalid class candidate list.")
    );
  }
  if (
    !isDenseArray(input.elementCandidates) ||
    input.elementCandidates.length > DRAWING_LIMITS.maxElementCandidates ||
    input.elementCandidates.some((candidate) => !HERO_ELEMENTS.includes(candidate as HeroElement))
  ) {
    issues.push(
      issue("elementCandidates", "invalid_candidate_list", "Invalid element candidate list.")
    );
  }
  if (
    !isDenseArray(input.skillCandidates) ||
    input.skillCandidates.length > DRAWING_LIMITS.maxSkillCandidates ||
    input.skillCandidates.some(
      (candidate) =>
        typeof candidate !== "string" ||
        !/^skill\.[a-z0-9_.-]+$/.test(candidate) ||
        candidate.length > DRAWING_LIMITS.maxIdLength
    )
  ) {
    issues.push(
      issue("skillCandidates", "invalid_candidate_list", "Invalid skill candidate list.")
    );
  }
  const nameIssue = validateName(
    input.suggestedName,
    "suggestedName",
    DRAWING_LIMITS.maxNameLength,
    true
  );
  if (nameIssue) {
    issues.push(nameIssue);
  }
  const backgroundIssue = validateName(
    input.suggestedBackground,
    "suggestedBackground",
    DRAWING_LIMITS.maxBackgroundLength,
    true
  );
  if (backgroundIssue) {
    issues.push(backgroundIssue);
  }
  if (input.source !== "mock" && input.source !== "manual") {
    issues.push(issue("source", "invalid_source", "Source must be mock or manual."));
  }
  return issues.length > 0 ? failure(issues) : success(input as HeroAnalysisSuggestion);
}

export function validateConfirmedHero(input: unknown): ValidationResult<ConfirmedHero> {
  if (
    !isRecord(input) ||
    !hasOnlyKeys(input, [
      "heroId",
      "artworkId",
      "artworkRevision",
      "visualTagIds",
      "heroClass",
      "element",
      "startingSkillId",
      "name",
      "background",
      "visibility",
      "reviewStatus",
      "source"
    ])
  ) {
    return failure([
      issue("", "invalid_confirmed_hero", "Confirmed hero contains unknown fields.")
    ]);
  }
  const issues: ValidationIssue[] = [];
  const heroIssue = validateArtworkId(input.heroId, "heroId");
  if (heroIssue) {
    issues.push(heroIssue);
  }
  const artworkIssue = validateArtworkId(input.artworkId, "artworkId");
  if (artworkIssue) {
    issues.push(artworkIssue);
  }
  const revisionIssue = integerInRange(input.artworkRevision, "artworkRevision", 1, 2147483647);
  if (revisionIssue) {
    issues.push(revisionIssue);
  }
  if (
    !isDenseArray(input.visualTagIds) ||
    input.visualTagIds.length > DRAWING_LIMITS.maxVisualTags
  ) {
    issues.push(issue("visualTagIds", "invalid_tag_list", "Invalid visual tag list."));
  } else {
    input.visualTagIds.forEach((tag, index) => {
      if (
        typeof tag !== "string" ||
        !/^tag\.[a-z0-9_.-]+$/.test(tag) ||
        tag.length > DRAWING_LIMITS.maxIdLength
      ) {
        issues.push(issue(`visualTagIds[${index}]`, "invalid_tag_id", "Invalid visual tag ID."));
      }
    });
  }
  if (!HERO_CLASSES.includes(input.heroClass as HeroClass)) {
    issues.push(issue("heroClass", "invalid_class", "Unknown hero class."));
  }
  if (!HERO_ELEMENTS.includes(input.element as HeroElement)) {
    issues.push(issue("element", "invalid_element", "Unknown hero element."));
  }
  if (
    typeof input.startingSkillId !== "string" ||
    !/^skill\.[a-z0-9_.-]+$/.test(input.startingSkillId) ||
    input.startingSkillId.length > DRAWING_LIMITS.maxIdLength
  ) {
    issues.push(issue("startingSkillId", "invalid_skill_id", "Invalid starting skill ID."));
  }
  const nameIssue = validateName(input.name, "name", DRAWING_LIMITS.maxNameLength, true);
  if (nameIssue) {
    issues.push(nameIssue);
  }
  const backgroundIssue = validateName(
    input.background,
    "background",
    DRAWING_LIMITS.maxBackgroundLength,
    true
  );
  if (backgroundIssue) {
    issues.push(backgroundIssue);
  }
  if (input.visibility !== "private") {
    issues.push(issue("visibility", "invalid_visibility", "New heroes must remain private."));
  }
  if (input.reviewStatus !== "unreviewed") {
    issues.push(issue("reviewStatus", "invalid_review_status", "New heroes are unreviewed."));
  }
  if (input.source !== "mock" && input.source !== "manual") {
    issues.push(issue("source", "invalid_source", "Source must be mock or manual."));
  }
  return issues.length > 0 ? failure(issues) : success(input as ConfirmedHero);
}

/**
 * Produces a branded visual tag ID only after checking its stable ID format.
 * The game-data business layer still has to check whether the ID is in the
 * finite shipped allowlist.
 */
export function asCreationVisualTagId(value: string): VisualTagId {
  return asVisualTagId(value);
}

/**
 * Produces a SkillId only after checking its format. A formatted ID is not
 * automatically an enabled starting skill; game-data performs that check.
 */
export function asCreationSkillId(value: string): SkillId {
  return asSkillId(value);
}
