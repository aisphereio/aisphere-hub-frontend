/**
 * AIHub Frontend API layer.
 *
 * Talks DIRECTLY to the hub backend (no Next.js rewrites). All URLs are
 * relative to HUB_URL (see client.ts); the request() function prepends
 * HUB_URL automatically.
 *
 * Module migration status (v3 → v1):
 *
 *   ✅ authApi     → /v1/authn/*   (migrated, generated+adapter)
 *   ✅ authzApi    → /v1/authz/*    (new, ReBAC via SpiceDB, generated+adapter)
 *   ✅ skillApi    → /v1/skills/*   (migrated, generated+adapter)
 *   ✅ sharesApi   → /v1/skills/{name}/shares  (migrated, skill-only, generated+adapter)
 *   ✅ auditApi    → /v1/audit/records  (migrated, generated+adapter)
 *   ⚠️ accessApi   → /v1/authz/*    (legacy endpoints, will 404 until UI is rebuilt)
 *   ⏳ skillSetApi → /v3/aihub/skillsets/*  (awaiting backend migration)
 *   ⏳ agentApi    → /v3/aihub/agents/*     (awaiting backend migration)
 *   ✅ sandboxApi  → /v1/clusters|namespaces|sandboxes/*  (migrated, generated+adapter, SandboxService)
 *   ⏳ toolApi     → /v3/aihub/tools/*      (awaiting backend migration)
 *   ⏳ proposalApi → /v3/admin/ai/skill-proposals/*  (awaiting backend migration)
 *   ⏳ iamApi      → /v3/admin/iam/*        (awaiting backend migration)
 *   ⏳ namespaceApi→ /v3/admin/namespaces/* (awaiting backend migration)
 *   ⏳ socialApi   → /v3/admin/ai/skills/social/*  (awaiting backend migration)
 *   ⏳ tokenApi    → /v3/admin/iam/tokens/* (awaiting backend migration)
 *   ⏳ metricsApi  → /v3/admin/metrics      (awaiting backend migration)
 *   ⏳ notificationApi → /v3/admin/notifications/*  (awaiting backend migration)
 *   ✅ sandboxProfileApi → /v1/clusters/{id}/sandbox-templates  (migrated into sandboxApi, generated+adapter)
 *   ⏳ modelProfileApi → /v3/aihub/model-profiles/*  (awaiting backend migration)
 *
 * The ⏳ modules will 404 against the new hub until their backends are
 * migrated. The frontend code structure is correct; only the path prefix
 * needs updating when each backend module lands.
 */
import { request, toQuery, HUB_URL, getToken, IS_GATEWAY_OIDC, buildGatewayLoginUrl, GATEWAY_LOGOUT_PATH } from "./client";
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
  SkillSocialStats,
  AuditLog,
  TokenInfo,
  MetricsSnapshot,
  NamespaceInfo,
  NamespaceMember,
  SkillDraft,
  SkillSetUpdate,
  SkillSetMember,
  SkillSetLock,
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
  IamPrincipal,
  IamUser,
  IamOrganization,
  IamGroup,
  IamCpOrganization,
  IamProject,
  IamCapability,
  IamProjectCapability,
  IamResourceType,
  IamResourceRef,
  IamResource,
  IamResourceBinding,
  IamRoleTemplate,
  IamGrant,
  IamSubjectRef,
  IamRelationship,
  IamCheckPermissionRequest,
  IamCheckPermissionResponse,
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

