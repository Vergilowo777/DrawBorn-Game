import { describe, expect, it } from "vitest";
import {
  ALL_HERO_CLASSES,
  ENABLED_MVP_CLASSES,
  isEnabledMvpClass
} from "../src/classes";

describe("MVP class allowlist", () => {
  it("keeps five stable IDs but enables only Vanguard and Mystic", () => {
    expect(ALL_HERO_CLASSES).toHaveLength(5);
    expect(ENABLED_MVP_CLASSES).toEqual(["Vanguard", "Mystic"]);
    expect(isEnabledMvpClass("Vanguard")).toBe(true);
    expect(isEnabledMvpClass("Mystic")).toBe(true);
    expect(isEnabledMvpClass("Shadowblade")).toBe(false);
  });
});