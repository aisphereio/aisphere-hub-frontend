import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const contractPath = join(root, 'openapi', 'aisphere-hub.swagger.json');
const lockPath = join(root, 'openapi', 'contract-lock.json');

const [contract, lockSource] = await Promise.all([
  readFile(contractPath),
  readFile(lockPath, 'utf8'),
]);
const lock = JSON.parse(lockSource);
const trustedRepository = 'https://github.com/aisphereio/aisphere-hub.git';

for (const field of ['repository', 'git_sha', 'ref', 'sha256', 'kernel_version', 'generator']) {
  if (typeof lock[field] !== 'string' || lock[field].trim() === '') {
    throw new Error(`contract-lock.json is missing ${field}`);
  }
}
if (lock.repository !== trustedRepository) {
  throw new Error(`Hub contract must come from ${trustedRepository}, got ${lock.repository}`);
}

const actual = createHash('sha256').update(contract).digest('hex');
if (actual !== lock.sha256) {
  throw new Error(`Hub contract SHA-256 mismatch: lock=${lock.sha256} actual=${actual}`);
}

console.log(`Hub contract verified: ${lock.git_sha} (${actual})`);
