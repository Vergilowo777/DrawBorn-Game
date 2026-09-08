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

- `apps/game-client`: placeholder for a local Cocos Creator 4.0 LTS project.
- `apps/api`: minimal Fastify health endpoint only.
- `packages/battle-core`: deterministic, engine-independent battle primitives.
- `packages/contracts`: shared types and boundary-only Zod schemas.
- `packages/game-data`: stable game IDs and enabled-MVP allowlists.
- `packages/platform-adapters`: platform capability interfaces.

Client-shared source must remain compatible with TypeScript 4.1 syntax. In particular, it must
not depend on DOM, Node.js, networking, databases, Cocos, implicit system time, `Date.now`, or
`Math.random`. Cocos Creator does not necessarily consume a normal workspace `tsconfig.json`;
imports, aliases, and compiler behavior must be verified after the real project is created
locally. Zod is restricted to validation boundaries and is not a dependency of `battle-core`
or `game-data`.