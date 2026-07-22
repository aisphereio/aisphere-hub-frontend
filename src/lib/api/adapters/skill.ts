/**
 * skillApi — adapter over the orval-generated SkillService client.
 *
 * The Git-native Hub refactor (PR #18) removed the entire version/draft/file
 * surface: there are no /versions, /draft/*, /files, :upload, :publish,
 * :submit, :online, :offline, /download, /compare endpoints. Skill content
 * lives in git and is edited through git/LFS, not REST. The adapter now only
 * exposes the surviving core CRUD + visibility surface:
 *
 *   list / detail / remove / update / draft / scope
 *
 * Mapping notes:
 *  - Generated V1Skill is a sparse proto shape (name/displayName/description/
 *    visibility/ownerId/orgId/projectId/defaultBranch/status/create/update).
 *    normalizeSkill() (from ./internal) rehydrates the UI's richer Skill
 *    domain type (scope/owner/labels/metadata) from manifestJson where present.
 *  - Skill display metadata is projected from SKILL.md. The legacy UpdateSkill
 *    endpoint remains in the generated contract for compatibility but the
 *    backend rejects direct name/description writes; callers should edit the
 *    file through Git and merge a pull request.
 *  - The create flow carries the repository name, an initial description used
 *    to seed SKILL.md, visibility, orgId and optional projectId.
 */
import {
  skillServiceCreateSkill,
  skillServiceDeleteSkill,
  skillServiceGetSkill,
  skillServiceListSkills,
  skillServiceUpdateSkill,
  skillServiceUpdateSkillVisibility,
} from '../generated/skill-service/skill-service';
import type { V1Skill } from '../generated/model';
import type { Page, Skill, SkillDraft } from '../types';
import {
  manifestJsonForUpdate,
  mergeUniqueTags,
  normalizeSkill,
  normalizeSkillPage,
} from './internal';

function toNum(v: unknown): number | undefined {
  if (v === undefined || v === null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function toSkill(s: V1Skill): Skill {
  // V1Skill lacks versions/keywords/bizTags/manifestJson; normalizeSkill fills
  // defaults (empty versions, scope from visibility, owner from ownerId).
  return normalizeSkill({
    ...s,
    versions: [],
  } as Skill);
}

export const skillApi = {
  list: async (params: Record<string, unknown> = {}) => {
    const reply = await skillServiceListSkills({
      pageSize: toNum(params.pageSize ?? params.page_size) as
        | number
        | undefined,
      pageToken: (params.pageToken ?? params.page_token) as
        | string
        | undefined,
      query: (params.q ?? params.query ?? params.search ?? params.keyword) as
        | string
        | undefined,
      visibility: (params.visibility ?? params.scope) as string | undefined,
    });
    const page = {
      items: (reply.skills || []).map(toSkill),
      skills: (reply.skills || []).map(toSkill),
      nextPageToken: reply.nextPageToken,
    } as Page<Skill>;
    return normalizeSkillPage(page);
  },

  detail: async (skillName: string) => {
    // The Git-native Hub has no /versions endpoint. Detail is just GetSkill;
    // normalizeSkill leaves versions empty. (Previously this used
    // Promise.all with ListSkillVersions, which 404'd and rejected the whole
    // detail load — the root cause of the "未找到 Skill" symptom.)
    const skill = await skillServiceGetSkill(skillName);
    return toSkill(skill);
  },

  remove: (skillName: string) =>
    skillServiceDeleteSkill(skillName).then(() => '') as Promise<string>,

  update: async (skillName: string, data: Partial<Skill>) => {
    // The backend PUT is not a sparse PATCH: protobuf default values make
    // omitted strings indistinguishable from empty strings. Always merge
    // with current detail first, so settings panels do not accidentally
    // reset visibility/status. The new UpdateSkillBody only carries
    // displayName/description; other Skill fields are local-only.
    const current = toSkill(await skillServiceGetSkill(skillName));
    const tags = mergeUniqueTags(
      (data as any).tags ?? current.tags,
      data.keywords ?? current.keywords,
      data.bizTags ?? current.bizTags,
    );
    const updated = await skillServiceUpdateSkill(skillName, {
      displayName: data.displayName ?? current.displayName ?? '',
      description: data.description ?? current.description ?? '',
    });
    // Re-attach locally-tracked fields the backend does not echo back, so the
    // returned Skill stays usable for the editor/settings panels.
    const merged = toSkill(updated);
    return normalizeSkill({
      ...merged,
      tags: tags.length ? tags : merged.tags,
      metadata: data.metadata ?? current.metadata,
      labels: data.labels ?? current.labels,
      manifestJson: manifestJsonForUpdate(current, data),
    });
  },

  draft: async (data: SkillDraft) => {
    // New CreateSkillRequest: name/displayName/description/visibility/orgId/
    // projectId only. version/status/manifestJson/tags are not accepted.
    if (!data.orgId) {
      throw new Error('Skill draft requires an orgId');
    }
    const created = await skillServiceCreateSkill({
      name: data.name,
      displayName: data.displayName,
      description: data.description,
      visibility: data.visibility || data.scope || 'private',
      orgId: data.orgId,
      projectId: data.projectId,
    });
    return toSkill(created);
  },

  updateDraft: (data: SkillDraft) =>
    skillApi.update(data.name, {
      name: data.name,
      displayName: data.displayName,
      description: data.description,
      visibility: data.scope as Skill['visibility'],
      metadata: data.metadata,
      tags: [...(data.keywords || []), ...(data.bizTags || [])],
    }),

  deleteDraft: (skillName: string) => skillApi.remove(skillName),

  scope: async (skillName: string, scope: string) => {
    const visibility = String(scope || '').toLowerCase();
    if (!['private', 'internal', 'public'].includes(visibility)) {
      throw new Error(
        'Skill visibility must be private, internal, or public',
      );
    }
    const updated = await skillServiceUpdateSkillVisibility(skillName, {
      visibility,
    });
    return toSkill(updated);
  },
};
