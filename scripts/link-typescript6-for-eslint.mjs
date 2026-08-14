import { existsSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";

// typescript-eslint still needs the TypeScript 6 compiler API.
// TypeScript 7 has no stable API yet (expected in 7.1), so keep tsc on 7
// and point ESLint packages at a side-by-side TypeScript 6 install.
const root = process.cwd();
const typescript6 = join(root, "node_modules/typescript6");
if (!existsSync(typescript6)) {
  process.exit(0);
}

const packages = [
  "@typescript-eslint/eslint-plugin",
  "@typescript-eslint/parser",
  "@typescript-eslint/project-service",
  "@typescript-eslint/tsconfig-utils",
  "@typescript-eslint/type-utils",
  "@typescript-eslint/typescript-estree",
  "@typescript-eslint/utils",
  "ts-api-utils",
  "typescript-eslint",
];

for (const pkg of packages) {
  const pkgDir = join(root, "node_modules", pkg);
  if (!existsSync(pkgDir)) continue;
  const dir = join(pkgDir, "node_modules");
  const dest = join(dir, "typescript");
  mkdirSync(dir, { recursive: true });
  rmSync(dest, { recursive: true, force: true });
  symlinkSync(typescript6, dest, "junction");
}
