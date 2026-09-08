export const ALL_HERO_CLASSES = [
  "Vanguard",
  "Shadowblade",
  "Spiritbow",
  "Mystic",
  "Oathkeeper"
] as const;

export type GameHeroClass = (typeof ALL_HERO_CLASSES)[number];

export const ENABLED_MVP_CLASSES = ["Vanguard", "Mystic"] as const;
export type EnabledMvpClass = (typeof ENABLED_MVP_CLASSES)[number];

export function isEnabledMvpClass(value: GameHeroClass): value is EnabledMvpClass {
  return value === "Vanguard" || value === "Mystic";
}
