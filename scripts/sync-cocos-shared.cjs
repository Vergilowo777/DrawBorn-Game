/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require("fs");
const path = require("path");

const repositoryRoot = path.resolve(__dirname, "..");
const targetRoot = path.join(repositoryRoot, "apps/game-client/assets/shared");
const manifest = [
  ["packages/contracts/src/index.ts", "contracts/index.ts"],
  ["packages/contracts/src/battle.ts", "contracts/battle.ts"],
  ["packages/contracts/src/creation.ts", "contracts/creation.ts"],
  ["packages/contracts/src/enums.ts", "contracts/enums.ts"],
  ["packages/contracts/src/ids.ts", "contracts/ids.ts"],
  ["packages/battle-core/src/index.ts", "battle-core/index.ts"],
  ["packages/game-data/src/index.ts", "game-data/index.ts"],
  ["packages/game-data/src/classes.ts", "game-data/classes.ts"],
  ["packages/game-data/src/equipment.ts", "game-data/equipment.ts"],
  ["packages/game-data/src/skills.ts", "game-data/skills.ts"],
  ["packages/game-data/src/visual-tags.ts", "game-data/visual-tags.ts"],
  ["packages/platform-adapters/src/index.ts", "platform-adapters/index.ts"],
  ["packages/platform-adapters/src/analytics.ts", "platform-adapters/analytics.ts"],
  ["packages/platform-adapters/src/auth.ts", "platform-adapters/auth.ts"],
  ["packages/platform-adapters/src/payment.ts", "platform-adapters/payment.ts"],
  ["packages/platform-adapters/src/share.ts", "platform-adapters/share.ts"],
  ["packages/platform-adapters/src/storage.ts", "platform-adapters/storage.ts"]
];

function listTypeScriptFiles(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  const files = [];
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listTypeScriptFiles(entryPath));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(entryPath);
    }
  }
  return files;
}

function relativeToTarget(file) {
  return path.relative(targetRoot, file).split(path.sep).join("/");
}

function inspectMirror() {
  const problems = [];
  const expectedTargets = new Set(manifest.map((entry) => entry[1]));
  const actualTargets = listTypeScriptFiles(targetRoot).map(relativeToTarget);

  for (const actualTarget of actualTargets) {
    if (!expectedTargets.has(actualTarget)) {
      problems.push(`extra target: ${actualTarget}`);
    }
  }

  for (const [sourceRelative, targetRelative] of manifest) {
    const source = path.join(repositoryRoot, sourceRelative);
    const target = path.join(targetRoot, targetRelative);
    if (!fs.existsSync(source)) {
      problems.push(`missing source: ${sourceRelative}`);
      continue;
    }
    if (!fs.existsSync(target)) {
      problems.push(`missing target: ${targetRelative}`);
      continue;
    }
    if (!fs.readFileSync(source).equals(fs.readFileSync(target))) {
      problems.push(`content drift: ${targetRelative}`);
    }
  }

  return problems;
}

function syncMirror() {
  const expectedTargets = new Set(manifest.map((entry) => entry[1]));
  for (const existingFile of listTypeScriptFiles(targetRoot)) {
    if (!expectedTargets.has(relativeToTarget(existingFile))) {
      fs.rmSync(existingFile);
    }
  }

  for (const [sourceRelative, targetRelative] of manifest) {
    const source = path.join(repositoryRoot, sourceRelative);
    const target = path.join(targetRoot, targetRelative);
    if (!fs.existsSync(source)) {
      throw new Error(`Cannot sync missing source: ${sourceRelative}`);
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  }
}

const checkOnly = process.argv.includes("--check");
if (!checkOnly) {
  syncMirror();
}

const problems = inspectMirror();
if (problems.length > 0) {
  console.error("Cocos shared mirror check failed:");
  console.error(problems.join("\n"));
  process.exitCode = 1;
} else {
  const action = checkOnly ? "verified" : "synchronized";
  console.log(`Cocos shared mirror ${action}: ${manifest.length} files.`);
}
