import { describe, expect, it } from "vitest";
import { BATTLE_CORE_COMPATIBILITY } from "../src";

describe("battle-core phase 0 skeleton", () => {
  it("declares deterministic zero-dependency boundaries", () => {
    expect(BATTLE_CORE_COMPATIBILITY).toEqual({
      deterministic: true,
      runtimeDependencies: 0
    });
  });
});
