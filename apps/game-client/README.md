# Game client placeholder

This directory is reserved for the real Cocos Creator 4.0 LTS project. Create that project
with the local Cocos Creator editor, then sync it into this directory.

Phase 0 deliberately does not fabricate scenes, prefabs, assets, `.meta` files, editor
configuration, or platform build verification.

## Planned shared interfaces

- Import engine-independent IDs and DTOs from `packages/contracts`.
- Import stable configuration from `packages/game-data`.
- Import deterministic simulation behavior from `packages/battle-core`.
- Implement platform-specific services behind `packages/platform-adapters`.

## Compatibility warning

Cocos Creator does not necessarily read or honor the monorepo's ordinary `tsconfig.json`.
Workspace package resolution, path aliases, output format, TypeScript version behavior, and
the iOS/WeChat build pipeline must be tested in the local editor before relying on them.

Client-shared code must use TypeScript 4.1-compatible syntax and must not require DOM, Node.js,
database, network, or Cocos APIs. It must not use `Math.random`, `Date.now`, or implicit time.
