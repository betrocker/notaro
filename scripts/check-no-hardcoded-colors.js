const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const TARGET_DIRS = ["app", "components", "lib"];
const VALID_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);
const COLOR_REGEX = /#(?:[0-9a-fA-F]{3,8})\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g;

const IGNORED_FILES = new Set([
  path.normalize("lib/design-system/tokens.ts"),
  path.normalize("lib/design-system/tailwind.tokens.js"),
]);

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) {
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(absolute, files);
      continue;
    }

    const ext = path.extname(entry.name);
    if (!VALID_EXTENSIONS.has(ext)) {
      continue;
    }

    files.push(absolute);
  }

  return files;
}

function isIgnored(relativePath) {
  return IGNORED_FILES.has(path.normalize(relativePath));
}

function shouldIgnoreLineForIconPalette(relativePath, line, inPaletteBlock) {
  if (path.normalize(relativePath) !== path.normalize("components/Icon.tsx")) {
    return { skip: false, inPaletteBlock };
  }

  if (!inPaletteBlock && line.includes("const LIST_ICON_COLORS = {")) {
    return { skip: true, inPaletteBlock: true };
  }

  if (inPaletteBlock) {
    if (line.includes("} as const;")) {
      return { skip: true, inPaletteBlock: false };
    }

    return { skip: true, inPaletteBlock: true };
  }

  return { skip: false, inPaletteBlock };
}

function main() {
  const allFiles = TARGET_DIRS.flatMap((dir) => walk(path.join(ROOT, dir)));
  const violations = [];

  for (const absolutePath of allFiles) {
    const relativePath = path.relative(ROOT, absolutePath);
    if (isIgnored(relativePath)) {
      continue;
    }

    const content = fs.readFileSync(absolutePath, "utf8");
    const lines = content.split(/\r?\n/);
    let inIconPaletteBlock = false;

    lines.forEach((line, index) => {
      const { skip, inPaletteBlock } = shouldIgnoreLineForIconPalette(
        relativePath,
        line,
        inIconPaletteBlock,
      );
      inIconPaletteBlock = inPaletteBlock;

      if (skip) {
        return;
      }

      const matches = line.match(COLOR_REGEX);
      if (!matches) {
        return;
      }

      for (const match of matches) {
        violations.push({
          file: relativePath,
          line: index + 1,
          value: match,
          source: line.trim(),
        });
      }
    });
  }

  if (violations.length === 0) {
    console.log("No hardcoded colors found.");
    process.exit(0);
  }

  console.error("Hardcoded colors detected outside design-system token sources:");
  for (const violation of violations) {
    console.error(
      `${violation.file}:${violation.line} -> ${violation.value}\n  ${violation.source}`,
    );
  }

  process.exit(1);
}

main();
