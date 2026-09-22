import { describe, expect, it } from "vitest";
import { EquipmentId, HERO_CLASSES, SkillId } from "@drawborn/contracts";
import {
  ALL_HERO_CLASSES,
  ENABLED_MVP_CLASSES,
  EQUIPMENT_IDS,
  isEnabledMvpClass,
  SKILL_IDS,
  STARTING_SKILL_DEFINITIONS,
  VISUAL_TAGS,
  VISUAL_TAG_IDS
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

  it("defines exactly six unique starting skills and three for each enabled class", () => {
    const ids = STARTING_SKILL_DEFINITIONS.map((skill) => skill.id);

    expect(new Set(ids).size).toBe(6);
    expect(
      STARTING_SKILL_DEFINITIONS.filter((skill) => skill.heroClass === "Vanguard")
    ).toHaveLength(3);
    expect(STARTING_SKILL_DEFINITIONS.filter((skill) => skill.heroClass === "Mystic")).toHaveLength(
      3
    );
    expect(ids).toContain(SKILL_IDS.VANGUARD_STRIKE);
    expect(ids).toContain(SKILL_IDS.MYSTIC_BURST);
  });

  it("keeps visual tag IDs finite and labels separate", () => {
    expect(VISUAL_TAGS.length).toBeGreaterThan(0);
    expect(new Set(VISUAL_TAG_IDS).size).toBe(VISUAL_TAG_IDS.length);
    expect(VISUAL_TAGS.every((tag) => tag.id.startsWith("tag."))).toBe(true);
    expect(VISUAL_TAGS.every((tag) => tag.label.length > 0)).toBe(true);
  });
});
