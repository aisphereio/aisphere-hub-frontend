#!/usr/bin/env node

/**
 * sync-contract.mjs
 *
 * Syncs the Hub OpenAPI contract from the aisphere-hub repository.
 *
 * Usage:
 *   node scripts/sync-contract.mjs                    # sync from main branch
 *   node scripts/sync-contract.mjs --ref v0.4.2        # sync from a tag
 *   node scripts/sync-contract.mjs --ref <git-sha>     # sync from a specific commit
 *   node scripts/sync-contract.mjs --local ../aisphere-hub  # sync from local checkout
 *
 * The script:
 *   1. Downloads aisphere-hub.swagger.json and contract-lock.json
 *   2. Verifies the contract-lock.json integrity
 *   3. Runs orval to regenerate the TypeScript client
 *   4. Reports the diff summary
 */

import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const openapiDir = join(root, 'openapi');
const swaggerPath = join(openapiDir, 'aisphere-hub.swagger.json');
const lockPath = join(openapiDir, 'contract-lock.json');

const HUB_REPO = 'https://raw.githubusercontent.com/aisphereio/aisphere-hub';
const TRUSTED_REPOSITORY = 'https://github.com/aisphereio/aisphere-hub.git';
const KERNEL_VERSION = 'v0.4.2';

async function main() {
  const args = process.argv.slice(2);
  let ref = 'main';
  let localPath = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--ref' && i + 1 < args.length) {
      ref = args[++i];
    } else if (args[i] === '--local' && i + 1 < args.length) {
      localPath = args[++i];
    }
  }

  // Ensure openapi directory exists
  await mkdir(openapiDir, { recursive: true });

  // Download or copy the contract files
  if (localPath) {
    console.log(`Syncing from local repository: ${localPath}`);
    const localSwagger = join(localPath, 'docs', 'openapi', 'aisphere-hub.swagger.json');
    const localLock = join(localPath, 'dist', 'api-contract', 'contract-lock.json');

    if (!existsSync(localSwagger)) {
      console.error(`Local swagger not found at ${localSwagger}`);
      console.error('Run "make contract-bundle" in the hub repository first.');
      process.exit(1);
    }

    execSync(`cp "${localSwagger}" "${swaggerPath}"`, { stdio: 'inherit' });

    if (existsSync(localLock)) {
      execSync(`cp "${localLock}" "${lockPath}"`, { stdio: 'inherit' });
    } else {
      // Generate lock from local git info
      const gitSha = execSync('git rev-parse HEAD', { cwd: localPath, encoding: 'utf8' }).trim();
      const gitRef = execSync('git symbolic-ref --short HEAD', { cwd: localPath, encoding: 'utf8' }).trim();
      const swaggerContent = await readFile(swaggerPath);
      const sha256 = createHash('sha256').update(swaggerContent).digest('hex');
      const lock = {
        repository: TRUSTED_REPOSITORY,
        git_sha: gitSha,
        ref: gitRef,
        sha256,
        kernel_version: KERNEL_VERSION,
        generator: 'protoc-gen-openapiv2@v2.29.0',
      };
      await writeFile(lockPath, JSON.stringify(lock, null, 2) + '\n');
    }
  } else {
    console.log(`Syncing contract from ${HUB_REPO} (ref: ${ref})`);

    const swaggerUrl = `${HUB_REPO}/${ref}/docs/openapi/aisphere-hub.swagger.json`;
    const lockUrl = `${HUB_REPO}/${ref}/dist/api-contract/contract-lock.json`;

    try {
      const swaggerResp = await fetch(swaggerUrl);
      if (!swaggerResp.ok) {
        throw new Error(`Failed to download swagger: ${swaggerResp.status} ${swaggerResp.statusText}`);
      }
      const swaggerText = await swaggerResp.text();
      await writeFile(swaggerPath, swaggerText);
    } catch (err) {
      console.error(`Failed to download swagger from ${swaggerUrl}`);
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }

    try {
      const lockResp = await fetch(lockUrl);
      if (lockResp.ok) {
        const lockText = await lockResp.text();
        await writeFile(lockPath, lockText);
      } else {
        console.warn(`contract-lock.json not available at ${lockUrl} (${lockResp.status}), generating locally`);
        await generateLock(ref);
      }
    } catch {
      console.warn('Could not fetch contract-lock.json, generating locally');
      await generateLock(ref);
    }
  }

  // Verify the contract
  console.log('\nVerifying contract...');
  const contract = await readFile(swaggerPath);
  const lockSource = await readFile(lockPath, 'utf8');
  const lock = JSON.parse(lockSource);

  for (const field of ['repository', 'git_sha', 'ref', 'sha256', 'kernel_version', 'generator']) {
    if (typeof lock[field] !== 'string' || lock[field].trim() === '') {
      throw new Error(`contract-lock.json is missing ${field}`);
    }
  }
  if (lock.repository !== TRUSTED_REPOSITORY) {
    throw new Error(`Hub contract must come from ${TRUSTED_REPOSITORY}, got ${lock.repository}`);
  }

  const actual = createHash('sha256').update(contract).digest('hex');
  if (actual !== lock.sha256) {
    throw new Error(`Hub contract SHA-256 mismatch: lock=${lock.sha256} actual=${actual}`);
  }

  console.log(`Hub contract verified: ${lock.git_sha} (${actual})`);

  // Regenerate Orval client
  console.log('\nRegenerating TypeScript client with Orval...');
  execSync('npx orval --config orval.config.ts', { cwd: root, stdio: 'inherit' });

  console.log('\n✓ Contract sync complete!');
  console.log(`  Source: ${lock.repository} @ ${lock.git_sha.slice(0, 8)}`);
  console.log(`  Swagger SHA-256: ${lock.sha256}`);
  console.log(`  Generated: src/lib/api/generated/`);
  console.log('\nRun `git diff --stat` to review changes before committing.');
}

async function generateLock(ref) {
  const swaggerContent = await readFile(swaggerPath);
  const sha256 = createHash('sha256').update(swaggerContent).digest('hex');
  const lock = {
    repository: TRUSTED_REPOSITORY,
    git_sha: ref,
    ref,
    sha256,
    kernel_version: KERNEL_VERSION,
    generator: 'protoc-gen-openapiv2@v2.29.0',
  };
  await writeFile(lockPath, JSON.stringify(lock, null, 2) + '\n');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
