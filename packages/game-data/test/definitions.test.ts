import { describe, expect, it } from "vitest";
import { EquipmentId, HERO_CLASSES, SkillId } from "@drawborn/contracts";
import {
  ALL_HERO_CLASSES,
  ENABLED_MVP_CLASSES,
  EQUIPMENT_IDS,
  isEnabledMvpClass,
  SKILL_IDS
} from "../src";

describe("MVP class allowlist", () => {
  it("keeps five stable IDs but enables only Vanguard and Mystic", () => {
    expect(ALL_HERO_CLASSES).toHaveLength(5);
    expect(ENABLED_MVP_CLASSES).toEqual(["Vanguard", "Mystic"]);
    expect(isEnabledMvpClass("Vanguard")).toBe(true);
    expect(isEnabledMvpClass("Mystic")).toBe(true);
    expect(isEnabledMvpClass("Shadowblade")).toBe(false);
  });

  it("keeps contracts and game-data class definitions identical", () => {
    expect(ALL_HERO_CLASSES).toEqual(HERO_CLASSES);
  });

  it("exposes static IDs assignable to domain ID types", () => {
    const skillId: SkillId = SKILL_IDS.VANGUARD_STRIKE;
    const equipmentId: EquipmentId = EQUIPMENT_IDS.TRAINING_BLADE;

    expect(skillId).toBe("skill.vanguard.strike");
    expect(equipmentId).toBe("equipment.training.blade");
  });
});
