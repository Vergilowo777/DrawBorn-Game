import { describe, expect, it } from "vitest";
import { DRAWING_CANVAS_WIDTH } from "../../apps/game-client/assets/shared/contracts/index";
import {
  getStartingSkillDefinition,
  isKnownVisualTag
} from "../../apps/game-client/assets/shared/game-data/index";

describe("asset-local shared mirror imports", () => {
  it("resolves contracts and game-data through assets/shared", () => {
    expect(DRAWING_CANVAS_WIDTH).toBe(1024);
    expect(getStartingSkillDefinition("skill.vanguard.strike")?.heroClass).toBe("Vanguard");
    expect(isKnownVisualTag("tag.weapon.sword")).toBe(true);
  });
});
