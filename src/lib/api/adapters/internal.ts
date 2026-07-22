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
  // The Hub backend's default JSON codec emits snake_case struct tags
  // (owner_id, create_time, update_time) rather than the camelCase the
  // generated types expect. Reconcile both shapes so the detail panel
  // renders owner and timestamps regardless of codec.
  const raw = skill as any;
  const ownerId = skill.ownerId || raw.owner_id;
  const createTime = skill.createTime ?? raw.create_time;
  const updateTime = skill.updateTime ?? raw.update_time;
  return {
    ...skill,
    ownerId,
    createTime,
    updateTime,
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
    owner: skill.owner || ownerId,
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
  relation?: string;
} {
  // Format: subjectType:subjectId[:relation]. The relation segment was added
  // when the Git-native Hub's DeleteSkillShare grew a `relation` path param
  // (/v1/skills/{name}/shares/{relation}/{subjectType}/{subjectId}). Older
  // grant ids without it still parse; callers default the relation.
  const parts = grantId.split(':');
  if (parts.length === 1) return { subjectType: 'user', subjectId: grantId };
  const [subjectType, subjectId, relation] = parts;
  return {
    subjectType: subjectType || 'user',
    subjectId: subjectId ?? '',
    relation: relation || undefined,
  };
}

/** Build a ResourceGrant id from subject parts, matching parseGrantId. */
export function buildGrantId(
  subjectType: string,
  subjectId: string,
  relation?: string,
): string {
  return relation
    ? `${subjectType}:${subjectId}:${relation}`
    : `${subjectType}:${subjectId}`;
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
