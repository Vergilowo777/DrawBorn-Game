import { describe, expect, it } from "vitest";
import {
  DRAWING_CANVAS_HEIGHT,
  DRAWING_CANVAS_WIDTH,
  DRAWING_SCHEMA_VERSION,
  asCreationSkillId,
  asCreationVisualTagId
} from "../../apps/game-client/assets/shared/contracts/index";
import type {
  ConfirmedHero,
  DrawingDraft,
  HeroAnalysisSuggestion
} from "../../apps/game-client/assets/shared/contracts/index";
import {
  CREATION_SELECTION_REQUIREMENTS,
  filterHeroAnalysisSuggestion,
  validateConfirmedHeroForCreation
} from "../../apps/game-client/assets/scripts/creation/domain/creation-validation";

const emptyDraft: DrawingDraft = {
  schemaVersion: DRAWING_SCHEMA_VERSION,
  artworkId: "artwork-client-test",
  revision: 1,
  drawing: {
    width: DRAWING_CANVAS_WIDTH,
    height: DRAWING_CANVAS_HEIGHT,
    strokes: []
  }
};

const drawableDraft: DrawingDraft = {
  ...emptyDraft,
  drawing: {
    ...emptyDraft.drawing,
    strokes: [
      {
        id: "stroke-client-test",
        tool: "pencil",
        points: [{ x: 10, y: DRAWING_CANVAS_HEIGHT - 10 }],
        width: 2,
        color: "#123456"
      }
    ]
  }
};

const confirmedHero: ConfirmedHero = {
  heroId: "hero-client-test",
  artworkId: emptyDraft.artworkId,
  artworkRevision: emptyDraft.revision,
  visualTagIds: [asCreationVisualTagId("tag.weapon.sword")],
  heroClass: "Vanguard",
  element: "Fire",
  startingSkillId: asCreationSkillId("skill.vanguard.strike"),
  visibility: "private",
  reviewStatus: "unreviewed",
  source: "mock"
};

const suggestion: HeroAnalysisSuggestion = {
  artworkId: emptyDraft.artworkId,
  artworkRevision: emptyDraft.revision,
  visualTagIds: [asCreationVisualTagId("tag.weapon.sword")],
  classCandidates: ["Vanguard", "Mystic"],
  elementCandidates: ["Fire", "Ice"],
  skillCandidates: [
    asCreationSkillId("skill.vanguard.strike"),
    asCreationSkillId("skill.vanguard.guard"),
    asCreationSkillId("skill.vanguard.rush")
  ],
  source: "mock"
};

describe("asset-local creation domain", () => {
  it("requires a validated, matching, non-empty drawing before confirmation", () => {
    expect(validateConfirmedHeroForCreation(confirmedHero, drawableDraft)).toMatchObject({
      success: true
    });
    expect(validateConfirmedHeroForCreation(confirmedHero, undefined)).toMatchObject({
      success: false,
      issues: [{ code: "draft_required" }]
    });
    expect(validateConfirmedHeroForCreation(confirmedHero, emptyDraft)).toMatchObject({
      success: false,
      issues: [{ code: "empty_drawing" }]
    });
  });

  it("rejects eraser-only drawings and artwork identity/revision mismatches", () => {
    const eraserOnlyDraft: DrawingDraft = {
      ...emptyDraft,
      drawing: {
        ...emptyDraft.drawing,
        strokes: [
          {
            id: "eraser-client-test",
            tool: "eraser",
            points: [{ x: 1, y: 1 }],
            width: 2
          }
        ]
      }
    };
    expect(validateConfirmedHeroForCreation(confirmedHero, eraserOnlyDraft)).toMatchObject({
      success: false,
      issues: [{ code: "empty_drawing" }]
    });
    expect(
      validateConfirmedHeroForCreation(confirmedHero, {
        ...drawableDraft,
        artworkId: "other-artwork",
        revision: 2
      })
    ).toMatchObject({
      success: false,
      issues: [{ code: "artwork_mismatch" }, { code: "revision_mismatch" }]
    });
  });

  it("requires the documented two-class and three-skill candidate minimums", () => {
    expect(CREATION_SELECTION_REQUIREMENTS).toEqual({
      minClassCandidates: 2,
      minElementCandidates: 1,
      minSkillCandidates: 3
    });
    const oneClass = filterHeroAnalysisSuggestion({
      ...suggestion,
      classCandidates: ["Vanguard"]
    });
    expect(oneClass.selectionStatus).toBe("needs_manual_selection");
    expect(oneClass.classes.accepted).toEqual(["Vanguard"]);
    expect(oneClass.skills.accepted).toHaveLength(3);

    const twoClasses = filterHeroAnalysisSuggestion({
      ...suggestion,
      skillCandidates: [asCreationSkillId("skill.vanguard.strike")]
    });
    expect(twoClasses.selectionStatus).toBe("needs_manual_selection");
    expect(twoClasses.skills.accepted).toHaveLength(1);
  });

  it("reports unknown, closed, duplicate, and cross-class candidates", () => {
    const result = filterHeroAnalysisSuggestion({
      ...suggestion,
      visualTagIds: ["tag.weapon.sword", "tag.not-shipped"],
      classCandidates: ["Shadowblade", "Vanguard", "Vanguard"],
      skillCandidates: [
        asCreationSkillId("skill.vanguard.strike"),
        asCreationSkillId("skill.vanguard.strike"),
        asCreationSkillId("skill.mystic.burst")
      ]
    });

    expect(result.classes.rejected).toEqual([
      { candidate: "Shadowblade", reason: "class_not_enabled" },
      { candidate: "Vanguard", reason: "duplicate_candidate" }
    ]);
    expect(result.visualTags.rejected).toEqual([
      { candidate: "tag.not-shipped", reason: "unknown_visual_tag" }
    ]);
    expect(result.skills.rejected).toEqual([
      { candidate: "skill.vanguard.strike", reason: "duplicate_candidate" },
      { candidate: "skill.mystic.burst", reason: "skill_class_mismatch" }
    ]);

    const unknown = filterHeroAnalysisSuggestion({
      ...suggestion,
      classCandidates: ["RuneKnight"],
      skillCandidates: ["skill.unknown"]
    });
    expect(unknown.classes.rejected).toEqual([
      { candidate: "RuneKnight", reason: "unknown_class" }
    ]);
    expect(unknown.skills.rejected).toEqual([
      { candidate: "skill.unknown", reason: "unknown_skill" }
    ]);
    expect(unknown.message).toBe("需要手选");
  });

  it("revalidates final class, skill, tag, and unknown-field boundaries", () => {
    expect(
      validateConfirmedHeroForCreation(
        { ...confirmedHero, startingSkillId: "skill.mystic.burst" },
        drawableDraft
      )
    ).toMatchObject({
      success: false,
      issues: [{ code: "skill_class_mismatch" }]
    });
    expect(
      validateConfirmedHeroForCreation(
        { ...confirmedHero, visualTagIds: ["tag.not-shipped"] },
        drawableDraft
      )
    ).toMatchObject({
      success: false,
      issues: [{ code: "unknown_visual_tag" }]
    });
    expect(
      validateConfirmedHeroForCreation(
        { ...confirmedHero, health: 100, reviewStatus: "approved" },
        drawableDraft
      )
    ).toMatchObject({
      success: false,
      issues: [{ code: "invalid_confirmed_hero" }]
    });
  });

  it("keeps candidate filtering on the asset-local shared mirror", () => {
    const result = filterHeroAnalysisSuggestion(suggestion);

    expect(result.schemaValid).toBe(true);
    expect(result.message).toBe("可继续");
  });
});
