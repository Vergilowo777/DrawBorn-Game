import {
  validateConfirmedHero,
  validateDrawingDraft,
  validateHeroAnalysisSuggestion
} from "../../../shared/contracts/index";
import type {
  ConfirmedHero,
  DrawingDraft,
  HeroAnalysisSuggestion,
  HeroClass,
  HeroElement,
  SkillId,
  ValidationIssue,
  ValidationResult
} from "../../../shared/contracts/index";
import {
  ALL_HERO_CLASSES,
  getStartingSkillDefinition,
  isEnabledMvpClass,
  isKnownStartingSkill,
  isKnownVisualTag
} from "../../../shared/game-data/index";
import type { EnabledMvpClass } from "../../../shared/game-data/classes";

export type CandidateRejectionReason =
  | "duplicate_candidate"
  | "unknown_class"
  | "class_not_enabled"
  | "unknown_visual_tag"
  | "unknown_skill"
  | "skill_class_mismatch";

export type CandidateRejection = {
  readonly candidate: string;
  readonly reason: CandidateRejectionReason;
};

export type CandidateFilterResult<T extends string> = {
  readonly accepted: readonly T[];
  readonly rejected: readonly CandidateRejection[];
};

export type SelectionStatus = "ready" | "needs_manual_selection";

export type CreationSelectionRequirements = {
  readonly minClassCandidates: 2;
  readonly minElementCandidates: 1;
  readonly minSkillCandidates: 3;
};

export const CREATION_SELECTION_REQUIREMENTS: CreationSelectionRequirements = {
  minClassCandidates: 2,
  minElementCandidates: 1,
  minSkillCandidates: 3
};

export type FilteredHeroAnalysisSuggestion = {
  readonly schemaValid: boolean;
  readonly issues: readonly ValidationIssue[];
  readonly classes: CandidateFilterResult<HeroClass>;
  readonly visualTags: CandidateFilterResult<string>;
  readonly skills: CandidateFilterResult<SkillId>;
  readonly elements: readonly HeroElement[];
  readonly elementRejections: readonly CandidateRejection[];
  readonly selectionStatus: SelectionStatus;
  readonly manualSelectionRequired: boolean;
  readonly message: "可继续" | "需要手选";
};

function emptyFilter<T extends string>(): CandidateFilterResult<T> {
  return { accepted: [], rejected: [] };
}

function filterClasses(candidates: readonly string[]): CandidateFilterResult<HeroClass> {
  const accepted: HeroClass[] = [];
  const rejected: CandidateRejection[] = [];
  const seen = new Set<string>();
  candidates.forEach((candidate) => {
    if (seen.has(candidate)) {
      rejected.push({ candidate, reason: "duplicate_candidate" });
      return;
    }
    seen.add(candidate);
    if (ALL_HERO_CLASSES.indexOf(candidate as HeroClass) === -1) {
      rejected.push({ candidate, reason: "unknown_class" });
    } else if (!isEnabledMvpClass(candidate as HeroClass)) {
      rejected.push({ candidate, reason: "class_not_enabled" });
    } else {
      accepted.push(candidate as HeroClass);
    }
  });
  return { accepted, rejected };
}

function filterVisualTags(candidates: readonly string[]): CandidateFilterResult<string> {
  const accepted: string[] = [];
  const rejected: CandidateRejection[] = [];
  const seen = new Set<string>();
  candidates.forEach((candidate) => {
    if (seen.has(candidate)) {
      rejected.push({ candidate, reason: "duplicate_candidate" });
      return;
    }
    seen.add(candidate);
    if (!isKnownVisualTag(candidate)) {
      rejected.push({ candidate, reason: "unknown_visual_tag" });
    } else {
      accepted.push(candidate);
    }
  });
  return { accepted, rejected };
}

function filterSkills(
  candidates: readonly SkillId[],
  acceptedClasses: readonly EnabledMvpClass[]
): CandidateFilterResult<SkillId> {
  const accepted: SkillId[] = [];
  const rejected: CandidateRejection[] = [];
  const seen = new Set<string>();
  candidates.forEach((candidate) => {
    if (seen.has(candidate)) {
      rejected.push({ candidate, reason: "duplicate_candidate" });
      return;
    }
    seen.add(candidate);
    const definition = getStartingSkillDefinition(candidate);
    if (!isKnownStartingSkill(candidate) || !definition) {
      rejected.push({ candidate, reason: "unknown_skill" });
    } else if (acceptedClasses.indexOf(definition.heroClass) === -1) {
      rejected.push({ candidate, reason: "skill_class_mismatch" });
    } else {
      accepted.push(candidate);
    }
  });
  return { accepted, rejected };
}

