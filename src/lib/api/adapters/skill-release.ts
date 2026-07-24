import {
  skillReleaseServiceCompareSkillRefs,
  skillReleaseServiceCreateSkillRelease,
  skillReleaseServiceGetSkillRelease,
  skillReleaseServiceListSkillCommits,
  skillReleaseServiceListSkillRefs,
  skillReleaseServiceResolveSkillRef,
  skillReleaseServiceResolveSkillRelease,
  skillReleaseServiceRestoreSkillRef,
} from '../generated/skill-release-service/skill-release-service';
import { skillServiceListSkillReleases } from '../generated/skill-service/skill-service';
import type {
  SkillReleaseServiceCompareSkillRefsParams,
  SkillReleaseServiceCreateSkillReleaseBody,
  SkillReleaseServiceListSkillCommitsParams,
  SkillReleaseServiceResolveSkillRefParams,
  SkillReleaseServiceRestoreSkillRefBody,
  V1SkillCommit,
  V1SkillComparison,
  V1SkillGitRef,
  V1SkillRef,
  V1SkillRelease,
} from '../generated/model';

export type SkillRelease = V1SkillRelease;
export type SkillRef = V1SkillRef;
export type SkillGitRef = V1SkillGitRef;
export type SkillCommit = V1SkillCommit;
export type SkillComparison = V1SkillComparison;
export type CreateSkillReleaseInput = SkillReleaseServiceCreateSkillReleaseBody;
export type ListSkillCommitsInput = SkillReleaseServiceListSkillCommitsParams;
export type CompareSkillRefsInput = SkillReleaseServiceCompareSkillRefsParams;
export type ResolveSkillRefInput = SkillReleaseServiceResolveSkillRefParams;
export type RestoreSkillRefInput = SkillReleaseServiceRestoreSkillRefBody;

/**
 * Adapter over protobuf/OpenAPI-generated release clients.
 *
 * Routes, request bodies, and response models are owned by Hub protobuf. The
 * generated client is synchronized from an immutable Hub commit and its
 * contract-lock SHA-256 is verified before Orval runs. This adapter only gives
 * the UI one stable domain entry point; it does not copy or reinterpret the
 * transport contract.
 */
export const skillReleaseApi = {
  resolveRef: (
    skillName: string,
    input: ResolveSkillRefInput = {},
  ): Promise<SkillRef> =>
    skillReleaseServiceResolveSkillRef(skillName, input),

  list: async (skillName: string): Promise<SkillRelease[]> => {
    const response = await skillServiceListSkillReleases(skillName);
    return response.releases ?? [];
  },

  create: (
    skillName: string,
    input: CreateSkillReleaseInput,
  ): Promise<SkillRelease> =>
    skillReleaseServiceCreateSkillRelease(skillName, input),

  get: (skillName: string, version: string): Promise<SkillRelease> =>
    skillReleaseServiceGetSkillRelease(skillName, version),

  resolve: (skillName: string, version: string): Promise<SkillRelease> =>
    skillReleaseServiceResolveSkillRelease(skillName, version),

  listRefs: async (skillName: string): Promise<SkillGitRef[]> => {
    const response = await skillReleaseServiceListSkillRefs(skillName);
    return response.refs ?? [];
  },

  listCommits: async (
    skillName: string,
    input: ListSkillCommitsInput = {},
  ): Promise<SkillCommit[]> => {
    const response = await skillReleaseServiceListSkillCommits(skillName, input);
    return response.commits ?? [];
  },

  compare: async (
    skillName: string,
    input: CompareSkillRefsInput,
  ): Promise<SkillComparison> => {
    const response = await skillReleaseServiceCompareSkillRefs(skillName, input);
    return response.comparison ?? {};
  },

  restore: async (
    skillName: string,
    input: RestoreSkillRefInput,
  ): Promise<SkillCommit> => {
    const response = await skillReleaseServiceRestoreSkillRef(skillName, input);
    return response.commit ?? {};
  },
};
