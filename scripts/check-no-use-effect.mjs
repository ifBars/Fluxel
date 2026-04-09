import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const rootDir = process.cwd();
const srcDir = join(rootDir, "src");
const allowlist = new Set([
  join(srcDir, "hooks", "useReactiveEffect.ts"),
]);

const files = [];

function walk(dir) {
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      walk(fullPath);
      continue;
    }

    if (fullPath.endsWith(".ts") || fullPath.endsWith(".tsx")) {
      files.push(fullPath);
    }
  }
}

function getLineNumber(source, index) {
  return source.slice(0, index).split(/\r?\n/).length;
}

walk(srcDir);

const violations = [];

for (const file of files) {
  if (allowlist.has(file)) {
    continue;
  }

  const source = readFileSync(file, "utf8");
  const reactImportMatch = /import[\s\S]*?\{[\s\S]*?\buseEffect\b[\s\S]*?\}\s*from\s*["']react["']/m.exec(source);
  if (reactImportMatch) {
    violations.push({
      file,
      line: getLineNumber(source, reactImportMatch.index),
      reason: "Direct useEffect import from react",
    });
    continue;
  }

  const useEffectCallMatch = /\buseEffect\s*\(/.exec(source);
  if (useEffectCallMatch) {
    violations.push({
      file,
      line: getLineNumber(source, useEffectCallMatch.index),
      reason: "Direct useEffect call",
    });
  }
}

if (violations.length > 0) {
  console.error("No-use-effect check failed:\n");
  for (const violation of violations) {
    console.error(`- ${relative(rootDir, violation.file)}:${violation.line} ${violation.reason}`);
  }
  process.exit(1);
}

console.log("No-use-effect check passed.");
