import type { EnabledMvpClass } from "./classes";

type SkillId = `skill.${string}`;

export const SKILL_IDS = {
  VANGUARD_STRIKE: "skill.vanguard.strike",
  VANGUARD_GUARD: "skill.vanguard.guard",
  VANGUARD_RUSH: "skill.vanguard.rush",
  MYSTIC_BURST: "skill.mystic.burst",
  MYSTIC_FROSTFIELD: "skill.mystic.frostfield",
  MYSTIC_THUNDERSEAL: "skill.mystic.thunderseal"
} as const;

export type StartingSkillDefinition = {
  readonly id: SkillId;
  readonly heroClass: EnabledMvpClass;
  readonly name: string;
  readonly description: string;
};

export const STARTING_SKILL_DEFINITIONS: readonly StartingSkillDefinition[] = [
  {
    id: SKILL_IDS.VANGUARD_STRIKE,
    heroClass: "Vanguard",
    name: "Strike",
    description: "A dependable close-range opening."
  },
  {
    id: SKILL_IDS.VANGUARD_GUARD,
    heroClass: "Vanguard",
    name: "Guard",
    description: "A measured defensive stance."
  },
  {
    id: SKILL_IDS.VANGUARD_RUSH,
    heroClass: "Vanguard",
    name: "Rush",
    description: "A committed advance toward the foe."
  },
  {
    id: SKILL_IDS.MYSTIC_BURST,
    heroClass: "Mystic",
    name: "Burst",
    description: "A focused release of elemental energy."
  },
  {
    id: SKILL_IDS.MYSTIC_FROSTFIELD,
    heroClass: "Mystic",
    name: "Frostfield",
    description: "A spell that marks an area with frost."
  },
  {
    id: SKILL_IDS.MYSTIC_THUNDERSEAL,
    heroClass: "Mystic",
    name: "Thunderseal",
    description: "A precise sigil of crackling energy."
  }
] as const;

export const STARTING_SKILLS_BY_CLASS: Readonly<Record<EnabledMvpClass, readonly SkillId[]>> = {
  Vanguard: [SKILL_IDS.VANGUARD_STRIKE, SKILL_IDS.VANGUARD_GUARD, SKILL_IDS.VANGUARD_RUSH],
  Mystic: [SKILL_IDS.MYSTIC_BURST, SKILL_IDS.MYSTIC_FROSTFIELD, SKILL_IDS.MYSTIC_THUNDERSEAL]
};

export function getStartingSkillDefinition(skillId: string): StartingSkillDefinition | undefined {
  return STARTING_SKILL_DEFINITIONS.find((skill) => skill.id === skillId);
}

export function isKnownStartingSkill(skillId: string): skillId is SkillId {
  return getStartingSkillDefinition(skillId) !== undefined;
}
