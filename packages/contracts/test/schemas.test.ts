import { describe, expect, it } from "vitest";
import { battleSeedSchema, heroClassSchema, skillIdSchema } from "../src/schemas";

describe("contract schemas", () => {
  it("accepts all planned stable classes", () => {
    expect(heroClassSchema.parse("Vanguard")).toBe("Vanguard");
    expect(heroClassSchema.parse("Shadowblade")).toBe("Shadowblade");
    expect(heroClassSchema.parse("Spiritbow")).toBe("Spiritbow");
    expect(heroClassSchema.parse("Mystic")).toBe("Mystic");
    expect(heroClassSchema.parse("Oathkeeper")).toBe("Oathkeeper");
  });

  it("rejects unknown skill IDs", () => {
    expect(skillIdSchema.safeParse("free generated skill").success).toBe(false);
  });

  it("requires a non-empty battle seed", () => {
    expect(battleSeedSchema.safeParse("").success).toBe(false);
  });
});