function filterElements(candidates: readonly HeroElement[]): {
  readonly accepted: readonly HeroElement[];
  readonly rejected: readonly CandidateRejection[];
} {
  const accepted: HeroElement[] = [];
  const rejected: CandidateRejection[] = [];
  const seen = new Set<HeroElement>();
  candidates.forEach((candidate) => {
    if (seen.has(candidate)) {
      rejected.push({ candidate, reason: "duplicate_candidate" });
      return;
    }
    seen.add(candidate);
    accepted.push(candidate);
  });
  return { accepted, rejected };
}

function candidateStatus(
  classes: CandidateFilterResult<HeroClass>,
  elements: readonly HeroElement[],
  skills: CandidateFilterResult<SkillId>
): SelectionStatus {
  return classes.accepted.length >= CREATION_SELECTION_REQUIREMENTS.minClassCandidates &&
    elements.length >= CREATION_SELECTION_REQUIREMENTS.minElementCandidates &&
    skills.accepted.length >= CREATION_SELECTION_REQUIREMENTS.minSkillCandidates
    ? "ready"
    : "needs_manual_selection";
}

export function filterHeroAnalysisSuggestion(input: unknown): FilteredHeroAnalysisSuggestion {
  const schemaResult = validateHeroAnalysisSuggestion(input);
  if (!schemaResult.success) {
    const status: SelectionStatus = "needs_manual_selection";
    return {
      schemaValid: false,
      issues: schemaResult.issues,
      classes: emptyFilter<HeroClass>(),
      visualTags: emptyFilter<string>(),
      skills: emptyFilter<SkillId>(),
      elements: [],
      elementRejections: [],
      selectionStatus: status,
      manualSelectionRequired: true,
      message: "需要手选"
    };
  }
  const suggestion: HeroAnalysisSuggestion = schemaResult.data;
  const classes = filterClasses(suggestion.classCandidates);
  const visualTags = filterVisualTags(suggestion.visualTagIds);
  const skills = filterSkills(
    suggestion.skillCandidates,
    classes.accepted as readonly EnabledMvpClass[]
  );
  const elements = filterElements(suggestion.elementCandidates);
  const selectionStatus = candidateStatus(classes, elements.accepted, skills);
  return {
    schemaValid: true,
    issues: [],
    classes,
    visualTags,
    skills,
    elements: elements.accepted,
    elementRejections: elements.rejected,
    selectionStatus,
    manualSelectionRequired: selectionStatus === "needs_manual_selection",
    message: selectionStatus === "ready" ? "可继续" : "需要手选"
  };
}

function businessIssue(path: string, code: string, message: string): ValidationIssue {
  return { path, code, message };
}

export function validateConfirmedHeroForCreation(
  input: unknown,
  draftInput: unknown
): ValidationResult<ConfirmedHero> {
  const heroResult = validateConfirmedHero(input);
  if (!heroResult.success) {
    return heroResult;
  }
  if (draftInput === undefined) {
    return {
      success: false,
      issues: [businessIssue("draft", "draft_required", "A validated drawing draft is required.")]
    };
  }
  const draftResult = validateDrawingDraft(draftInput);
  if (!draftResult.success) {
    return draftResult;
  }
  const hero = heroResult.data;
  const draft: DrawingDraft = draftResult.data;
  const issues: ValidationIssue[] = [];
  if (hero.artworkId !== draft.artworkId) {
    issues.push(
      businessIssue("artworkId", "artwork_mismatch", "Hero and draft artwork IDs must match.")
    );
  }
  if (hero.artworkRevision !== draft.revision) {
    issues.push(
      businessIssue(
        "artworkRevision",
        "revision_mismatch",
        "Hero and draft artwork revisions must match."
      )
    );
  }
  if (!draft.drawing.strokes.some((stroke) => stroke.tool !== "eraser")) {
    issues.push(
      businessIssue(
        "draft.drawing.strokes",
        "empty_drawing",
        "A hero requires at least one non-eraser stroke."
      )
    );
  }
  if (!isEnabledMvpClass(hero.heroClass)) {
    issues.push(
      businessIssue("heroClass", "class_not_enabled", "Hero class is not enabled for this MVP.")
    );
  }
  hero.visualTagIds.forEach((tag, index) => {
    if (!isKnownVisualTag(tag)) {
      issues.push(
        businessIssue(
          `visualTagIds[${index}]`,
          "unknown_visual_tag",
          "Visual tag is not in the shipped allowlist."
        )
      );
    }
  });
  const skill = getStartingSkillDefinition(hero.startingSkillId);
  if (!skill || !isKnownStartingSkill(hero.startingSkillId)) {
    issues.push(
      businessIssue(
        "startingSkillId",
        "unknown_skill",
        "Starting skill is not a shipped starting-skill candidate."
      )
    );
  } else if (skill.heroClass !== hero.heroClass) {
    issues.push(
      businessIssue(
        "startingSkillId",
        "skill_class_mismatch",
        "Starting skill does not belong to the selected class."
      )
    );
  }
  return issues.length > 0 ? { success: false, issues } : { success: true, data: hero };
}
