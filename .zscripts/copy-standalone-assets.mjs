import { cp, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const standaloneDir = join(root, ".next", "standalone");

async function copyDir(from, to) {
  if (!existsSync(from)) return;
  await mkdir(to, { recursive: true });
  await cp(from, to, { recursive: true, force: true });
}

await copyDir(join(root, ".next", "static"), join(standaloneDir, ".next", "static"));
await copyDir(join(root, "public"), join(standaloneDir, "public"));

// Monaco Editor self-host: @monaco-editor/react loads the editor core +
// language workers from /monaco/vs at runtime (configured via
// loader.config in monaco-skill-editor.tsx). The source lives in
// node_modules/monaco-editor/min/vs; copy it into the standalone
// output's public dir so the container serves it same-origin instead
// of pulling ~24MB from the jsdelivr CDN on first paint.
await copyDir(
  join(root, "node_modules", "monaco-editor", "min", "vs"),
  join(standaloneDir, "public", "monaco", "vs"),
);
