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
