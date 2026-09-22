import {
  DRAWING_CANVAS_HEIGHT,
  DRAWING_CANVAS_WIDTH,
  DRAWING_SCHEMA_VERSION,
  DrawingDraft,
  HeroAnalysisSuggestion,
  ConfirmedHero,
  asCreationSkillId,
  asCreationVisualTagId
} from "../../src";

export const emptyDrawingDraft: DrawingDraft = {
  schemaVersion: DRAWING_SCHEMA_VERSION,
  artworkId: "artwork-fixture",
  revision: 1,
  drawing: {
    width: DRAWING_CANVAS_WIDTH,
    height: DRAWING_CANVAS_HEIGHT,
    strokes: []
  }
};

export const mockSuggestion: HeroAnalysisSuggestion = {
  artworkId: "artwork-fixture",
  artworkRevision: 1,
  visualTagIds: [asCreationVisualTagId("tag.weapon.sword")],
  classCandidates: ["Vanguard", "Mystic"],
  elementCandidates: ["Fire", "Ice"],
  skillCandidates: [
    asCreationSkillId("skill.vanguard.strike"),
    asCreationSkillId("skill.vanguard.guard"),
    asCreationSkillId("skill.vanguard.rush")
  ],
  suggestedName: "Ink Knight",
  suggestedBackground: "A patient guardian drawn from a single line.",
  source: "mock"
};

export const confirmedHero: ConfirmedHero = {
  heroId: "hero-fixture",
  artworkId: "artwork-fixture",
  artworkRevision: 1,
  visualTagIds: [asCreationVisualTagId("tag.weapon.sword")],
  heroClass: "Vanguard",
  element: "Fire",
  startingSkillId: asCreationSkillId("skill.vanguard.strike"),
  name: "Ink Knight",
  background: "A patient guardian drawn from a single line.",
  visibility: "private",
  reviewStatus: "unreviewed",
  source: "mock"
};
