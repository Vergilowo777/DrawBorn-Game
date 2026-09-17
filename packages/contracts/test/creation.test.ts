import { describe, expect, it } from "vitest";
import {
  DRAWING_CANVAS_HEIGHT,
  DRAWING_CANVAS_WIDTH,
  DRAWING_LIMITS,
  ConfirmedHero,
  DrawingDraft,
  HeroAnalysisSuggestion,
  deserializeDrawingDraft,
  serializeDrawingDraft,
  validateConfirmedHero,
  validateDrawingDocument,
  validateDrawingPoint,
  validateDrawingStroke,
  validateHeroAnalysisSuggestion
} from "../src";
import {
  confirmedHeroSchema,
  drawingDraftSchema,
  heroAnalysisSuggestionSchema
} from "../src/schemas";
import { confirmedHero, emptyDrawingDraft, mockSuggestion } from "./fixtures/creation";

const singlePointDraft: DrawingDraft = {
  ...emptyDrawingDraft,
  drawing: {
    width: DRAWING_CANVAS_WIDTH,
    height: DRAWING_CANVAS_HEIGHT,
    strokes: [
      {
        id: "stroke-1",
        tool: "pencil",
        points: [{ x: 0, y: DRAWING_CANVAS_HEIGHT }],
        width: 2,
        color: "#123456"
      }
    ]
  }
};

