# Game client

This directory contains the real Cocos Creator 3.8.8 project source created by the user from
the Empty (2D) template. The user has successfully opened the formal project and previewed
`TestScene` locally. Replit has inspected and integrated the resulting source files but has not
run the Cocos editor or verified iOS or WeChat Mini Game builds.

The verified editor save mounts `SharedContractsSmoke` on `TestScene`'s Canvas. Cocos generated
the real `.meta` files for the script and all asset-local shared modules; their generated UUIDs
must be preserved rather than recreated manually.

## Shared source mirror

Files under `packages/` are the only canonical shared source. Cocos Creator 3.8.8 was verified
locally not to resolve extensionless imports within TypeScript sources reached through the
pnpm workspace: `@drawborn/contracts` failed at its internal `./battle` import.

`pnpm sync:cocos-shared` copies the 17 approved Cocos-facing source files byte-for-byte into
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
asset-local path has passed Cocos Creator 3.8.8 editor import and browser preview: the previous
`Module "./battle" not found` error is gone, the smoke component is mounted, and the console
logs `Vanguard,Shadowblade,Spiritbow,Mystic,Oathkeeper`. The editor reported zero errors and
zero warnings. Safari's `minimal-ui` viewport warning is a browser compatibility notice, not a
game-code error. iOS and WeChat Mini Game builds are still unverified.

Client-shared code must use TypeScript 4.1-compatible syntax and must not require DOM, Node.js,
database, network, or Cocos APIs. It must not use `Math.random`, `Date.now`, or implicit time.
