export type GameVisualTagId = `tag.${string}`;
export type VisualTagDefinition = {
  readonly id: GameVisualTagId;
  readonly label: string;
};

export const VISUAL_TAGS: readonly VisualTagDefinition[] = [
  { id: "tag.weapon.sword", label: "Sword" },
  { id: "tag.weapon.bow", label: "Bow" },
  { id: "tag.weapon.staff", label: "Staff" },
  { id: "tag.defense.shield", label: "Shield" },
  { id: "tag.defense.armor", label: "Armor" },
  { id: "tag.face.mask", label: "Mask" },
  { id: "tag.element.flame", label: "Flame" },
  { id: "tag.element.frost", label: "Frost" },
  { id: "tag.element.spark", label: "Lightning" },
  { id: "tag.element.leaf", label: "Nature" }
] as const;

export const VISUAL_TAG_IDS = VISUAL_TAGS.map((tag) => tag.id) as readonly GameVisualTagId[];

export function isKnownVisualTag(value: string): value is GameVisualTagId {
  return VISUAL_TAG_IDS.indexOf(value as GameVisualTagId) !== -1;
}
