import { request, toQuery } from "./client";
import { deriveAccessMode } from "./types";
import type {
  Page,
  Proposal,
  Skill,
  SkillSet,
  AgentListItem,
  AgentResponse,
  AgentRuntimeSnapshot,
  AgentServiceRef,
  AgentUpsertRequest,
  RuntimeServicesSnapshot,
  SandboxEnsureRequest,
  SandboxStatus,
  SandboxToolCallRequest,
  SandboxToolCallResult,
  SandboxToolListResponse,
  ToolFailureRecord,
  ToolListItem,
  ToolResponse,
  ToolRuntimeSnapshot,
  ToolUpsertRequest,
  LocalUser,
  SkillFileList,
  SkillFileContent,
  SkillVersionCompare,
  SkillPackageDownload,
  SkillSocialStats,
  AuditLog,
  TokenInfo,
  MetricsSnapshot,
  Notification,
  NamespaceInfo,
  NamespaceMember,
  SkillDraft,
  SkillSetUpdate,
  AccessEvaluateResult,
  AccessOverview,
  AccessResourceTemplate,
  AccessQuickLink,
  SandboxProfile,
  ModelProfile,
  ResourceGrant,
  CreateShareRequest,
  ShareListResponse,
  AihubResourceType,
} from "./types";

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function parseJsonRecord(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "object") return value as Record<string, unknown>;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

function normalizeTags(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string")
    return value
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  return [];
}

function mergeUniqueTags(...sources: unknown[]): string[] {
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

function stringRecord(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v !== undefined && v !== null) out[k] = String(v);
  }
  return Object.keys(out).length ? out : undefined;
}

function normalizeSkill(skill: Skill): Skill {
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
  const onlineVersion = versions.find((v) => v.status === "online")?.version;
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
    scope: skill.scope || skill.visibility || "private",
    owner: skill.owner || skill.ownerId,
    latestVersion: skill.latestVersion || skill.version || versions[0]?.version,
    stableVersion: skill.stableVersion || onlineVersion || skill.version,
    onlineVersion: skill.onlineVersion || onlineVersion,
  };
}

