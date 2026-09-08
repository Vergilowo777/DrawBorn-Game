import { BattleSeed, EquipmentId, SkillId } from "./ids";
import { HeroClass, HeroElement } from "./enums";

export interface BattleFighterSnapshot {
  readonly heroId: string;
  readonly heroClass: HeroClass;
  readonly element: HeroElement;
  readonly level: number;
  readonly health: number;
  readonly attack: number;
  readonly defense: number;
  readonly speed: number;
  readonly energyEfficiency: number;
  readonly skillIds: readonly SkillId[];
  readonly equipmentIds: readonly EquipmentId[];
}

export interface BattleSnapshot {
  readonly version: number;
  readonly seed: BattleSeed;
  readonly attacker: BattleFighterSnapshot;
  readonly defender: BattleFighterSnapshot;
}