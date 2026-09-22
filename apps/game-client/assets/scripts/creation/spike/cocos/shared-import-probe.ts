import { DRAWING_CANVAS_HEIGHT, DRAWING_CANVAS_WIDTH } from "../../../../shared/contracts/index";
import { ALL_HERO_CLASSES } from "../../../../shared/game-data/classes";
import { STARTING_SKILL_DEFINITIONS } from "../../../../shared/game-data/skills";
import { VISUAL_TAGS } from "../../../../shared/game-data/visual-tags";

export type SharedImportProbe = {
  readonly contractsLoaded: boolean;
  readonly gameDataLoaded: boolean;
  readonly logicalWidth: number;
  readonly logicalHeight: number;
  readonly classCount: number;
  readonly visualTagCount: number;
  readonly startingSkillCount: number;
};

/**
 * Runtime probe: values are read from the mirrored modules, not duplicated
 * here. This is intentionally a diagnostic and not a replacement for editor
 * validation.
 */
export function readSharedImportProbe(): SharedImportProbe {
  return {
    contractsLoaded: DRAWING_CANVAS_WIDTH === 1024 && DRAWING_CANVAS_HEIGHT === 1024,
    gameDataLoaded:
      ALL_HERO_CLASSES.length > 0 &&
      VISUAL_TAGS.length > 0 &&
      STARTING_SKILL_DEFINITIONS.length > 0,
    logicalWidth: DRAWING_CANVAS_WIDTH,
    logicalHeight: DRAWING_CANVAS_HEIGHT,
    classCount: ALL_HERO_CLASSES.length,
    visualTagCount: VISUAL_TAGS.length,
    startingSkillCount: STARTING_SKILL_DEFINITIONS.length
  };
}
