export const HERO_CLASSES = ["Vanguard", "Shadowblade", "Spiritbow", "Mystic", "Oathkeeper"] as const;
export type HeroClass = (typeof HERO_CLASSES)[number];

export const HERO_ELEMENTS = ["Fire", "Ice", "Lightning", "Nature"] as const;
export type HeroElement = (typeof HERO_ELEMENTS)[number];