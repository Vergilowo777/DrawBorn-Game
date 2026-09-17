/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require("fs");
const path = require("path");

const roots = [
  "apps/game-client/assets/scripts/creation/domain",
  "packages/battle-core/src",
  "packages/game-data/src",
  "packages/platform-adapters/src"
];
const contractFiles = [
  "packages/contracts/src/battle.ts",
  "packages/contracts/src/creation.ts",
  "packages/contracts/src/enums.ts",
  "packages/contracts/src/ids.ts",
  "packages/contracts/src/index.ts"
];
const forbidden = [
  ["document", /\bdocument\b/],
  ["window", /\bwindow\b/],
  ["localStorage", /\blocalStorage\b/],
  ["fetch", /\bfetch\s*\(/],
  ["XMLHttpRequest", /\bXMLHttpRequest\b/],
  ["WebSocket", /\bWebSocket\b/],
  ["process", /\bprocess\b/],
  ["Buffer", /\bBuffer\b/],
  ["node: module", /(?:from\s+|import\s*\()\s*["']node:/],
  ["cc import", /(?:from\s+|import\s*\()\s*["']cc(?:\/[^"']*)?["']/],
  ["require()", /\brequire\s*\(/],
  ["Math.random", /\bMath\.random\s*\(/],
  ["Date.now", /\bDate\.now\s*\(/],
  ["new Date()", /\bnew\s+Date\s*\(/],
  ["Date()", /\bDate\s*\(/]
];

function listTypeScriptFiles(root) {
  const entries = fs.readdirSync(root, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...listTypeScriptFiles(entryPath));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(entryPath);
    }
  }

  return files;
}

const files = roots.flatMap(listTypeScriptFiles).concat(contractFiles);
const violations = [];

for (const file of files) {
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const [name, pattern] of forbidden) {
      if (pattern.test(line)) {
        violations.push(`${file}:${index + 1}: forbidden ${name}`);
      }
    }
  });
}

if (violations.length > 0) {
  console.error("Cocos shared-code boundary violations found:");
  console.error(violations.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Cocos boundary check passed for ${files.length} files.`);
}
