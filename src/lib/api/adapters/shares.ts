/**
 * sharesApi — adapter over the orval-generated SkillService share RPCs.
 *
 * Preserves the hand-written module's public signatures (list, create,
 * remove, listSkillShares, createSkillShare, deleteSkillShare) so consumers
 * keep importing from ../index unchanged.
 *
 * Skill shares are backed by the generated client (/v1/skills/{name}/shares).
 * Non-skill resources (agent/tool/workflow) are NOT yet in the new hub and
 * return empty / throw exactly as the hand-written module did.
 *
 * The "public" share is modeled as skill visibility, not a tuple: create/
 * remove with subjectType "public" delegate to UpdateSkillVisibility.
 */
import {
  skillServiceCreateSkillShare,
  skillServiceDeleteSkillShare,
  skillServiceGetSkill,
  skillServiceListSkillShares,
  skillServiceUpdateSkillVisibility,
} from '../generated/skill-service/skill-service';
import type { V1SkillShare } from '../generated/model';
import type {
  AihubResourceType,
  CreateShareRequest,
  ResourceGrant,
  ShareListResponse,
  Skill,
} from '../types';
import {
  buildGrantId,
  deriveAccessMode,
  normalizeShareRole,
  parseGrantId,
  publicGrant,
  toBackendShareRole,
} from './internal';

function shareToGrant(s: V1SkillShare, resourceId: string): ResourceGrant {
  const relation = s.relation || 'viewer';
  return {
    id: buildGrantId(s.subjectType || 'user', s.subjectId || '', relation),
    app: 'aihub',
    resourceType: 'skill',
    resourceId,
    object: `skill:${resourceId}`,
    subjectType: (s.subjectType || 'user') as ResourceGrant['subjectType'],
    subjectId: s.subjectId || '',
    role: normalizeShareRole(relation),
    effect: 'allow',
    actions: [],
  };
}

function visibilityOf(skill: Skill | null): 'private' | 'internal' | 'public' {
  return String(skill?.visibility || skill?.scope || 'private').toLowerCase() as
    | 'private'
    | 'internal'
    | 'public';
}

export const sharesApi = {
  list: async (
    resourceType: AihubResourceType,
    resourceId: string,
    _params: Record<string, unknown> = {},
  ) => {
    if (resourceType !== 'skill') {
      // Non-skill resources not yet supported in new hub.
      return {
        items: [],
        total: 0,
        accessMode: 'private',
        canManage: false,
      } as ShareListResponse;
    }
    const [reply, skill] = await Promise.all([
      skillServiceListSkillShares(resourceId),
      skillServiceGetSkill(resourceId).catch(() => null),
    ]);
    const items: ResourceGrant[] = (reply.shares || []).map((s) =>
      shareToGrant(s, resourceId),
    );
    const visibility = visibilityOf(skill as Skill | null);
    if (
      visibility === 'public' &&
      !items.some((x) => x.subjectType === 'public')
    ) {
      items.unshift(publicGrant('skill', resourceId));
    }
    return {
      items,
      total: items.length,
      visibility,
      governingOrgId: skill?.orgId,
      accessMode:
        visibility === 'public'
          ? 'public'
          : visibility === 'internal'
            ? 'internal'
            : deriveAccessMode(items),
    } as ShareListResponse;
  },

  create: async (
    resourceType: AihubResourceType,
    resourceId: string,
    body: CreateShareRequest,
  ) => {
    if (resourceType !== 'skill') {
      throw new Error(
        `sharing for ${resourceType} not yet supported in new hub`,
      );
    }
    if (body.subjectType === 'public') {
      await skillServiceUpdateSkillVisibility(resourceId, {
        visibility: 'public',
      });
      return publicGrant('skill', resourceId);
    }
    const relation = toBackendShareRole(resourceType, body.role);
    const raw = await skillServiceCreateSkillShare(resourceId, {
      relation,
      subjectType: body.subjectType,
      subjectId: body.subjectId,
      subjectRelation: body.subjectRelation,
    });
    const resolvedRelation = raw.relation || relation;
    return {
      id: buildGrantId(
        raw.subjectType || body.subjectType,
        raw.subjectId || body.subjectId,
        resolvedRelation,
      ),
      app: 'aihub',
      resourceType: 'skill',
      resourceId,
      object: `skill:${resourceId}`,
      subjectType: (raw.subjectType ||
        body.subjectType) as ResourceGrant['subjectType'],
      subjectId: raw.subjectId || body.subjectId,
      role: normalizeShareRole(resolvedRelation),
      effect: 'allow',
      actions: [],
    } as ResourceGrant;
  },

  remove: (
    resourceType: AihubResourceType,
    resourceId: string,
    grantId: string,
  ) => {
    if (resourceType !== 'skill') {
      throw new Error(
        `sharing for ${resourceType} not yet supported in new hub`,
      );
    }
    const { subjectType, subjectId, relation } = parseGrantId(grantId);
    if (subjectType === 'public') {
      return skillServiceUpdateSkillVisibility(resourceId, {
        visibility: 'private',
      });
    }
    // New Hub DeleteSkillShare path is
    // /v1/skills/{name}/shares/{relation}/{subjectType}/{subjectId}; the
    // relation is required. Fall back to 'viewer' for legacy grant ids that
    // predate the relation segment (the backend will reject if the tuple
    // does not match, which is the correct behavior).
    return skillServiceDeleteSkillShare(
      resourceId,
      relation || 'viewer',
      subjectType,
      subjectId,
    );
  },

  listSkillShares: (skillName: string) => sharesApi.list('skill', skillName),
  createSkillShare: (skillName: string, body: CreateShareRequest) =>
    sharesApi.create('skill', skillName, body),
  deleteSkillShare: (skillName: string, grantId: string) =>
    sharesApi.remove('skill', skillName, grantId),
};
