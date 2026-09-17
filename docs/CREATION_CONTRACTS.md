# Phase 1.1 creation contracts

Phase 1.1 defines the data boundary from a drawing to a confirmed private
hero. It does not implement a canvas, storage, AI transport, PNG encoding,
moderation, or battle data.

## Drawing data

`DrawingDocument` is always a 1024 by 1024 logical canvas. The origin is the
top-left corner; `x` increases rightward and `y` increases downward. Stroke
widths are logical canvas units, so the saved data is independent of display
pixels. A stroke has a stable caller-provided ID, one of `pencil`, `marker`,
or `eraser`, a non-empty point sequence, and a width from 1 through 128.
Pencil and marker strokes carry an RGB/RGBA hexadecimal color. Erasers do not
carry a color and are not represented as a white brush.

Draft schema version 1 contains `artworkId`, a positive `revision`, and the
drawing. Empty drafts are valid; empty strokes are not. Limits are centralized
in `DRAWING_LIMITS`: 512 strokes, 4,096 points per stroke, 65,536 points per
drawing, and 1,000,000 UTF-16 code units for serialized input. IDs are at most
128 UTF-16 code units, names 40, and backgrounds 280.

`serializeDrawingDraft` validates before encoding. `deserializeDrawingDraft`
parses JSON and validates again, rejecting malformed JSON, unknown versions,
unknown fields, non-finite numbers, out-of-range coordinates, duplicate stroke
IDs, and all limits. It does not claim to implement autosave or exit/reopen
behavior.

## Analysis and confirmation

`HeroAnalysisSuggestion` contains only artwork identity, visual-tag IDs,
candidate classes/elements/skills, optional bounded text, and a `mock` or
`manual` source. The asset-local creation domain performs the second,
business-level validation using only the asset-local shared mirror. It filters
to the two enabled MVP classes (`Vanguard`, `Mystic`), the finite visual-tag
allowlist, and the six starting skills. It reports duplicate, unknown,
closed-class, and cross-class-skill reasons. It requires two class candidates
and three class-compatible skill candidates (and at least one element);
otherwise it returns `selectionStatus: needs_manual_selection` and the
explicit message `需要手选` without inventing candidates.

The five stable class IDs and four elements remain in contracts. The six
starting skill IDs are:

- `skill.vanguard.strike`
- `skill.vanguard.guard`
- `skill.vanguard.rush`
- `skill.mystic.burst`
- `skill.mystic.frostfield`
- `skill.mystic.thunderseal`

`ConfirmedHero` has only identity/revision, tags, class, element, one starting
skill, optional bounded name/background, and provenance/status fields. New
heroes are always `private` and `unreviewed`; source is only `mock` or
`manual`. It has no health, attack, defense, approval, or other free combat
attributes. Confirmation is validated again after analysis filtering and
requires a validated draft with matching artwork ID/revision and at least one
non-eraser stroke. Empty or eraser-only drafts cannot create a hero.

Zod schemas in `packages/contracts/src/schemas.ts` are boundary-only and
strict. The dependency-free validators in `creation.ts` are the client-safe
runtime path. PNG and thumbnail types define request dimensions, artwork
revision, MIME type, and byte data through `DrawingExportPort`; no encoder or
fake success implementation is included.