function normalizeSkillPage(page: Page<Skill>): Page<Skill> {
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

function manifestJsonForUpdate(current: Skill, data: Partial<Skill>): string {
  if (
    data.manifestJson !== undefined &&
    data.metadata === undefined &&
    data.labels === undefined
  )
    return data.manifestJson;
  const manifest = parseJsonRecord(data.manifestJson ?? current.manifestJson);
  if (data.metadata !== undefined) {
    manifest.metadata = data.metadata;
  }
  if (data.labels !== undefined) {
    manifest.labels = data.labels;
  }
  return JSON.stringify(manifest);
}

export const authApi = {
  exchange: async (code: string, redirectUri: string, state = "") => {
    const raw = await request<{
      accessToken?: string;
      refreshToken?: string;
      idToken?: string;
      access_token?: string;
      refresh_token?: string;
      id_token?: string;
      tokenType?: string;
      token_type?: string;
      expiresIn?: number;
      expires_in?: number;
      scope?: string;
    }>("/v3/auth/exchange", {
      method: "POST",
      body: JSON.stringify({ code, redirectUri, state }),
    });
    return {
      accessToken: raw.accessToken || raw.access_token || "",
      refreshToken: raw.refreshToken || raw.refresh_token || "",
      idToken: raw.idToken || raw.id_token || "",
      tokenType: raw.tokenType || raw.token_type || "",
      expiresIn: raw.expiresIn || raw.expires_in || 0,
      scope: raw.scope || "",
    };
  },
  loginUrl: (redirectUri: string, state = "") =>
    request<{ loginUrl?: string; login_url?: string }>(
      `/v3/auth/login-url?${toQuery({ redirectUri, state })}`,
    ),
  me: () => request<Record<string, unknown>>("/v3/auth/me"),
};

export const accessApi = {
  overview: () => request<AccessOverview>("/v3/admin/access/overview"),
  resources: () =>
    request<Page<AccessResourceTemplate>>("/v3/admin/access/resources"),
  links: () => request<Page<AccessQuickLink>>("/v3/admin/access/links"),
  evaluate: (subject: string, object: string, action: string) =>
    request<AccessEvaluateResult>("/v3/admin/access/evaluate", {
      method: "POST",
      body: JSON.stringify({ subject, object, action }),
    }),
};

export const skillApi = {
  list: async (params: Record<string, unknown> = {}) => {
    const q = toQuery({
      pageSize: params.pageSize ?? params.page_size,
      pageToken: params.pageToken ?? params.page_token,
      q: params.q ?? params.search ?? params.keyword,
      status: params.status,
      visibility: params.visibility ?? params.scope,
    });
    const page = await request<Page<Skill>>(
      `/v3/aihub/skills${q ? `?${q}` : ""}`,
    );
    return normalizeSkillPage(page);
  },
  detail: async (skillName: string) => {
    const name = encodeURIComponent(skillName);
    const [skill, versions] = await Promise.all([
      request<Skill>(`/v3/aihub/skills/${name}`),
      request<{ versions?: Skill["versions"] }>(
        `/v3/aihub/skills/${name}/versions`,
      ),
    ]);
    return normalizeSkill({ ...skill, versions: versions.versions || [] });
  },
  version: (skillName: string, version: string) =>
    request<unknown>(
      `/v3/aihub/skills/${encodeURIComponent(skillName)}/versions/${encodeURIComponent(version)}`,
    ),
  upload: async (
    file: File,
    overwrite = true,
    targetVersion = "",
    commitMsg = "",
  ) =>
    request<string>("/v3/aihub/skills:upload", {
      method: "POST",
      body: JSON.stringify({
        packageBytes: await fileToBase64(file),
        overwrite,
        targetVersion,
        commitMsg,
      }),
    }),
  batchUpload: async (files: File[], overwrite = true) => {
    const versions: string[] = [];
    for (const file of files) {
      versions.push(await skillApi.upload(file, overwrite));
    }
    return versions.join(",");
  },
  remove: (skillName: string) =>
    request<string>(`/v3/aihub/skills/${encodeURIComponent(skillName)}`, {
      method: "DELETE",
    }),
  publish: (skillName: string, version: string) =>
    request<string>(
      `/v3/aihub/skills/${encodeURIComponent(skillName)}/versions/${encodeURIComponent(version)}:publish`,
      { method: "POST", body: "{}" },
    ),
  submit: (skillName: string, version: string) =>
    request<string>(
      `/v3/aihub/skills/${encodeURIComponent(skillName)}/versions/${encodeURIComponent(version)}:submit`,
      { method: "POST", body: "{}" },
    ),
  online: (skillName: string, version: string) =>
    request<string>(
      `/v3/aihub/skills/${encodeURIComponent(skillName)}/versions/${encodeURIComponent(version)}:online`,
      { method: "POST", body: "{}" },
    ),
  offline: (skillName: string, version: string) =>
    request<string>(
      `/v3/aihub/skills/${encodeURIComponent(skillName)}/versions/${encodeURIComponent(version)}:offline`,
      { method: "POST", body: "{}" },
    ),
  labels: (skillName: string, labels: Record<string, string>) =>
    skillApi.update(skillName, { name: skillName, labels }),
  downloadUrl: (skillName: string, version: string) =>
    `/v3/aihub/skills/${encodeURIComponent(skillName)}/versions/${encodeURIComponent(version)}/download`,
  download: (skillName: string, version: string) =>
    request<SkillPackageDownload>(
      `/v3/aihub/skills/${encodeURIComponent(skillName)}/versions/${encodeURIComponent(version)}/download`,
    ),
  files: (skillName: string, version: string) =>
    request<SkillFileList>(
      `/v3/aihub/skills/${encodeURIComponent(skillName)}/versions/${encodeURIComponent(version)}/files`,
    ),
  file: (skillName: string, version: string, path: string) =>
    request<SkillFileContent>(
      `/v3/aihub/skills/${encodeURIComponent(skillName)}/versions/${encodeURIComponent(version)}/file?${toQuery({ path })}`,
    ),
  compare: (skillName: string, baseVersion: string, targetVersion: string) =>
    request<SkillVersionCompare>(
      `/v3/aihub/skills/${encodeURIComponent(skillName)}/compare?${toQuery({ baseVersion, targetVersion })}`,
    ),
  update: async (skillName: string, data: Partial<Skill>) => {
    // The backend PUT is not a sparse PATCH: protobuf default values make omitted
    // strings indistinguishable from empty strings. Always merge with current detail
    // first, so settings panels do not accidentally reset visibility/status/metadata.
    const current = normalizeSkill(
      await request<Skill>(`/v3/aihub/skills/${encodeURIComponent(skillName)}`),
    );
    const tags = mergeUniqueTags(
      (data as any).tags ?? current.tags,
      data.keywords ?? current.keywords,
      data.bizTags ?? current.bizTags,
    );
    const updated = await request<Skill>(
      `/v3/aihub/skills/${encodeURIComponent(skillName)}`,
      {
        method: "PUT",
        body: JSON.stringify({
          name: skillName,
          displayName: data.displayName ?? current.displayName ?? "",
          description: data.description ?? current.description ?? "",
          version: data.version ?? current.version ?? "",
          status: data.status ?? current.status ?? "active",
          visibility:
            data.visibility ??
            data.scope ??
            current.visibility ??
            current.scope ??
            "private",
          ownerId: data.ownerId ?? current.ownerId ?? current.owner ?? "",
          orgId: data.orgId ?? current.orgId ?? "",
          projectId: data.projectId ?? current.projectId ?? "",
          sourceType: data.sourceType ?? current.sourceType ?? "",
          sourceUri: data.sourceUri ?? current.sourceUri ?? "",
          manifestJson: manifestJsonForUpdate(current, data),
          tags,
        }),
      },
    );
    return normalizeSkill(updated);
  },
  draft: async (data: SkillDraft) => {
    const created = await request<Skill>("/v3/aihub/skills", {
      method: "POST",
      body: JSON.stringify({
        name: data.name,
        displayName: data.displayName,
        description: data.description,
        version: data.version,
        status: "active",
        visibility: data.scope || "private",
        manifestJson: data.metadata
          ? JSON.stringify({ metadata: data.metadata })
          : "{}",
        tags: [...(data.keywords || []), ...(data.bizTags || [])],
      }),
    });
    return normalizeSkill(created);
  },
  updateDraft: (data: SkillDraft) =>
    skillApi.update(data.name, {
      name: data.name,
      displayName: data.displayName,
      description: data.description,
      version: data.version,
      visibility: data.scope,
      metadata: data.metadata,
      tags: [...(data.keywords || []), ...(data.bizTags || [])],
    }),
  deleteDraft: (skillName: string) => skillApi.remove(skillName),
  forcePublish: (skillName: string, version: string) =>
    request<string>(
      `/v3/aihub/skills/${encodeURIComponent(skillName)}/versions/${encodeURIComponent(version)}:force-publish`,
      { method: "POST", body: "{}" },
    ),
  redraft: (skillName: string, version: string) =>
    skillApi.version(skillName, version),
  bizTags: (skillName: string, tags: string[]) =>
    skillApi.update(skillName, { name: skillName, tags, bizTags: tags }),
  metadata: (skillName: string, metadata: Record<string, unknown>) =>
    skillApi.update(skillName, { name: skillName, metadata }),
  scope: (skillName: string, scope: string) =>
    skillApi.update(skillName, { name: skillName, visibility: scope, scope }),
};

export const skillSetApi = {
  list: (params: Record<string, unknown> = {}) =>
    request<Page<SkillSet>>(`/v3/aihub/skillsets?${toQuery(params)}`),
  detail: (skillSetName: string) =>
    request<SkillSet>(`/v3/aihub/skillset/${encodeURIComponent(skillSetName)}`),
  save: (group: SkillSet) =>
    request<unknown>("/v3/aihub/skillsets", {
      method: "POST",
      body: JSON.stringify(group),
    }),
  update: (skillSetName: string, group: SkillSetUpdate) =>
    request<unknown>(`/v3/aihub/skillset/${encodeURIComponent(skillSetName)}`, {
      method: "PUT",
      body: JSON.stringify(group),
    }),
  remove: (skillSetName: string) =>
    request<unknown>(`/v3/aihub/skillset/${encodeURIComponent(skillSetName)}`, {
      method: "DELETE",
    }),
  bind: (skillSetName: string, member: Record<string, unknown>) =>
    request<unknown>(
      `/v3/aihub/skillset/${encodeURIComponent(skillSetName)}/skills`,
      {
        method: "POST",
        body: JSON.stringify(member),
      },
    ),
  unbind: (skillSetName: string, skillName: string) =>
    request<unknown>(
      `/v3/aihub/skillset/${encodeURIComponent(skillSetName)}/skills/${encodeURIComponent(skillName)}`,
      {
        method: "DELETE",
      },
    ),
  skillSetSkills: (skillSetName: string) =>
    request<SkillSet>(
      `/v3/aihub/skillset/${encodeURIComponent(skillSetName)}/skills`,
    ),
};

export const agentApi = {
  list: (params: Record<string, unknown> = {}) =>
    request<Page<AgentListItem>>(`/v3/aihub/agents?${toQuery(params)}`),
  detail: (agentId: string) =>
    request<AgentResponse>(`/v3/aihub/agents/${encodeURIComponent(agentId)}`),
  create: (data: AgentUpsertRequest) =>
    request<AgentResponse>("/v3/aihub/agents", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (agentId: string, data: AgentUpsertRequest) =>
    request<AgentResponse>(`/v3/aihub/agents/${encodeURIComponent(agentId)}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  remove: (agentId: string) =>
    request<unknown>(`/v3/aihub/agents/${encodeURIComponent(agentId)}`, {
      method: "DELETE",
    }),
  resolve: (
    agentId: string,
    body: {
      runtimeId?: string;
      sessionId?: string;
      version?: string;
      label?: string;
      policy?: string;
    } = {},
  ) =>
    request<AgentRuntimeSnapshot>(
      `/v3/aihub/runtime/agents/${encodeURIComponent(agentId)}/resolve`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    ),
};

export const runtimeServiceApi = {
  resolve: (
    services: AgentServiceRef[],
    body: { runtimeId?: string; sessionId?: string } = {},
  ) =>
    request<RuntimeServicesSnapshot>("/v3/aihub/runtime/services/resolve", {
      method: "POST",
      body: JSON.stringify({ ...body, services }),
    }),
};

export const sandboxApi = {
  list: (params: Record<string, unknown> = {}) =>
    request<Page<SandboxStatus>>(
      `/v3/aihub/runtime/sandboxes?${toQuery(params)}`,
    ),
  ensure: (body: SandboxEnsureRequest) =>
    request<SandboxStatus>("/v3/aihub/runtime/sandboxes", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  get: (sandboxId: string) =>
    request<SandboxStatus>(
      `/v3/aihub/runtime/sandboxes/${encodeURIComponent(sandboxId)}`,
    ),
  restart: (sandboxId: string) =>
    request<SandboxStatus>(
      `/v3/aihub/runtime/sandboxes/${encodeURIComponent(sandboxId)}/restart`,
      { method: "POST" },
    ),
  remove: (sandboxId: string, deleteWorkspace = false) =>
    request<unknown>(
      `/v3/aihub/runtime/sandboxes/${encodeURIComponent(sandboxId)}?${toQuery({ deleteWorkspace })}`,
      { method: "DELETE" },
    ),
  logsUrl: (sandboxId: string, tailLines = 200, container = "sandbox") =>
    `/v3/aihub/runtime/sandboxes/${encodeURIComponent(sandboxId)}/logs?${toQuery({ tailLines, container })}`,
  tools: (sandboxId: string) =>
    request<SandboxToolListResponse>(
      `/v3/aihub/runtime/sandboxes/${encodeURIComponent(sandboxId)}/tools`,
    ),
  callTool: (sandboxId: string, body: SandboxToolCallRequest) =>
    request<SandboxToolCallResult>(
      `/v3/aihub/runtime/sandboxes/${encodeURIComponent(sandboxId)}/tools/call`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    ),
};

export const toolApi = {
  list: (params: Record<string, unknown> = {}) =>
    request<Page<ToolListItem>>(`/v3/aihub/tools?${toQuery(params)}`),
  detail: (toolId: string) =>
    request<ToolResponse>(`/v3/aihub/tools/${encodeURIComponent(toolId)}`),
  create: (data: ToolUpsertRequest) =>
    request<ToolResponse>("/v3/aihub/tools", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (toolId: string, data: ToolUpsertRequest) =>
    request<ToolResponse>(`/v3/aihub/tools/${encodeURIComponent(toolId)}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  remove: (toolId: string) =>
    request<unknown>(`/v3/aihub/tools/${encodeURIComponent(toolId)}`, {
      method: "DELETE",
    }),
  resolve: (
    toolId: string,
    body: {
      runtimeId?: string;
      sessionId?: string;
      version?: string;
      label?: string;
    } = {},
  ) =>
    request<ToolRuntimeSnapshot>(
      `/v3/aihub/runtime/tools/${encodeURIComponent(toolId)}/resolve`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    ),
  failures: (params: Record<string, unknown> = {}) =>
    request<Page<ToolFailureRecord>>(
      `/v3/aihub/tool-failures?${toQuery(params)}`,
    ),
};

export const proposalApi = {
  list: (params: Record<string, unknown>) =>
    request<Page<Proposal>>(
      `/v3/admin/ai/skill-proposals/list?${toQuery(params)}`,
    ),
  detail: (id: string) =>
    request<Proposal>(`/v3/admin/ai/skill-proposals/${encodeURIComponent(id)}`),
  validate: (id: string) =>
    request<unknown>(
      `/v3/admin/ai/skill-proposals/${encodeURIComponent(id)}/validate`,
      { method: "POST" },
    ),
  approve: (id: string, options: Record<string, unknown>) =>
    request<unknown>(
      `/v3/admin/ai/skill-proposals/${encodeURIComponent(id)}/approve`,
      {
        method: "POST",
        body: JSON.stringify(options),
      },
    ),
  reject: (id: string, reason: string) =>
    request<unknown>(
      `/v3/admin/ai/skill-proposals/${encodeURIComponent(id)}/reject`,
      {
        method: "POST",
        body: JSON.stringify({ reason }),
      },
    ),
};

export const iamApi = {
  listUsers: () => request<LocalUser[]>("/v3/admin/iam/local-users/list"),
  saveUser: (u: LocalUser & { password?: string }) =>
    request<LocalUser>("/v3/admin/iam/local-users", {
      method: "POST",
      body: JSON.stringify(u),
    }),
  deleteUser: (username: string) =>
    request<unknown>(
      `/v3/admin/iam/local-users/${encodeURIComponent(username)}`,
      { method: "DELETE" },
    ),
  whoami: () => request<Record<string, unknown>>("/v3/admin/iam/whoami"),
};

export const namespaceApi = {
  list: () => request<NamespaceInfo[]>("/v3/admin/namespaces"),
  save: (data: Record<string, unknown>) =>
    request<unknown>("/v3/admin/namespaces", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  members: (namespaceId: string) =>
    request<NamespaceMember[]>(`/v3/admin/namespaces/${namespaceId}/members`),
  saveMember: (namespaceId: string, data: Record<string, unknown>) =>
    request<unknown>(`/v3/admin/namespaces/${namespaceId}/members`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteMember: (namespaceId: string, subjectId: string) =>
    request<unknown>(
      `/v3/admin/namespaces/${namespaceId}/members/${encodeURIComponent(subjectId)}`,
      {
        method: "DELETE",
      },
    ),
};

export const socialApi = {
  stats: (skillName: string) =>
    request<SkillSocialStats>(
      `/v3/admin/ai/skills/social?${toQuery({ skillName })}`,
    ),
  star: (skillName: string, starred: boolean) =>
    request<SkillSocialStats>("/v3/admin/ai/skills/social/star", {
      method: "POST",
      body: JSON.stringify({ skillName, starred }),
    }),
  rating: (skillName: string, rating: number, comment = "") =>
    request<SkillSocialStats>("/v3/admin/ai/skills/social/rating", {
      method: "POST",
      body: JSON.stringify({ skillName, rating, comment }),
    }),
  subscribe: (skillName: string, subscribed: boolean) =>
    request<unknown>("/v3/admin/ai/skills/social/subscribe", {
      method: "POST",
      body: JSON.stringify({ skillName, subscribed }),
    }),
};

export const auditApi = {
  list: (params: Record<string, unknown>) =>
    request<Page<AuditLog>>(`/v3/admin/audit/logs?${toQuery(params)}`),
};

export const tokenApi = {
  list: (subjectId = "") =>
    request<TokenInfo[]>(`/v3/admin/iam/tokens?${toQuery({ subjectId })}`),
  create: (data: Record<string, unknown>) =>
    request<TokenInfo>("/v3/admin/iam/tokens", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  remove: (keyId: string) =>
    request<unknown>(`/v3/admin/iam/tokens/${keyId}`, { method: "DELETE" }),
};

export const metricsApi = {
  get: () => request<MetricsSnapshot>("/v3/admin/metrics"),
};

export const notificationApi = {
  list: (params: Record<string, unknown> = {}) =>
    request<Notification[]>(`/v3/admin/notifications?${toQuery(params)}`),
  markRead: (id: string) =>
    request<unknown>(`/v3/admin/notifications/${encodeURIComponent(id)}/read`, {
      method: "POST",
    }),
  streamUrl: () => "/v3/admin/notifications/stream",
};

// 閳光偓閳光偓閳光偓 AIHub Resource Sharing API 閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓
// Implements the v3.5 sharing model: each share is a ResourceGrant
// record stored in aisphere-auth's IAM. The visible access mode
// (private / shared / public) is derived from the grants list.

type BackendSkillShare = {
  grantId?: string;
  id?: string;
  resource?: string;
  subject?: string;
  subjectType?: string;
  subjectId?: string;
  role?: string;
  actions?: string[];
  orgId?: string;
  projectId?: string;
  createdBy?: string;
  createdAt?: string | number;
  updatedAt?: string | number;
  metadataJson?: string;
  metadata?: Record<string, string>;
};

function resourcePath(
  resourceType: AihubResourceType,
  resourceId: string,
): string {
  switch (resourceType) {
    case "skill":
      return `/v3/aihub/skills/${encodeURIComponent(resourceId)}/shares`;
    case "agent":
      return `/v3/aihub/agents/${encodeURIComponent(resourceId)}/shares`;
    case "tool":
      return `/v3/aihub/tools/${encodeURIComponent(resourceId)}/shares`;
    case "workflow":
      return `/v3/aihub/workflows/${encodeURIComponent(resourceId)}/shares`;
    default:
      return `/v3/aihub/skills/${encodeURIComponent(resourceId)}/shares`;
  }
}

function normalizeShareRole(role: string | undefined): ResourceGrant["role"] {
  if (role === "consumer") return "consumer";
  if (role === "runner") return "consumer";
  if (
    role === "editor" ||
    role === "reviewer" ||
    role === "admin" ||
    role === "owner"
  )
    return role;
  return "viewer";
}

function toBackendShareRole(
  resourceType: AihubResourceType,
  role: ResourceGrant["role"],
): string {
  // The new Skill backend currently defines viewer/consumer/editor/owner.
  if (resourceType === "skill") {
    if (role === "runner") return "consumer";
    if (role === "admin") return "owner";
    if (role === "reviewer") return "viewer";
  }
  return role;
}

function normalizeSkillShare(
  raw: BackendSkillShare,
  resourceId: string,
): ResourceGrant {
  const metadata =
    raw.metadata || stringRecord(parseJsonRecord(raw.metadataJson));
  const subjectParts = raw.subject ? raw.subject.split(":") : [];
  const subjectIdFromSubject =
    subjectParts.length > 1 ? subjectParts.slice(1).join(":") : raw.subject;
  return {
    id: raw.grantId || raw.id || "",
    app: "aihub",
    orgId: raw.orgId,
    projectId: raw.projectId,
    resourceType: "skill",
    resourceId,
    object: raw.resource || `aihub:skill:${resourceId}`,
    subjectType: (raw.subjectType ||
      subjectParts[0] ||
      "user") as ResourceGrant["subjectType"],
    subjectId: raw.subjectId || subjectIdFromSubject || "",
    role: normalizeShareRole(raw.role),
    effect: "allow",
    actions: raw.actions || [],
    createdBy: raw.createdBy,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    metadata,
  };
}

function normalizeShareList(
  resourceType: AihubResourceType,
  resourceId: string,
  raw: unknown,
): ShareListResponse {
  const obj = (raw || {}) as any;
  if (resourceType === "skill") {
    const source = obj.shares ?? obj.items ?? (Array.isArray(raw) ? raw : []);
    const items = (source as BackendSkillShare[])
      .map((x) => normalizeSkillShare(x, resourceId))
      .filter((x) => x.id);
    return {
      items,
      total: obj.total,
      limit: obj.limit,
      offset: obj.offset,
      accessMode: obj.accessMode ?? deriveAccessMode(items),
      canManage: obj.canManage ?? true,
    };
  }
  const items = (obj.items ??
    (Array.isArray(raw) ? raw : [])) as ResourceGrant[];
  return {
    items,
    total: obj.total,
    limit: obj.limit,
    offset: obj.offset,
    accessMode: obj.accessMode ?? deriveAccessMode(items),
    canManage: obj.canManage ?? true,
  };
}

function backendShareBody(
  resourceType: AihubResourceType,
  resourceId: string,
  body: CreateShareRequest,
): Record<string, unknown> {
  if (resourceType !== "skill")
    return body as unknown as Record<string, unknown>;
  return {
    name: resourceId,
    subjectType: body.subjectType,
    subjectId: body.subjectType === "public" ? "" : body.subjectId,
    orgId: body.orgId,
    projectId: body.projectId,
    role: toBackendShareRole(resourceType, body.role),
    actions: body.actions,
    metadataJson: body.metadata ? JSON.stringify(body.metadata) : undefined,
  };
}

export const sharesApi = {
  list: async (
    resourceType: AihubResourceType,
    resourceId: string,
    params: Record<string, unknown> = {},
  ) => {
    const q = toQuery(params);
    const raw = await request<unknown>(
      `${resourcePath(resourceType, resourceId)}${q ? `?${q}` : ""}`,
    );
    return normalizeShareList(resourceType, resourceId, raw);
  },

  create: async (
    resourceType: AihubResourceType,
    resourceId: string,
    body: CreateShareRequest,
  ) => {
    const raw = await request<unknown>(resourcePath(resourceType, resourceId), {
      method: "POST",
      body: JSON.stringify(backendShareBody(resourceType, resourceId, body)),
    });
    if (resourceType === "skill")
      return normalizeShareList(resourceType, resourceId, { shares: [raw] })
        .items[0];
    return raw as ResourceGrant;
  },

  remove: (
    resourceType: AihubResourceType,
    resourceId: string,
    grantId: string,
  ) =>
    request<{ deleted: boolean; id: string }>(
      `${resourcePath(resourceType, resourceId)}/${encodeURIComponent(grantId)}`,
      { method: "DELETE" },
    ),

  listSkillShares: (skillName: string) => sharesApi.list("skill", skillName),
  createSkillShare: (skillName: string, body: CreateShareRequest) =>
    sharesApi.create("skill", skillName, body),
  deleteSkillShare: (skillName: string, grantId: string) =>
    sharesApi.remove("skill", skillName, grantId),
};

export const sandboxProfileApi = {
  list: () => request<SandboxProfile[]>("/v3/aihub/sandbox-profiles"),
  get: (id: string) =>
    request<SandboxProfile>(
      `/v3/aihub/sandbox-profiles/${encodeURIComponent(id)}`,
    ),
  save: (profile: SandboxProfile) =>
    request<SandboxProfile>("/v3/aihub/sandbox-profiles", {
      method: "POST",
      body: JSON.stringify(profile),
    }),
  update: (id: string, profile: SandboxProfile) =>
    request<SandboxProfile>(
      `/v3/aihub/sandbox-profiles/${encodeURIComponent(id)}`,
      { method: "PUT", body: JSON.stringify(profile) },
    ),
  remove: (id: string) =>
    request<string>(`/v3/aihub/sandbox-profiles/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
};

export const modelProfileApi = {
  list: () => request<ModelProfile[]>("/v3/aihub/model-profiles"),
  get: (id: string) =>
    request<ModelProfile>(`/v3/aihub/model-profiles/${encodeURIComponent(id)}`),
  save: (profile: ModelProfile) =>
    request<ModelProfile>("/v3/aihub/model-profiles", {
      method: "POST",
      body: JSON.stringify(profile),
    }),
  update: (id: string, profile: ModelProfile) =>
    request<ModelProfile>(
      `/v3/aihub/model-profiles/${encodeURIComponent(id)}`,
      { method: "PUT", body: JSON.stringify(profile) },
    ),
  remove: (id: string) =>
    request<string>(`/v3/aihub/model-profiles/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
};
