import { request, toQuery } from './client';
import type { Page, SkillSet } from './types';

export type LightweightSkillSetMember = {
  skillName: string;
  order: number;
};

export type LightweightSkillSetUpdate = {
  displayName?: string;
  description?: string;
  visibility?: 'private' | 'internal' | 'public';
  labels?: Record<string, string>;
  members?: LightweightSkillSetMember[];
};

/**
 * Lightweight SkillSet API.
 *
 * A SkillSet only keeps ordered Skill references. It never pins a Skill
 * version and does not carry runtime, required/optional or release state.
 */
export const lightweightSkillSetApi = {
  list: (params: Record<string, unknown> = {}) =>
    request<Page<SkillSet>>(`/v1/skillsets?${toQuery(params)}`),

  detail: (skillSetName: string) =>
    request<SkillSet>(`/v1/skillsets/${encodeURIComponent(skillSetName)}`),

  create: (skillSet: SkillSet) =>
    request<SkillSet>('/v1/skillsets', {
      method: 'POST',
      body: JSON.stringify({
        name: skillSet.name,
        displayName: skillSet.displayName,
        description: skillSet.description,
        visibility: skillSet.scope,
        labels: skillSet.labels,
        members: (skillSet.members || []).map((member, index) => ({
          skillName: member.skillName,
          order: member.order ?? index,
        })),
      }),
    }),

  update: (skillSetName: string, update: LightweightSkillSetUpdate) =>
    request<SkillSet>(`/v1/skillsets/${encodeURIComponent(skillSetName)}`, {
      method: 'PUT',
      body: JSON.stringify(update),
    }),

  remove: (skillSetName: string) =>
    request<Record<string, never>>(`/v1/skillsets/${encodeURIComponent(skillSetName)}`, {
      method: 'DELETE',
    }),

  replaceMembers: (skillSetName: string, members: LightweightSkillSetMember[]) =>
    lightweightSkillSetApi.update(skillSetName, {
      members: members.map((member, index) => ({
        skillName: member.skillName,
        order: index,
      })),
    }),

  ofSkill: (skillName: string) =>
    request<{ skillsets: string[] }>(
      `/v1/skills/${encodeURIComponent(skillName)}/skillsets`,
    ),
};
