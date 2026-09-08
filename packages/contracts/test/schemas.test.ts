import { describe, expect, it } from "vitest";
import { BattleSnapshot } from "../src/battle";
import {
  battleSeedSchema,
  battleSnapshotSchema,
  heroClassSchema,
  skillIdSchema
} from "../src/schemas";

const validFighter = {
  heroId: "hero-1",
  heroClass: "Vanguard",
  element: "Fire",
  level: 1,
  health: 100,
  attack: 20,
  defense: 10,
  speed: 8,
  energyEfficiency: 1,
  skillIds: ["skill.vanguard.strike"],
  equipmentIds: ["equipment.training.blade"]
};

const validFixture = {
  version: 1,
  seed: "battle_seed_0001",
  attacker: validFighter,
  defender: {
    ...validFighter,
    heroId: "hero-2",
    heroClass: "Mystic"
  }
};

describe("contract schemas", () => {
  it("accepts all planned stable classes", () => {
    expect(heroClassSchema.parse("Vanguard")).toBe("Vanguard");
    expect(heroClassSchema.parse("Shadowblade")).toBe("Shadowblade");
    expect(heroClassSchema.parse("Spiritbow")).toBe("Spiritbow");
    expect(heroClassSchema.parse("Mystic")).toBe("Mystic");
    expect(heroClassSchema.parse("Oathkeeper")).toBe("Oathkeeper");
  });

  it("parses a complete BattleSnapshot into the domain type", () => {
    const parsed: BattleSnapshot = battleSnapshotSchema.parse(validFixture);

    expect(parsed.seed).toBe("battle_seed_0001");
    expect(parsed.attacker.skillIds).toEqual(["skill.vanguard.strike"]);
    expect(parsed.attacker.equipmentIds).toEqual(["equipment.training.blade"]);
  });

  it("rejects an invalid battle seed", () => {
    expect(battleSeedSchema.safeParse("short").success).toBe(false);
    expect(
      battleSnapshotSchema.safeParse({ ...validFixture, seed: "contains spaces" }).success
    ).toBe(false);
  });

  it("rejects an invalid skill ID", () => {
    expect(skillIdSchema.safeParse("free generated skill").success).toBe(false);
    expect(
      battleSnapshotSchema.safeParse({
        ...validFixture,
        attacker: { ...validFighter, skillIds: ["generated.skill"] }
      }).success
    ).toBe(false);
  });

  it("rejects an invalid equipment ID", () => {
    expect(
      battleSnapshotSchema.safeParse({
        ...validFixture,
        attacker: { ...validFighter, equipmentIds: ["unknown-equipment"] }
      }).success
    ).toBe(false);
  });

  it("rejects an unknown class", () => {
    expect(
      battleSnapshotSchema.safeParse({
        ...validFixture,
        attacker: { ...validFighter, heroClass: "UnknownClass" }
      }).success
    ).toBe(false);
  });

  it.each([
    ["level", 0],
    ["health", -1],
    ["attack", 0],
    ["defense", 0],
    ["speed", 0],
    ["energyEfficiency", 0]
  ])("rejects invalid %s", (field, value) => {
    expect(
      battleSnapshotSchema.safeParse({
        ...validFixture,
        attacker: { ...validFighter, [field]: value }
      }).success
    ).toBe(false);
  });
});
