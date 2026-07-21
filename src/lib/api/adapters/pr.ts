/**
 * prApi — adapter over the orval-generated skill-service pull-request
 * endpoints. The generated client returns the raw V1PullRequest proto
 * shape (every field optional, state as a free-form string); this
 * adapter coerces it into the PullRequest domain type so UI code can
 * switch on state without null checks.
 *
 * PRs are the publish path for skills whose default branch is locked:
 * authors push a source branch (via git or the file API with a branch
 * param) and open a PR into the default branch. Merge requires the
 * caller to pass the expected target sha so two concurrent merges
 * can't both land.
 */
import {
  skillServiceClosePullRequest,
  skillServiceCreatePullRequest,
  skillServiceGetPullRequest,
  skillServiceListPullRequests,
  skillServiceMergePullRequest,
} from "../generated/skill-service/skill-service";
import type {
  SkillServiceClosePullRequestBody,
  SkillServiceCreatePullRequestBody,
  SkillServiceListPullRequestsParams,
  SkillServiceMergePullRequestBody,
  V1ListPullRequestsResponse,
  V1PullRequest,
} from "../generated/model";
import type { PullRequest } from "../types";

function normState(s: string | undefined): PullRequest["state"] {
  switch (s) {
    case "open":
    case "merged":
    case "closed":
      return s;
    default:
      // The backend uses "" / unset for freshly-opened PRs; treat
      // anything unknown as open so the UI offers merge/close actions.
      return "open";
  }
}

function toPR(p: V1PullRequest): PullRequest {
  return {
    id: p.id ?? "",
    skillName: p.skillName ?? "",
    sourceRef: p.sourceRef ?? "",
    targetRef: p.targetRef ?? "",
    sourceSha: p.sourceSha ?? "",
    targetSha: p.targetSha ?? "",
    title: p.title ?? "",
    description: p.description ?? "",
    state: normState(p.state),
    authorId: p.authorId ?? "",
    mergedSha: p.mergedSha ?? "",
    createTime: p.createTime,
    updateTime: p.updateTime,
    mergedTime: p.mergedTime,
  };
}

export type CreatePullRequestInput = {
  sourceRef: string;
  title: string;
  description?: string;
};

export type MergePullRequestInput = {
  /** The target sha the caller last saw; rejects if it moved. */
  expectedTargetSha: string;
};

export const prApi = {
  /** List PRs on a skill. state filter is optional ("open"/"merged"/"closed"). */
  list: async (
    skillName: string,
    params: { state?: string; pageSize?: number; pageToken?: string } = {},
  ): Promise<{ items: PullRequest[]; nextPageToken?: string }> => {
    const reply: V1ListPullRequestsResponse =
      await skillServiceListPullRequests(skillName, {
        state: params.state,
        pageSize: params.pageSize,
        pageToken: params.pageToken,
      } as SkillServiceListPullRequestsParams);
    const items = (reply.pullRequests ?? []).map(toPR);
    return { items, nextPageToken: reply.nextPageToken };
  },

  /** Fetch a single PR by id. */
  get: async (skillName: string, id: string): Promise<PullRequest> => {
    const reply: V1PullRequest = await skillServiceGetPullRequest(skillName, id);
    return toPR(reply);
  },

  /** Open a new PR from sourceRef into the skill's default branch. */
  create: async (
    skillName: string,
    input: CreatePullRequestInput,
  ): Promise<PullRequest> => {
    const body: SkillServiceCreatePullRequestBody = {
      sourceRef: input.sourceRef,
      title: input.title,
      description: input.description,
    };
    const reply: V1PullRequest = await skillServiceCreatePullRequest(
      skillName,
      body,
    );
    return toPR(reply);
  },

  /**
   * Merge a PR. expectedTargetSha is the PR's current targetSha; the
   * server rejects the merge if the target moved (someone merged
   * another PR first), surfacing as a 409.
   */
  merge: async (
    skillName: string,
    id: string,
    input: MergePullRequestInput,
  ): Promise<PullRequest> => {
    const body: SkillServiceMergePullRequestBody = {
      expectedTargetSha: input.expectedTargetSha,
    };
    const reply: V1PullRequest = await skillServiceMergePullRequest(
      skillName,
      id,
      body,
    );
    return toPR(reply);
  },

  /** Close a PR without merging (e.g. rejected or superseded). */
  close: async (skillName: string, id: string): Promise<PullRequest> => {
    const body: SkillServiceClosePullRequestBody = {};
    const reply: V1PullRequest = await skillServiceClosePullRequest(
      skillName,
      id,
      body,
    );
    return toPR(reply);
  },
};
