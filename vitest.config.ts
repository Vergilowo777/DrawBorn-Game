import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    tsconfigRaw: JSON.stringify({
      compilerOptions: {
        target: "es2019",
        strict: true
      }
    })
  },
  test: {
    projects: [
      "apps/api",
      "packages/*",
      {
        esbuild: {
          tsconfigRaw: JSON.stringify({
            compilerOptions: {
              target: "es2019",
              strict: true
            }
          })
        },
        test: {
          name: "game-client",
          include: ["tests/game-client/**/*.test.ts"]
        }
      }
    ]
  }
});
