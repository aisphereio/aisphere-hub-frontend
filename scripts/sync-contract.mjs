#!/usr/bin/env node

/**
 * Sync the generated Hub OpenAPI contract and regenerate the TypeScript SDK.
 *
 * Remote and local synchronization both require Hub's generated
 * dist/api-contract/contract-lock.json. The frontend never invents provenance
 * metadata from a branch name: git_sha must be the immutable 40-character Hub
 * commit recorded by the backend contract pipeline.
 */

import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const openapiDir = join(root, 'openapi');
const swaggerPath = join(openapiDir, 'aisphere-hub.swagger.json');
const lockPath = join(openapiDir, 'contract-lock.json');

const HUB_RAW_ROOT = 'https://raw.githubusercontent.com/aisphereio/aisphere-hub';
const TRUSTED_REPOSITORY = 'https://github.com/aisphereio/aisphere-hub.git';
const FULL_GIT_SHA = /^[0-9a-f]{40}$/i;
const KERNEL_VERSION = /^v\d+\.\d+\.\d+(?:[-+].*)?$/;

async function main() {
  const args = process.argv.slice(2);
  let ref = 'main';
  let localPath = '';

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--ref' && index + 1 < args.length) {
      ref = args[++index];
    } else if (args[index] === '--local' && index + 1 < args.length) {
      localPath = args[++index];
    }
  }

  await mkdir(openapiDir, { recursive: true });

  if (localPath) {
    await syncLocal(localPath);
  } else {
    await syncRemote(ref);
  }

  const lock = await verifyContract();

  console.log('\nRegenerating TypeScript client with Orval...');
  execFileSync('npx', ['orval', '--config', 'orval.config.ts'], {
    cwd: root,
    stdio: 'inherit',
  });

  console.log('\n✓ Contract sync complete');
  console.log(`  Hub commit: ${lock.git_sha}`);
  console.log(`  Hub ref: ${lock.ref}`);
  console.log(`  Kernel: ${lock.kernel_version}`);
  console.log(`  Swagger SHA-256: ${lock.sha256}`);
  console.log('  Generated: src/lib/api/generated/');
}

async function syncLocal(localPath) {
  console.log(`Syncing from local Hub repository: ${localPath}`);
  const localSwagger = join(localPath, 'docs', 'openapi', 'aisphere-hub.swagger.json');
  const localLock = join(localPath, 'dist', 'api-contract', 'contract-lock.json');

  requireFile(localSwagger, 'Run "make contract-bundle" in the Hub repository first.');
  requireFile(localLock, 'Hub contract-lock.json is required; frontend must not synthesize provenance.');

  await copyFile(localSwagger, swaggerPath);
  await copyFile(localLock, lockPath);
}

async function syncRemote(ref) {
  console.log(`Syncing Hub contract from ref ${ref}`);
  const swaggerUrl = `${HUB_RAW_ROOT}/${encodeURIComponent(ref)}/docs/openapi/aisphere-hub.swagger.json`;
  const lockUrl = `${HUB_RAW_ROOT}/${encodeURIComponent(ref)}/dist/api-contract/contract-lock.json`;

  const [swaggerResponse, lockResponse] = await Promise.all([
    fetch(swaggerUrl),
    fetch(lockUrl),
  ]);

  if (!swaggerResponse.ok) {
    throw new Error(`Hub swagger download failed: ${swaggerResponse.status} ${swaggerResponse.statusText}`);
  }
  if (!lockResponse.ok) {
    throw new Error(`Hub contract lock download failed: ${lockResponse.status} ${lockResponse.statusText}`);
  }

  await writeFile(swaggerPath, await swaggerResponse.text());
  await writeFile(lockPath, await lockResponse.text());
}

async function verifyContract() {
  console.log('\nVerifying Hub contract provenance...');
  const contract = await readFile(swaggerPath);
  const lock = JSON.parse(await readFile(lockPath, 'utf8'));

  for (const field of ['repository', 'git_sha', 'ref', 'sha256', 'kernel_version', 'generator']) {
    if (typeof lock[field] !== 'string' || lock[field].trim() === '') {
      throw new Error(`contract-lock.json is missing ${field}`);
    }
  }

  if (lock.repository !== TRUSTED_REPOSITORY) {
    throw new Error(`Hub contract must come from ${TRUSTED_REPOSITORY}, got ${lock.repository}`);
  }
  if (!FULL_GIT_SHA.test(lock.git_sha)) {
    throw new Error(`Hub contract git_sha must be an immutable 40-character SHA, got ${lock.git_sha}`);
  }
  if (!KERNEL_VERSION.test(lock.kernel_version)) {
    throw new Error(`Hub contract kernel_version is invalid: ${lock.kernel_version}`);
  }

  const actualSha256 = createHash('sha256').update(contract).digest('hex');
  if (actualSha256 !== lock.sha256) {
    throw new Error(`Hub contract SHA-256 mismatch: lock=${lock.sha256} actual=${actualSha256}`);
  }

  console.log(`Hub contract verified: ${lock.git_sha} (${actualSha256})`);
  return lock;
}

function requireFile(path, hint) {
  if (!existsSync(path)) {
    throw new Error(`Required contract file not found: ${path}\n${hint}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