describe("creation drawing contracts", () => {
  it("round-trips a valid drawing draft without changing its data", () => {
    const restored = deserializeDrawingDraft(serializeDrawingDraft(singlePointDraft));

    expect(restored).toEqual({ success: true, data: singlePointDraft });
  });

  it("accepts an empty draft and a single-point stroke", () => {
    expect(validateDrawingDocument(emptyDrawingDraft.drawing).success).toBe(true);
    expect(validateDrawingDocument(singlePointDraft.drawing).success).toBe(true);
  });

  it("reports malformed JSON, unknown versions, and oversized serialized input", () => {
    expect(deserializeDrawingDraft("{not-json}")).toMatchObject({
      success: false,
      issues: [{ code: "invalid_json" }]
    });
    expect(
      deserializeDrawingDraft(JSON.stringify({ ...emptyDrawingDraft, schemaVersion: 99 }))
    ).toMatchObject({ success: false, issues: [{ code: "unsupported_schema_version" }] });
    expect(
      deserializeDrawingDraft("x".repeat(DRAWING_LIMITS.maxSerializedInputLength + 1))
    ).toMatchObject({ success: false, issues: [{ code: "input_too_long" }] });
  });

  it("rejects bad tools, colors, widths, coordinates, and non-finite values", () => {
    expect(
      validateDrawingStroke({
        id: "stroke-1",
        tool: "spray",
        points: [{ x: 1, y: 1 }],
        width: 2,
        color: "#123456"
      })
    ).toMatchObject({ success: false, issues: [{ code: "invalid_tool" }] });
    expect(
      validateDrawingStroke({
        id: "stroke-1",
        tool: "pencil",
        points: [{ x: 1, y: 1 }],
        width: 2,
        color: "white"
      })
    ).toMatchObject({ success: false, issues: [{ code: "invalid_color" }] });
    expect(
      validateDrawingStroke({
        id: "stroke-1",
        tool: "eraser",
        points: [{ x: 1, y: 1 }],
        width: 2,
        color: "#ffffff"
      })
    ).toMatchObject({ success: false, issues: [{ code: "eraser_color" }] });
    expect(
      validateDrawingStroke({
        id: "stroke-1",
        tool: "marker",
        points: [{ x: 1, y: 1 }],
        width: DRAWING_LIMITS.maxLineWidth + 1,
        color: "#123456"
      })
    ).toMatchObject({ success: false, issues: [{ code: "out_of_range" }] });
    expect(validateDrawingPoint({ x: -1, y: 1 })).toMatchObject({
      success: false,
      issues: [{ code: "out_of_bounds" }]
    });
    const nonFinitePoint = validateDrawingPoint({
      x: Number.NaN,
      y: Number.POSITIVE_INFINITY
    });
    expect(nonFinitePoint.success).toBe(false);
    if (!nonFinitePoint.success) {
      expect(nonFinitePoint.issues.every((item) => item.code === "not_finite")).toBe(true);
    }
  });

  it("rejects empty strokes, duplicate IDs, and point-count limits", () => {
    expect(
      validateDrawingStroke({
        id: "stroke-1",
        tool: "pencil",
        points: [],
        width: 2,
        color: "#123456"
      })
    ).toMatchObject({ success: false, issues: [{ code: "empty_points" }] });
    expect(
      validateDrawingDocument({
        width: DRAWING_CANVAS_WIDTH,
        height: DRAWING_CANVAS_HEIGHT,
        strokes: [singlePointDraft.drawing.strokes[0], { ...singlePointDraft.drawing.strokes[0] }]
      })
    ).toMatchObject({ success: false, issues: [{ code: "duplicate_stroke_id" }] });

    const oversizedStrokes = Array.from({ length: 17 }, (_, strokeIndex) => ({
      id: `stroke-${strokeIndex}`,
      tool: "pencil" as const,
      points: Array.from({ length: DRAWING_LIMITS.maxPointsPerStroke }, () => ({
        x: 1,
        y: 1
      })),
      width: 2,
      color: "#123456"
    }));
    expect(
      validateDrawingDocument({
        width: DRAWING_CANVAS_WIDTH,
        height: DRAWING_CANVAS_HEIGHT,
        strokes: oversizedStrokes
      })
    ).toMatchObject({ success: false, issues: [{ code: "too_many_points" }] });
  });

  it("rejects sparse arrays instead of silently skipping samples", () => {
    const sparsePoints: Array<{ x: number; y: number }> = [];
    sparsePoints.length = 1;
    expect(
      validateDrawingStroke({
        id: "stroke-sparse",
        tool: "pencil",
        points: sparsePoints,
        width: 2,
        color: "#123456"
      })
    ).toMatchObject({ success: false, issues: [{ code: "invalid_array" }] });
  });

  it("rejects unknown fields at every creation boundary", () => {
    expect(validateDrawingDocument({ ...emptyDrawingDraft.drawing, debug: true })).toMatchObject({
      success: false,
      issues: [{ code: "invalid_document" }]
    });
    expect(validateConfirmedHero({ ...confirmedHero, attack: 999 })).toMatchObject({
      success: false,
      issues: [{ code: "invalid_confirmed_hero" }]
    });
    expect(
      validateHeroAnalysisSuggestion({ ...mockSuggestion, generatedBy: "real-ai" })
    ).toMatchObject({ success: false, issues: [{ code: "invalid_suggestion" }] });
  });

  it("keeps schema output assignable to domain types", () => {
    const draftFromSchema: DrawingDraft = drawingDraftSchema.parse(singlePointDraft);
    const suggestionFromSchema: HeroAnalysisSuggestion =
      heroAnalysisSuggestionSchema.parse(mockSuggestion);
    const heroFromSchema: ConfirmedHero = confirmedHeroSchema.parse(confirmedHero);

    expect(draftFromSchema.drawing.strokes).toHaveLength(1);
    expect(suggestionFromSchema.source).toBe("mock");
    expect(heroFromSchema.reviewStatus).toBe("unreviewed");
  });

  it("uses strict zod schemas for eraser boundaries too", () => {
    expect(
      drawingDraftSchema.safeParse({
        ...singlePointDraft,
        drawing: {
          ...singlePointDraft.drawing,
          strokes: [{ ...singlePointDraft.drawing.strokes[0], color: "#ffffff", tool: "eraser" }]
        }
      }).success
    ).toBe(false);
  });

  it("keeps schema and pure text constraints aligned", () => {
    expect(
      heroAnalysisSuggestionSchema.safeParse({
        ...mockSuggestion,
        suggestedName: "   "
      }).success
    ).toBe(false);
    expect(confirmedHeroSchema.safeParse({ ...confirmedHero, approved: true }).success).toBe(false);
  });

  it("applies the shared ID length limit to skill candidates", () => {
    const oversizedSkill = `skill.${"x".repeat(DRAWING_LIMITS.maxIdLength)}`;
    expect(
      validateHeroAnalysisSuggestion({
        ...mockSuggestion,
        skillCandidates: [oversizedSkill]
      }).success
    ).toBe(false);
    expect(
      heroAnalysisSuggestionSchema.safeParse({
        ...mockSuggestion,
        skillCandidates: [oversizedSkill]
      }).success
    ).toBe(false);
    expect(
      confirmedHeroSchema.safeParse({
        ...confirmedHero,
        startingSkillId: oversizedSkill
      }).success
    ).toBe(false);
  });
});
