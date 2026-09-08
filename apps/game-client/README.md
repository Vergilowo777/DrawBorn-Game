# Game client

This directory contains the real Cocos Creator 3.8.8 project source created by the user from
the Empty (2D) template. The user has successfully opened and previewed `TestScene` locally.
Replit has only inspected and integrated the supplied source files; it has not run the Cocos
editor or verified iOS or WeChat Mini Game builds.

The imported `TestScene.scene`, its `.meta` UUID, `.creator`, and `settings` files are preserved
from the uploaded project. `assets/scripts/SharedContractsSmoke.ts` is intentionally missing a
`.meta` file so Cocos Creator 3.8.8 can generate it during the next local import.

## Shared source mirror

Files under `packages/` are the only canonical shared source. Cocos Creator 3.8.8 was verified
locally not to resolve extensionless imports within TypeScript sources reached through the
pnpm workspace: `@drawborn/contracts` failed at its internal `./battle` import.

`pnpm sync:cocos-shared` copies the 15 approved Cocos-facing source files byte-for-byte into
`assets/shared/`, where Cocos can resolve them. Do not edit this mirror manually. Run the sync
command after every canonical shared-source change; CI uses `pnpm check:cocos-shared` to reject
missing, extra, or modified mirror `.ts` files. Generated Cocos `.meta` files are ignored by
the mirror check.

`SharedContractsSmoke.ts` now imports from `assets/shared/contracts/index`. Boundary-only
`contracts/src/schemas.ts` is not mirrored because it depends on Zod.

## Compatibility warning

Cocos Creator does not necessarily read or honor the monorepo's ordinary `tsconfig.json`.
Workspace package resolution, path aliases, output format, TypeScript version behavior, and
the iOS/WeChat build pipeline must be tested in the local editor before relying on them. The
next local check must confirm that Cocos imports the asset-local smoke component, generates
real `.meta` files for the mirror, and logs the shared class list without the previous
`Module "./battle" not found` error.

Client-shared code must use TypeScript 4.1-compatible syntax and must not require DOM, Node.js,
database, network, or Cocos APIs. It must not use `Math.random`, `Date.now`, or implicit time.
