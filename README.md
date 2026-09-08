# Drawborn: Creator Clash

Phase 0 monorepo foundation for the Drawborn game. The current repository intentionally
contains no drawing UI, production AI, battle implementation, database models, PVP, payment,
shop, or chapter content.

## Requirements

- Node.js 20+
- pnpm 10

## Commands

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
```

`pnpm typecheck` also runs a TypeScript 4.1 compiler against all Cocos-facing source files.
Boundary-only Zod schemas are intentionally excluded from that compatibility pass.

## Workspace boundaries

- `apps/game-client`: real Cocos Creator 3.8.8 project source imported from the user's locally
  created and previewed Empty (2D) project.
- `apps/api`: minimal Fastify health endpoint only.
- `packages/battle-core`: deterministic, engine-independent battle primitives.
- `packages/contracts`: shared types and boundary-only Zod schemas.
- `packages/game-data`: stable game IDs and enabled-MVP allowlists.
- `packages/platform-adapters`: platform capability interfaces.

Client-shared source must remain compatible with TypeScript 4.1 syntax. In particular, it must
not depend on DOM, Node.js, networking, databases, Cocos, implicit system time, `Date.now`, or
`Math.random`. Cocos Creator does not necessarily consume a normal workspace `tsconfig.json`;
imports, aliases, and compiler behavior must be verified locally. The included `TestScene` was
opened and previewed by the user in Cocos Creator 3.8.8. Importing `@drawborn/contracts`
directly through the pnpm workspace failed because Cocos only resolved extensionless
TypeScript modules inside `assets`. The asset-local replacement has now been verified in the
real editor and browser preview: Cocos generated the `.meta` files, loaded all shared modules,
mounted `SharedContractsSmoke` on `TestScene`'s Canvas, and logged all five class IDs with zero
editor errors or warnings. Safari's `minimal-ui` viewport warning is a browser compatibility
notice rather than a game-code error. The canonical sources remain in `packages/`; run
`pnpm sync:cocos-shared` after changing them to update the generated
`apps/game-client/assets/shared/` mirror. CI runs `pnpm check:cocos-shared` to reject missing,
extra, or drifted mirror files. Zod is restricted to validation boundaries and is not copied
into the Cocos mirror. iOS and WeChat Mini Game builds remain unverified.
