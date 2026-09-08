import { describe, expect, it } from "vitest";
import { AuthProvider } from "../src/auth";

describe("platform adapter contracts", () => {
  it("includes phase 0 authentication provider names", () => {
    const providers: readonly AuthProvider[] = ["Guest", "Apple", "WeChat"];
    expect(providers).toHaveLength(3);
  });
});