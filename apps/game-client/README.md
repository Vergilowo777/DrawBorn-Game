# Game client

This directory contains the real Cocos Creator 3.8.8 project source created by the user from
the Empty (2D) template. The user has successfully opened and previewed `TestScene` locally.
Replit has only inspected and integrated the supplied source files; it has not run the Cocos
editor or verified iOS or WeChat Mini Game builds.

The imported `TestScene.scene`, its `.meta` UUID, `.creator`, and `settings` files are preserved
from the uploaded project. `assets/scripts/SharedContractsSmoke.ts` is intentionally missing a
`.meta` file so Cocos Creator 3.8.8 can generate it during the next local import.

## Shared interfaces

- `SharedContractsSmoke.ts` imports engine-independent constants from `packages/contracts`.
- Import stable configuration from `packages/game-data`.
- Import deterministic simulation behavior from `packages/battle-core`.
- Implement platform-specific services behind `packages/platform-adapters`.

## Compatibility warning

Cocos Creator does not necessarily read or honor the monorepo's ordinary `tsconfig.json`.
Workspace package resolution, path aliases, output format, TypeScript version behavior, and
the iOS/WeChat build pipeline must be tested in the local editor before relying on them. The
next local check must confirm that Cocos resolves `@drawborn/contracts`, imports the smoke
component, generates its `.meta` file, and logs the shared class list.

Client-shared code must use TypeScript 4.1-compatible syntax and must not require DOM, Node.js,
database, network, or Cocos APIs. It must not use `Math.random`, `Date.now`, or implicit time.
