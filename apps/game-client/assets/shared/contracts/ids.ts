declare const battleSeedBrand: unique symbol;

export type SkillId = `skill.${string}`;
export type EquipmentId = `equipment.${string}`;
export type BattleSeed = string & { readonly [battleSeedBrand]: "BattleSeed" };

export function asSkillId(value: string): SkillId {
  if (!/^skill\.[a-z0-9_.-]+$/.test(value)) {
    throw new Error("Invalid SkillId");
  }
  return value as SkillId;
}

export function asEquipmentId(value: string): EquipmentId {
  if (!/^equipment\.[a-z0-9_.-]+$/.test(value)) {
    throw new Error("Invalid EquipmentId");
  }
  return value as EquipmentId;
}

export function asBattleSeed(value: string): BattleSeed {
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(value)) {
    throw new Error("Invalid BattleSeed");
  }
  return value as BattleSeed;
}
