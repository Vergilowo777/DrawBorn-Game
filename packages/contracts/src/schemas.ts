import { z } from "zod";
import { HERO_CLASSES, HERO_ELEMENTS } from "./enums";
import {
  DRAWING_CANVAS_HEIGHT,
  DRAWING_CANVAS_WIDTH,
  DRAWING_LIMITS,
  DRAWING_SCHEMA_VERSION,
  DrawingDraft,
  HeroAnalysisSuggestion,
  ConfirmedHero
} from "./creation";
import {
  asBattleSeed,
  asEquipmentId,
  asSkillId,
  asVisualTagId,
  BattleSeed,
  EquipmentId,
  SkillId,
  VisualTagId
} from "./ids";

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

const finiteNumber = z.number().finite();
const idSchema = z
  .string()
  .min(1)
  .max(DRAWING_LIMITS.maxIdLength)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
const artworkRevisionSchema = finiteNumber.int().min(1).max(2147483647);
const visualTagIdSchema = z
  .string()
  .min(1)
  .max(DRAWING_LIMITS.maxIdLength)
  .regex(/^tag\.[a-z0-9_.-]+$/)
  .transform<VisualTagId>(asVisualTagId);
const creationSkillIdSchema = z
  .string()
  .max(DRAWING_LIMITS.maxIdLength)
  .regex(/^skill\.[a-z0-9_.-]+$/)
  .transform<SkillId>(asSkillId);
export const drawingPointSchema = z
  .object({
    x: finiteNumber.min(0).max(DRAWING_CANVAS_WIDTH),
    y: finiteNumber.min(0).max(DRAWING_CANVAS_HEIGHT)
  })
  .strict();
const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?$/);
const pencilStrokeSchema = z
  .object({
    id: idSchema,
    tool: z.enum(["pencil", "marker"]),
    points: z.array(drawingPointSchema).min(1).max(DRAWING_LIMITS.maxPointsPerStroke),
    width: finiteNumber.min(DRAWING_LIMITS.minLineWidth).max(DRAWING_LIMITS.maxLineWidth),
    color: hexColorSchema
  })
  .strict();
const eraserStrokeSchema = z
  .object({
    id: idSchema,
    tool: z.literal("eraser"),
    points: z.array(drawingPointSchema).min(1).max(DRAWING_LIMITS.maxPointsPerStroke),
    width: finiteNumber.min(DRAWING_LIMITS.minLineWidth).max(DRAWING_LIMITS.maxLineWidth)
  })
  .strict();
export const drawingStrokeSchema = z.union([pencilStrokeSchema, eraserStrokeSchema]);
export const drawingDocumentSchema = z
  .object({
    width: z.literal(DRAWING_CANVAS_WIDTH),
    height: z.literal(DRAWING_CANVAS_HEIGHT),
    strokes: z.array(drawingStrokeSchema).max(DRAWING_LIMITS.maxStrokes)
  })
  .strict()
  .superRefine((document, context) => {
    const ids = new Set<string>();
    let totalPoints = 0;
    document.strokes.forEach((stroke, index) => {
      totalPoints += stroke.points.length;
      if (ids.has(stroke.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["strokes", index, "id"],
          message: "Stroke IDs must be unique."
        });
      }
      ids.add(stroke.id);
    });
    if (totalPoints > DRAWING_LIMITS.maxTotalPoints) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["strokes"],
        message: "Drawing exceeds its total sampling-point limit."
      });
    }
  });

export const drawingDraftSchema: z.ZodType<DrawingDraft> = z
  .object({
    schemaVersion: z.literal(DRAWING_SCHEMA_VERSION),
    artworkId: idSchema,
    revision: artworkRevisionSchema,
    drawing: drawingDocumentSchema
  })
  .strict();

const optionalNameSchema = z
  .string()
  .min(1)
  .max(DRAWING_LIMITS.maxNameLength)
  .refine((value) => value.trim().length > 0);
const optionalBackgroundSchema = z
  .string()
  .min(1)
  .max(DRAWING_LIMITS.maxBackgroundLength)
  .refine((value) => value.trim().length > 0);

export const heroAnalysisSuggestionSchema: z.ZodType<
  HeroAnalysisSuggestion,
  z.ZodTypeDef,
  unknown
> = z
  .object({
    artworkId: idSchema,
    artworkRevision: artworkRevisionSchema,
    visualTagIds: z.array(visualTagIdSchema).max(DRAWING_LIMITS.maxVisualTags),
    classCandidates: z
      .array(
        z
          .string()
          .min(1)
          .max(DRAWING_LIMITS.maxIdLength)
          .regex(/^[A-Za-z][A-Za-z0-9]*$/)
      )
      .max(DRAWING_LIMITS.maxClassCandidates),
    elementCandidates: z.array(heroElementSchema).max(DRAWING_LIMITS.maxElementCandidates),
    skillCandidates: z.array(creationSkillIdSchema).max(DRAWING_LIMITS.maxSkillCandidates),
    suggestedName: optionalNameSchema.optional(),
    suggestedBackground: optionalBackgroundSchema.optional(),
    source: z.enum(["mock", "manual"])
  })
  .strict();

export const confirmedHeroSchema: z.ZodType<ConfirmedHero, z.ZodTypeDef, unknown> = z
  .object({
    heroId: idSchema,
    artworkId: idSchema,
    artworkRevision: artworkRevisionSchema,
    visualTagIds: z.array(visualTagIdSchema).max(DRAWING_LIMITS.maxVisualTags),
    heroClass: heroClassSchema,
    element: heroElementSchema,
    startingSkillId: creationSkillIdSchema,
    name: optionalNameSchema.optional(),
    background: optionalBackgroundSchema.optional(),
    visibility: z.literal("private"),
    reviewStatus: z.literal("unreviewed"),
    source: z.enum(["mock", "manual"])
  })
  .strict();
