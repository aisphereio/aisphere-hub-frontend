/**
 * copy-monaco — copies monaco-editor's min/vs assets into public/monaco/vs
 * so @monaco-editor/react loads the editor same-origin (via loader.config
 * { paths: { vs: '/monaco/vs' } }) instead of the jsdelivr CDN.
 *
 * Runs before `next dev` so the dev server serves monaco locally. The
 * production standalone build copies the same source into
 * .next/standalone/public/monaco/vs via copy-standalone-assets.mjs.
 *
 * public/monaco is git-ignored (it's a build artefact, not source).
 */
import { cp, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const from = join(root, "node_modules", "monaco-editor", "min", "vs");
const to = join(root, "public", "monaco", "vs");

if (!existsSync(from)) {
  console.warn("[copy-monaco] source not found:", from, "— skipping");
  process.exit(0);
}
await mkdir(to, { recursive: true });
await cp(from, to, { recursive: true, force: true });
console.log("[copy-monaco] copied min/vs -> public/monaco/vs");
