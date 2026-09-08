declare const skillIdBrand: unique symbol;
declare const equipmentIdBrand: unique symbol;
declare const battleSeedBrand: unique symbol;

export type SkillId = string & { readonly [skillIdBrand]: "SkillId" };
export type EquipmentId = string & { readonly [equipmentIdBrand]: "EquipmentId" };
export type BattleSeed = string & { readonly [battleSeedBrand]: "BattleSeed" };

export function asSkillId(value: string): SkillId {
  return value as SkillId;
}

export function asEquipmentId(value: string): EquipmentId {
  return value as EquipmentId;
}

export function asBattleSeed(value: string): BattleSeed {
  return value as BattleSeed;
}