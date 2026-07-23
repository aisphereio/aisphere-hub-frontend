import {
  skillReleaseServiceCreateSkillRelease,
  skillReleaseServiceGetSkillRelease,
  skillReleaseServiceResolveSkillRelease,
} from '../generated/skill-release-service/skill-release-service';
import { skillServiceListSkillReleases } from '../generated/skill-service/skill-service';
import type {
  SkillReleaseServiceCreateSkillReleaseBody,
  V1SkillRelease,
} from '../generated/model';

export type SkillRelease = V1SkillRelease;
export type CreateSkillReleaseInput = SkillReleaseServiceCreateSkillReleaseBody;

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
};
