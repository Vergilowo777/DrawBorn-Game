import { z } from "zod";
import { HERO_CLASSES, HERO_ELEMENTS } from "./enums";
import { asBattleSeed, asEquipmentId, asSkillId, BattleSeed, EquipmentId, SkillId } from "./ids";

export const heroClassSchema = z.enum(HERO_CLASSES);
export const heroElementSchema = z.enum(HERO_ELEMENTS);

export const skillIdSchema = z
  .string()
  .regex(/^skill\.[a-z0-9_.-]+$/)
  .transform<SkillId>(asSkillId);
export const equipmentIdSchema = z
  .string()
  .regex(/^equipment\.[a-z0-9_.-]+$/)
  .transform<EquipmentId>(asEquipmentId);
export const battleSeedSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{16,128}$/)
  .transform<BattleSeed>(asBattleSeed);

export const battleFighterSnapshotSchema = z.object({
  heroId: z.string().min(1),
  heroClass: heroClassSchema,
  element: heroElementSchema,
  level: z.number().int().positive(),
  health: z.number().positive(),
  attack: z.number().positive(),
  defense: z.number().positive(),
  speed: z.number().positive(),
  energyEfficiency: z.number().positive(),
  skillIds: z.array(skillIdSchema),
  equipmentIds: z.array(equipmentIdSchema)
});

export const battleSnapshotSchema = z.object({
  version: z.number().int().positive(),
  seed: battleSeedSchema,
  attacker: battleFighterSnapshotSchema,
  defender: battleFighterSnapshotSchema
});