function contentTypeForPath(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "text/markdown; charset=utf-8";
  if (lower.endsWith(".json")) return "application/json; charset=utf-8";
  if (lower.endsWith(".yaml") || lower.endsWith(".yml")) return "application/yaml; charset=utf-8";
  if (lower.endsWith(".py")) return "text/x-python; charset=utf-8";
  if (lower.endsWith(".js") || lower.endsWith(".ts")) return "text/javascript; charset=utf-8";
  return "text/plain; charset=utf-8";
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

// authApi is backed by the orval-generated AuthnService client.
// See adapters/auth.ts for the generated → domain-type mapping.
export { authApi } from './adapters/auth';

/**
 * accessApi — legacy access management panel.
 *
 * The new hub replaces this with the authz API (/v1/authz/*). The old
 * overview / resources / links / evaluate endpoints are NOT implemented
 * in the new hub yet. Calls will 404 until the authz management UI is
 * rebuilt on top of /v1/authz/relationships + /v1/authz/lookup-subjects.
 *
 * See authzApi below for the new API surface.
 */
export const accessApi = {
  overview: () => request<AccessOverview>("/v1/authz/overview"),
  resources: () =>
    request<Page<AccessResourceTemplate>>("/v1/authz/resources"),
  links: () => request<Page<AccessQuickLink>>("/v1/authz/links"),
  evaluate: (subject: string, object: string, action: string) =>
    request<AccessEvaluateResult>("/v1/authz/evaluate", {
      method: "POST",
      body: JSON.stringify({ subject, object, action }),
    }),
};

/**
 * authzApi — new authorization API backed by SpiceDB (ReBAC + ABAC).
 *
 * Mirrors the hub's /v1/authz/* RPCs. Use these for:
 *   - Permission checks (CheckPermission)
 *   - Relationship management (Write/Delete/ReadRelationships)
 *   - Reverse lookups (LookupResources / LookupSubjects)
 *   - Schema management (ReadSchema / WriteSchema)
 */
// authzApi is backed by the orval-generated AuthzService client.
// See adapters/authz.ts for the generated → domain-type mapping.
export { authzApi } from './adapters/authz';

// skillApi is backed by the orval-generated SkillService client.
// See adapters/skill.ts for the generated -> domain-type mapping.
export { skillApi } from './adapters/skill';

// skillReleaseApi wraps the generated immutable SkillReleaseService client.
export { skillReleaseApi } from './adapters/skill-release';

// fileApi is the in-browser editor's content surface: list/get/create/
// update/delete over the hub FileService (a convenience layer on top
// of the bare git repo). See adapters/file.ts.
export { fileApi } from './adapters/file';

// prApi wraps the skill-service pull-request endpoints (list/get/create/
// merge/close). PRs are the publish path when the default branch is
// locked. See adapters/pr.ts.
export { prApi } from './adapters/pr';


export const skillSetApi = {
  list: (params: Record<string, unknown> = {}) =>
    request<Page<SkillSet>>(`/v1/skillsets?${toQuery(params)}`),
  detail: (skillSetName: string) =>
    request<SkillSet>(`/v1/skillsets/${encodeURIComponent(skillSetName)}`),
  save: (group: SkillSet) =>
    request<unknown>("/v1/skillsets", {
      method: "POST",
      body: JSON.stringify(group),
    }),
  update: (skillSetName: string, group: SkillSetUpdate) =>
    request<unknown>(`/v1/skillsets/${encodeURIComponent(skillSetName)}`, {
      method: "PUT",
      body: JSON.stringify(group),
    }),
  remove: (skillSetName: string) =>
    request<unknown>(`/v1/skillsets/${encodeURIComponent(skillSetName)}`, {
      method: "DELETE",
    }),
  /** Bind a skill to the SkillSet (creates or updates the membership). */
  bind: (skillSetName: string, member: SkillSetMember) =>
    request<SkillSetMember>(
      `/v1/skillsets/${encodeURIComponent(skillSetName)}/members`,
      {
        method: "POST",
        body: JSON.stringify(member),
      },
    ),
  /** Update an existing membership (label / required / order). */
  updateMember: (skillSetName: string, skillName: string, member: Partial<SkillSetMember>) =>
    request<SkillSetMember>(
      `/v1/skillsets/${encodeURIComponent(skillSetName)}/members/${encodeURIComponent(skillName)}`,
      {
        method: "PUT",
        body: JSON.stringify(member),
      },
    ),
  /** Remove a skill from the SkillSet. */
  unbind: (skillSetName: string, skillName: string) =>
    request<unknown>(
      `/v1/skillsets/${encodeURIComponent(skillSetName)}/members/${encodeURIComponent(skillName)}`,
      { method: "DELETE" },
    ),
  /** Convenience: return the SkillSet with members populated. */
  skillSetSkills: (skillSetName: string) =>
    skillSetApi.detail(skillSetName),
  /** List all SkillSets that contain a given skill (reverse lookup). */
  skillSetOfSkill: (skillName: string) =>
    request<{ skillsets: string[] }>(
      `/v1/skills/${encodeURIComponent(skillName)}/skillsets`,
    ),
  /** Produce an immutable, Runtime-consumable lock snapshot. */
  resolve: (skillSetName: string) =>
    request<SkillSetLock>(
      `/v1/skillsets/${encodeURIComponent(skillSetName)}:resolve`,
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

// sandboxApi is backed by the orval-generated SandboxService client.
// See adapters/sandbox.ts for the generated → domain-type mapping.
// (The old v3 hand-written sandboxApi object — list/ensure/get/restart/
//  remove/logsUrl/tools/callTool against /v3/aihub/runtime/sandboxes/* —
//  has been removed. The new SDK is protojson and namespace/cluster-scoped;
//  there is no ensure/restart RPC. UI code now imports sandboxApi from
//  ./adapters/sandbox directly, or via the re-export below.)
export { sandboxApi } from './adapters/sandbox';

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

// ─── IAM Service API (aisphere-iam /v1/iam/*) ──────────────────────────
// These endpoints talk to aisphere-iam. Gateway OIDC deployments expose IAM
// under the same API origin as Hub; token-mode local dev talks to IAM directly.
const configuredIamUrl = process.env.NEXT_PUBLIC_IAM_URL;
const IAM_URL: string = (
  configuredIamUrl === undefined || configuredIamUrl === ''
    ? (IS_GATEWAY_OIDC ? HUB_URL : 'http://127.0.0.1:18080')
    : configuredIamUrl
).replace(/\/+$/, '');

function iamRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const fullUrl = IAM_URL + path;
  const headers = new Headers(init.headers || []);
  let token = getToken();
  if (!token && IS_GATEWAY_OIDC && typeof document !== 'undefined') {
    const m = document.cookie.match(/(?:^|;\s*)Aisphere-Hub-AccessToken=([^;]+)/);
    if (m) token = decodeURIComponent(m[1]);
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (IS_GATEWAY_OIDC) headers.set('X-Requested-With', 'XMLHttpRequest');
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(fullUrl, {
    ...init,
    headers,
    credentials: init.credentials || 'same-origin',
  }).then(async (res) => {
    if (!res.ok) {
      if (res.status === 401 && IS_GATEWAY_OIDC && typeof window !== 'undefined') {
        window.location.replace('/');
      }
      let msg = `${res.status} ${res.statusText}`;
      try {
        const j = await res.json();
        msg = j.message || j.error || msg;
      } catch { /* ignore */ }
      throw new Error(msg);
    }
    const text = await res.text();
    if (!text) return {} as T;
    return JSON.parse(text) as T;
  });
}

/** IAM Auth Service */
export const iamAuthApi = {
  /** Build Casdoor OAuth login URL */
  buildLoginUrl: (redirectUri: string, state = '') =>
    iamRequest<{ loginUrl?: string; login_url?: string }>(
      `/v1/iam/login-url?${toQuery({ redirect_uri: redirectUri, state })}`,
    ).then((r) => r.loginUrl || r.login_url || ''),

  /** Exchange authorization code for tokens */
  exchangeCode: (code: string, redirectUri: string) =>
    iamRequest<{
      accessToken?: string;
      refreshToken?: string;
      idToken?: string;
      tokenType?: string;
      expiresIn?: number;
    }>('/v1/iam/auth/exchange', {
      method: 'POST',
      body: JSON.stringify({ code, redirect_uri: redirectUri }),
    }),

  /** Refresh access token */
  refreshToken: (refreshToken: string) =>
    iamRequest<{
      accessToken?: string;
      refreshToken?: string;
      idToken?: string;
      expiresIn?: number;
    }>('/v1/iam/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),

  /** Get current user profile */
  getMe: () => iamRequest<IamPrincipal>('/v1/iam/me'),
};

export const iamDirectoryApi = {
  /** Get a user by org and user id */
  getUser: (orgId: string, userId: string) =>
    iamRequest<IamUser>(`/v1/iam/orgs/${encodeURIComponent(orgId)}/users/${encodeURIComponent(userId)}`),

  /** List users in an organization */
  listUsers: (orgId: string) =>
    iamRequest<{ users: IamUser[] }>(`/v1/iam/orgs/${encodeURIComponent(orgId)}/users`),

  /** Get organization */
  getOrganization: (orgId: string) =>
    iamRequest<IamOrganization>(`/v1/iam/orgs/${encodeURIComponent(orgId)}`),

  /** List groups in an organization */
  listGroups: (orgId: string) =>
    iamRequest<{ groups: IamGroup[] }>(`/v1/iam/orgs/${encodeURIComponent(orgId)}/groups`),
};

export const iamPermissionApi = {
  /** Check permission */
  check: (req: IamCheckPermissionRequest) =>
    iamRequest<IamCheckPermissionResponse>('/v1/iam/permissions/check', {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  /** Write relationship */
  writeRelationship: (relationship: IamRelationship) =>
    iamRequest<{ consistencyToken?: string }>('/v1/iam/relationships', {
      method: 'POST',
      body: JSON.stringify(relationship),
    }),

  /** Delete relationship */
  deleteRelationship: (filter: {
    resourceType?: string;
    resourceId?: string;
    relation?: string;
    subjectType?: string;
    subjectId?: string;
    subjectRelation?: string;
  }) =>
    iamRequest<{ consistencyToken?: string }>('/v1/iam/relationships/delete', {
      method: 'POST',
      body: JSON.stringify({ filter }),
    }),
};

export const iamProjectApi = {
  /** Create organization */
  createOrganization: (org: { slug: string; displayName?: string; casdoorOrg?: string }) =>
    iamRequest<IamCpOrganization>('/v1/iam/control-plane/orgs', {
      method: 'POST',
      body: JSON.stringify(org),
    }),

  /** Get organization */
  getOrganization: (orgId: string) =>
    iamRequest<IamCpOrganization>(`/v1/iam/control-plane/orgs/${encodeURIComponent(orgId)}`),

  /** List organizations */
  listOrganizations: () =>
    iamRequest<{ organizations: IamCpOrganization[] }>('/v1/iam/control-plane/orgs'),

  /** Update organization */
  updateOrganization: (orgId: string, org: Partial<IamCpOrganization>) =>
    iamRequest<IamCpOrganization>(`/v1/iam/control-plane/orgs/${encodeURIComponent(orgId)}`, {
      method: 'PATCH',
      body: JSON.stringify(org),
    }),

  /** Create project */
  createProject: (orgId: string, project: { slug: string; displayName?: string; description?: string }) =>
    iamRequest<IamProject>(`/v1/iam/control-plane/orgs/${encodeURIComponent(orgId)}/projects`, {
      method: 'POST',
      body: JSON.stringify(project),
    }),

  /** Get project */
  getProject: (projectId: string) =>
    iamRequest<IamProject>(`/v1/iam/control-plane/projects/${encodeURIComponent(projectId)}`),

  /** List active projects for an organization */
  listProjects: (orgId: string) =>
    iamRequest<{ projects: IamProject[] }>(`/v1/iam/orgs/${encodeURIComponent(orgId)}/projects?status=ACTIVE`),

  /** Update project */
  updateProject: (projectId: string, project: Partial<IamProject>) =>
    iamRequest<IamProject>(`/v1/iam/control-plane/projects/${encodeURIComponent(projectId)}`, {
      method: 'PATCH',
      body: JSON.stringify(project),
    }),

  /** Archive project */
  archiveProject: (projectId: string) =>
    iamRequest<unknown>(`/v1/iam/control-plane/projects/${encodeURIComponent(projectId)}/archive`, {
      method: 'POST',
    }),

  /** List capabilities */
  listCapabilities: () =>
    iamRequest<{ capabilities: IamCapability[] }>('/v1/iam/control-plane/capabilities'),

  /** Register capability */
  registerCapability: (cap: { name: string; displayName?: string; ownerService?: string }) =>
    iamRequest<IamCapability>('/v1/iam/control-plane/capabilities', {
      method: 'POST',
      body: JSON.stringify(cap),
    }),

  /** List project capabilities */
  listProjectCapabilities: (projectId: string) =>
    iamRequest<{ projectCapabilities: IamProjectCapability[] }>(
      `/v1/iam/control-plane/projects/${encodeURIComponent(projectId)}/capabilities`,
    ),

  /** Enable project capability */
  enableProjectCapability: (projectId: string, capabilityId: string) =>
    iamRequest<unknown>(
      `/v1/iam/control-plane/projects/${encodeURIComponent(projectId)}/capabilities/${encodeURIComponent(capabilityId)}:enable`,
      { method: 'POST' },
    ),

  /** Disable project capability */
  disableProjectCapability: (projectId: string, capabilityId: string) =>
    iamRequest<unknown>(
      `/v1/iam/control-plane/projects/${encodeURIComponent(projectId)}/capabilities/${encodeURIComponent(capabilityId)}:disable`,
      { method: 'POST' },
    ),
};

export const iamResourceService = {
  /** Register resource type */
  registerResourceType: (rt: {
    type: string;
    displayName?: string;
    description?: string;
    spicedbType?: string;
    relations?: string[];
    permissions?: string[];
  }) =>
    iamRequest<IamResourceType>('/v1/iam/control-plane/resource-types', {
      method: 'POST',
      body: JSON.stringify(rt),
    }),

  /** Get resource type */
  getResourceType: (type: string) =>
    iamRequest<IamResourceType>(`/v1/iam/control-plane/resource-types/${encodeURIComponent(type)}`),

  /** List resource types */
  listResourceTypes: () =>
    iamRequest<{ resourceTypes: IamResourceType[] }>('/v1/iam/control-plane/resource-types'),

  /** List resources */
  listResources: (params: { resourceType?: string; projectId?: string } = {}) =>
    iamRequest<{ resources: IamResource[] }>(`/v1/iam/control-plane/resources?${toQuery(params)}`),

  /** Get resource */
  getResource: (resourceType: string, resourceId: string) =>
    iamRequest<IamResource>(
      `/v1/iam/control-plane/resources/${encodeURIComponent(resourceType)}/${encodeURIComponent(resourceId)}`,
    ),

  /** List resource bindings */
  listResourceBindings: (params: { sourceType?: string; sourceId?: string } = {}) =>
    iamRequest<{ resourceBindings: IamResourceBinding[] }>(
      `/v1/iam/control-plane/resource-bindings?${toQuery(params)}`,
    ),
};

export const iamGrantService = {
  /** Register role template */
  registerRoleTemplate: (rt: {
    resourceType?: string;
    roleKey: string;
    displayName?: string;
    description?: string;
    relation?: string;
  }) =>
    iamRequest<IamRoleTemplate>('/v1/iam/control-plane/role-templates', {
      method: 'POST',
      body: JSON.stringify(rt),
    }),

  /** List role templates */
  listRoleTemplates: () =>
    iamRequest<{ roleTemplates: IamRoleTemplate[] }>('/v1/iam/control-plane/role-templates'),

  /** Grant access */
  grantAccess: (grant: {
    resource: IamResourceRef;
    roleKey?: string;
    relation?: string;
    subject: IamSubjectRef;
    reason?: string;
    expiresAt?: string;
  }) =>
    iamRequest<IamGrant>('/v1/iam/control-plane/grants', {
      method: 'POST',
      body: JSON.stringify(grant),
    }),

  /** Revoke access */
  revokeAccess: (grantId: string) =>
    iamRequest<unknown>(`/v1/iam/control-plane/grants/${encodeURIComponent(grantId)}/revoke`, {
      method: 'POST',
    }),

  /** List grants */
  listGrants: (params: { resourceType?: string; resourceId?: string } = {}) =>
    iamRequest<{ grants: IamGrant[] }>(`/v1/iam/control-plane/grants?${toQuery(params)}`),

  /** Explain access */
  explainAccess: (req: {
    resource: IamResourceRef;
    subject: IamSubjectRef;
  }) =>
    iamRequest<{ steps: unknown[] }>('/v1/iam/control-plane/access:explain', {
      method: 'POST',
      body: JSON.stringify(req),
    }),
};

// ─── IAM Group Admin API (aisphere-iam /v1/iam/groups/*) ─────────────────
export const iamGroupAdminApi = {
  /** Create group */
  createGroup: (orgId: string, group: { name: string; displayName?: string; type?: string; parentId?: string }) =>
    iamRequest<IamGroup>('/v1/iam/groups', {
      method: 'POST',
      body: JSON.stringify({ org_id: orgId, group }),
    }),

  /** Update group */
  updateGroup: (orgId: string, groupId: string, group: Partial<IamGroup>) =>
    iamRequest<IamGroup>(`/v1/iam/groups/${encodeURIComponent(groupId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ org_id: orgId, group_id: groupId, group }),
    }),

  /** Delete group */
  deleteGroup: (orgId: string, groupId: string, recursive = false) =>
    iamRequest<unknown>(`/v1/iam/groups/${encodeURIComponent(groupId)}`, {
      method: 'DELETE',
      body: JSON.stringify({ org_id: orgId, recursive }),
    }),

  /** Assign user to group */
  assignUserToGroup: (orgId: string, groupId: string, userId: string) =>
    iamRequest<unknown>(`/v1/iam/groups/${encodeURIComponent(groupId)}/users/${encodeURIComponent(userId)}`, {
      method: 'POST',
      body: JSON.stringify({ org_id: orgId }),
    }),

  /** Remove user from group */
  removeUserFromGroup: (orgId: string, groupId: string, userId: string) =>
    iamRequest<unknown>(`/v1/iam/groups/${encodeURIComponent(groupId)}/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      body: JSON.stringify({ org_id: orgId }),
    }),
};

// ─── IAM Authz Admin API (aisphere-iam /v1/iam/authz/*) ──────────────────────
export const iamAuthzAdminApi = {
  /** Get authorization schema */
  getSchema: () =>
    iamRequest<{ text: string; version: string }>('/v1/iam/authz/schema'),

  /** Validate authorization schema */
  validateSchema: (text: string) =>
    iamRequest<{ valid: boolean; error?: string }>('/v1/iam/authz/schema:validate', {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),

  /** Publish authorization schema */
  publishSchema: (text: string) =>
    iamRequest<{ published: boolean }>('/v1/iam/authz/schema:publish', {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),

  /** List relationships */
  listRelationships: (filter: {
    resourceType?: string;
    resourceId?: string;
    relation?: string;
    subjectType?: string;
    subjectId?: string;
    subjectRelation?: string;
  } = {}) =>
    iamRequest<{ relationships: IamRelationship[] }>(`/v1/iam/authz/relationships?${toQuery(filter)}`),

  /** Write relationships */
  writeRelationships: (relationships: IamRelationship[]) =>
    iamRequest<{ written: number; consistencyToken?: string }>('/v1/iam/authz/relationships', {
      method: 'POST',
      body: JSON.stringify({ relationships }),
    }),

  /** Delete relationships */
  deleteRelationships: (filter: {
    resourceType?: string;
    resourceId?: string;
    relation?: string;
    subjectType?: string;
    subjectId?: string;
    subjectRelation?: string;
  }) =>
    iamRequest<{ deleted: number; consistencyToken?: string }>('/v1/iam/authz/relationships:delete', {
      method: 'POST',
      body: JSON.stringify({ filter }),
    }),

  /** Check permission */
  checkPermission: (req: IamCheckPermissionRequest) =>
    iamRequest<IamCheckPermissionResponse>('/v1/iam/authz/permissions:check', {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  /** Explain permission */
  explainPermission: (req: IamCheckPermissionRequest) =>
    iamRequest<{ allowed: boolean; effect: string; reason: string; steps?: string[] }>(
      '/v1/iam/authz/permissions:explain', {
        method: 'POST',
        body: JSON.stringify(req),
      }),

  /** Get effective permissions */
  getEffectivePermissions: (params: {
    subjectType: string;
    subjectId: string;
    resourceType: string;
    resourceId: string;
    permissions?: string[];
  }) =>
    iamRequest<Record<string, { allowed: boolean; effect: string }>>(
      `/v1/iam/authz/effective-permissions?${toQuery(params)}`),
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

// auditApi is backed by the orval-generated AuditService client.
// See adapters/audit.ts for the generated → domain-type mapping.
export { auditApi } from './adapters/audit';

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
      return `/v1/skills/${encodeURIComponent(resourceId)}/shares`;
    case "agent":
      return `/v3/aihub/agents/${encodeURIComponent(resourceId)}/shares`;
    case "tool":
      return `/v3/aihub/tools/${encodeURIComponent(resourceId)}/shares`;
    case "workflow":
      return `/v3/aihub/workflows/${encodeURIComponent(resourceId)}/shares`;
    default:
      return `/v1/skills/${encodeURIComponent(resourceId)}/shares`;
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

/**
 * sharesApi — resource sharing via authz relationships.
 *
 * The new hub implements sharing through SpiceDB relationships:
 *   - List shares → ReadRelationships (filter by resource)
 *   - Create share → WriteRelationships (resource#relation@subject)
 *   - Delete share → DeleteRelationships (by resource + subject)
 *
 * For skills, the dedicated /v1/skills/{name}/shares endpoints wrap
 * these authz calls with skill-specific authz checks (only owner /
 * editor can share). For other resource types (agent / tool / workflow)
 * the new hub does not yet have dedicated share endpoints — calls will
 * 404 until those modules are migrated.
 *
 * grantId convention: "subjectType:subjectId" (e.g. "user:u_123").
 * The delete endpoint path is /shares/{subjectType}/{subjectId}.
 */

/** Parse a grantId ("subjectType:subjectId") into parts. */
function parseGrantId(grantId: string): { subjectType: string; subjectId: string } {
  const idx = grantId.indexOf(':');
  if (idx < 0) return { subjectType: 'user', subjectId: grantId };
  return {
    subjectType: grantId.slice(0, idx),
    subjectId: grantId.slice(idx + 1),
  };
}

/** Build a ResourceGrant id from subject parts, matching parseGrantId. */
function buildGrantId(subjectType: string, subjectId: string): string {
  return `${subjectType}:${subjectId}`;
}

function publicGrant(resourceType: AihubResourceType, resourceId: string): ResourceGrant {
  return {
    id: buildGrantId("public", "*"),
    app: "aihub",
    resourceType,
    resourceId,
    object: `${resourceType}:${resourceId}`,
    subjectType: "public",
    subjectId: "*",
    role: "viewer",
    effect: "allow",
    actions: [],
  };
}

// sharesApi is backed by the orval-generated SkillService share RPCs.
// See adapters/shares.ts for the generated → domain-type mapping.
export { sharesApi } from './adapters/shares';

// sandboxProfileApi has been migrated into sandboxApi (SandboxTemplate RPCs).
// The old v3 hand-written object against /v3/aihub/sandbox-profiles/* is gone;
// template management now uses sandboxApi.listSandboxTemplates /
// createSandboxTemplate / deleteSandboxTemplate (cluster-scoped, generated SDK).
// export const sandboxProfileApi = {
//   list: () => request<SandboxProfile[]>("/v3/aihub/sandbox-profiles"),
//   get: (id: string) => request<SandboxProfile>(`/v3/aihub/sandbox-profiles/${encodeURIComponent(id)}`),
//   save: (profile: SandboxProfile) => request<SandboxProfile>("/v3/aihub/sandbox-profiles", { method: "POST", body: JSON.stringify(profile) }),
//   update: (id: string, profile: SandboxProfile) => request<SandboxProfile>(`/v3/aihub/sandbox-profiles/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(profile) }),
//   remove: (id: string) => request<string>(`/v3/aihub/sandbox-profiles/${encodeURIComponent(id)}`, { method: "DELETE" }),
// };

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
