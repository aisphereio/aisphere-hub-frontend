/**
 * Shared helpers used by the generated-backed adapters.
 *
 * These were lifted verbatim from the hand-written `src/lib/api/index.ts` so
 * the adapters can preserve the exact normalization behavior the UI relies
 * on (manifest merging, tag dedup, share-role mapping, grant-id round-trip)
 * while calling the orval-generated SDK under the hood.
 */
import type {
  Skill,
  Page,
  ResourceGrant,
  AihubResourceType,
  AccessMode,
} from '../types';
import { deriveAccessMode } from '../types';

export function parseJsonRecord(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'object') return value as Record<string, unknown>;
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

export function normalizeTags(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string')
    return value
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
  return [];
}

export function mergeUniqueTags(...sources: unknown[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const source of sources) {
    for (const tag of normalizeTags(source)) {
      if (!seen.has(tag)) {
        seen.add(tag);
        out.push(tag);
      }
    }
  }
  return out;
}

export function stringRecord(
  value: unknown,
): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v !== undefined && v !== null) out[k] = String(v);
  }
  return Object.keys(out).length ? out : undefined;
}

export function contentTypeForPath(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith('.md') || lower.endsWith('.markdown'))
    return 'text/markdown; charset=utf-8';
  if (lower.endsWith('.json')) return 'application/json; charset=utf-8';
  if (lower.endsWith('.yaml') || lower.endsWith('.yml'))
    return 'application/yaml; charset=utf-8';
  if (lower.endsWith('.py')) return 'text/x-python; charset=utf-8';
  if (lower.endsWith('.js') || lower.endsWith('.ts'))
    return 'text/javascript; charset=utf-8';
  return 'text/plain; charset=utf-8';
}

export async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export function normalizeSkill(skill: Skill): Skill {
  const manifest = parseJsonRecord(skill.manifestJson);
  const manifestLabels = stringRecord((manifest as any).labels);
  const tags = mergeUniqueTags(
    (skill as any).tags,
    skill.keywords,
    skill.bizTags,
  );
  const versions = [...(skill.versions || [])].sort((a, b) =>
    String(b.version).localeCompare(String(a.version)),
  );
  const onlineVersion = versions.find((v) => v.status === 'online')?.version;
  return {
    ...skill,
    versions,
    labels: skill.labels || manifestLabels,
    metadata:
      skill.metadata ||
      ((manifest as any).metadata as Record<string, unknown>) ||
      manifest,
    tags,
    bizTags: skill.bizTags || tags,
    keywords: skill.keywords || tags,
    scope: skill.scope || skill.visibility || 'private',
    owner: skill.owner || skill.ownerId,
    latestVersion:
      skill.latestVersion || skill.version || versions[0]?.version,
    stableVersion: skill.stableVersion || onlineVersion || skill.version,
    onlineVersion: skill.onlineVersion || onlineVersion,
  };
}

export function normalizeSkillPage(page: Page<Skill>): Page<Skill> {
  const items = (page.items ??
    page.skills ??
    page.list ??
    page.data ??
    page.pageItems ??
    []) as Skill[];
  return {
    ...page,
    items: items.map(normalizeSkill),
    skills: page.skills ? page.skills.map(normalizeSkill) : undefined,
  };
}

export function manifestJsonForUpdate(
  current: Skill,
  data: Partial<Skill>,
): string {
  if (
    data.manifestJson !== undefined &&
    data.metadata === undefined &&
    data.labels === undefined
  )
    return data.manifestJson;
  const manifest = parseJsonRecord(
    data.manifestJson ?? current.manifestJson,
  );
  if (data.metadata !== undefined) {
    manifest.metadata = data.metadata;
  }
  if (data.labels !== undefined) {
    manifest.labels = data.labels;
  }
  return JSON.stringify(manifest);
}

// ─── Share helpers ──────────────────────────────────────────────────────

export function normalizeShareRole(
  role: string | undefined,
): ResourceGrant['role'] {
  if (role === 'consumer') return 'consumer';
  if (role === 'runner') return 'consumer';
  if (
    role === 'editor' ||
    role === 'reviewer' ||
    role === 'admin' ||
    role === 'owner'
  )
    return role;
  return 'viewer';
}

export function toBackendShareRole(
  resourceType: AihubResourceType,
  role: ResourceGrant['role'],
): string {
  // The new Skill backend currently defines viewer/consumer/editor/owner.
  if (resourceType === 'skill') {
    if (role === 'runner') return 'consumer';
    if (role === 'admin') return 'owner';
  }
  return role;
}

export function parseGrantId(grantId: string): {
  subjectType: string;
  subjectId: string;
} {
  const idx = grantId.indexOf(':');
  if (idx < 0) return { subjectType: 'user', subjectId: grantId };
  return {
    subjectType: grantId.slice(0, idx),
    subjectId: grantId.slice(idx + 1),
  };
}

/** Build a ResourceGrant id from subject parts, matching parseGrantId. */
export function buildGrantId(subjectType: string, subjectId: string): string {
  return `${subjectType}:${subjectId}`;
}

export function publicGrant(
  resourceType: AihubResourceType,
  resourceId: string,
): ResourceGrant {
  return {
    id: buildGrantId('public', '*'),
    app: 'aihub',
    resourceType,
    resourceId,
    object: `${resourceType}:${resourceId}`,
    subjectType: 'public',
    subjectId: '*',
    role: 'viewer',
    effect: 'allow',
    actions: [],
  };
}

export { deriveAccessMode };
export type { AccessMode };
