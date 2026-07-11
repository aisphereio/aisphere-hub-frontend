/**
 * AIHub Frontend API layer.
 *
 * Talks DIRECTLY to the hub backend (no Next.js rewrites). All URLs are
 * relative to HUB_URL (see client.ts); the request() function prepends
 * HUB_URL automatically.
 *
 * Module migration status (v3 → v1):
 *
 *   ✅ authApi     → /v1/authn/*   (migrated)
 *   ✅ authzApi    → /v1/authz/*    (new, ReBAC via SpiceDB)
 *   ✅ skillApi    → /v1/skills/*   (migrated)
 *   ✅ sharesApi   → /v1/skills/{name}/shares  (migrated, skill-only)
 *   ✅ auditApi    → /v1/audit/records  (migrated)
 *   ⚠️ accessApi   → /v1/authz/*    (legacy endpoints, will 404 until UI is rebuilt)
 *   ⏳ skillSetApi → /v3/aihub/skillsets/*  (awaiting backend migration)
 *   ⏳ agentApi    → /v3/aihub/agents/*     (awaiting backend migration)
 *   ⏳ sandboxApi  → /v3/aihub/runtime/sandboxes/*  (awaiting backend migration)
 *   ⏳ toolApi     → /v3/aihub/tools/*      (awaiting backend migration)
 *   ⏳ proposalApi → /v3/admin/ai/skill-proposals/*  (awaiting backend migration)
 *   ⏳ iamApi      → /v3/admin/iam/*        (awaiting backend migration)
 *   ⏳ namespaceApi→ /v3/admin/namespaces/* (awaiting backend migration)
 *   ⏳ socialApi   → /v3/admin/ai/skills/social/*  (awaiting backend migration)
 *   ⏳ tokenApi    → /v3/admin/iam/tokens/* (awaiting backend migration)
 *   ⏳ metricsApi  → /v3/admin/metrics      (awaiting backend migration)
 *   ⏳ notificationApi → /v3/admin/notifications/*  (awaiting backend migration)
 *   ⏳ sandboxProfileApi → /v3/aihub/sandbox-profiles/*  (awaiting backend migration)
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
  SkillFileList,
  SkillFileContent,
  SkillVersion,
  SkillVersionCompare,
  SkillPackageDownload,
  SkillSocialStats,
  AuditLog,
  TokenInfo,
  MetricsSnapshot,
  NamespaceInfo,
  NamespaceMember,
  SkillDraft,
  SkillSetUpdate,
  SkillSetMember,
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
    }>("/v1/authn/exchange", {
      method: "POST",
      body: JSON.stringify({ code, redirect_uri: redirectUri, redirectUri, state }),
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
      `/v1/authn/login-url?${toQuery({ redirect_uri: redirectUri, state })}`,
    ).then((r) => r.loginUrl || r.login_url || ""),
  /** Browser entry point: returns the full hub URL for 302 redirect to Casdoor. */
  login: (redirectUri: string, state = "") =>
    buildGatewayLoginUrl(),
  /** Refresh the access token using a refresh token. */
  refresh: async (refreshToken: string) => {
    const raw = await request<{
      accessToken?: string;
      refreshToken?: string;
      idToken?: string;
      access_token?: string;
      refresh_token?: string;
      id_token?: string;
      expiresIn?: number;
      expires_in?: number;
    }>("/v1/authn/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken, refresh_token: refreshToken }),
    });
    return {
      accessToken: raw.accessToken || raw.access_token || "",
      refreshToken: raw.refreshToken || raw.refresh_token || "",
      idToken: raw.idToken || raw.id_token || "",
      expiresIn: raw.expiresIn || raw.expires_in || 0,
    };
  },
  /** Returns the Casdoor logout URL (JSON). Browser users can also call GET /v1/authn/logout directly. */
  logoutUrl: (postLogoutRedirectUri = "", idTokenHint = "", state = "") => {
    const q = toQuery({
      post_logout_redirect_uri: postLogoutRedirectUri,
      id_token_hint: idTokenHint,
      state,
    });
    return request<{ logoutUrl?: string; logout_url?: string }>(
      `/v1/authn/logout-url${q ? `?${q}` : ""}`,
      { method: "GET" },
    ).then((r) => r.logoutUrl || r.logout_url || "");
  },
  /** Browser entry point: full hub URL for 302 redirect to Casdoor end-session. */
  logout: (postLogoutRedirectUri = "", idTokenHint = "", state = "") =>
    GATEWAY_LOGOUT_PATH,
  /** Returns the current authenticated principal. */
  me: () => request<Record<string, unknown>>("/v1/authn/me"),
};

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
export const authzApi = {
  /** Check if subject has permission on resource. */
  check: (params: {
    subject: { type: string; id: string; relation?: string };
    resource: { type: string; id: string };
    permission: string;
    fullyConsistent?: boolean;
    consistencyToken?: string;
  }) =>
    request<{
      effect: string; // "allow" | "deny" | "no_match"
      allowed: boolean;
      reason?: string;
      consistencyToken?: string;
      missingContext?: string[];
    }>("/v1/authz/check", {
      method: "POST",
      body: JSON.stringify(params),
    }),

  /** Write (create or update) relationship tuples. Idempotent. */
  writeRelationships: (relationships: Array<{
    resource: { type: string; id: string };
    relation: string;
    subject: { type: string; id: string; relation?: string };
    caveatName?: string;
    caveatContext?: Record<string, unknown>;
    expiresAt?: string;
  }>) =>
    request<{
      consistencyToken: string;
      written: number;
    }>("/v1/authz/relationships", {
      method: "POST",
      body: JSON.stringify({ relationships }),
    }),

  /** Delete relationship tuples matching the filter. */
  deleteRelationships: (filter: {
    resourceType?: string;
    resourceId?: string;
    relation?: string;
    subjectType?: string;
    subjectId?: string;
    subjectRelation?: string;
  }) =>
    request<{
      consistencyToken: string;
      deleted: number;
    }>("/v1/authz/relationships", {
      method: "DELETE",
      body: JSON.stringify({ filter }),
    }),

  /** List relationship tuples matching the filter. */
  readRelationships: (filter: {
    resourceType?: string;
    resourceId?: string;
    relation?: string;
    subjectType?: string;
    subjectId?: string;
    subjectRelation?: string;
  }) =>
    request<{
      relationships: Array<{
        resource: { type: string; id: string };
        relation: string;
        subject: { type: string; id: string; relation?: string };
      }>;
      nextCursor?: string;
      consistencyToken?: string;
    }>(`/v1/authz/relationships?${toQuery(filter)}`),

  /** List resources a subject can access with the given permission. */
  lookupResources: (params: {
    subject: { type: string; id: string; relation?: string };
    resourceType: string;
    permission: string;
  }) =>
    request<{
      resources: Array<{ type: string; id: string }>;
      nextCursor?: string;
      consistencyToken?: string;
    }>(`/v1/authz/lookup-resources?${toQuery(params)}`),

  /** List subjects that can access the given resource with the given permission. */
  lookupSubjects: (params: {
    resource: { type: string; id: string };
    permission: string;
    subjectType: string;
  }) =>
    request<{
      subjects: Array<{ type: string; id: string; relation?: string }>;
      nextCursor?: string;
      consistencyToken?: string;
    }>(`/v1/authz/lookup-subjects?${toQuery(params)}`),

  /** Read the current SpiceDB schema text. */
  readSchema: () =>
    request<{ schemaText: string }>("/v1/authz/schema"),

  /** Replace the SpiceDB schema. Use with care. */
  writeSchema: (schemaText: string) =>
    request<unknown>("/v1/authz/schema", {
      method: "PUT",
      body: JSON.stringify({ schemaText }),
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
      `/v1/skills${q ? `?${q}` : ""}`,
    );
    return normalizeSkillPage(page);
  },
  detail: async (skillName: string) => {
    const name = encodeURIComponent(skillName);
    const [skill, versions] = await Promise.all([
      request<Skill>(`/v1/skills/${name}`),
      request<{ versions?: Skill["versions"] }>(
        `/v1/skills/${name}/versions`,
      ),
    ]);
    return normalizeSkill({ ...skill, versions: versions.versions || [] });
  },
  version: (skillName: string, version: string) =>
    request<unknown>(
      `/v1/skills/${encodeURIComponent(skillName)}/versions/${encodeURIComponent(version)}`,
    ),
  upload: async (
    file: File,
    overwrite = true,
    targetVersion = "",
    commitMsg = "",
  ) =>
    request<SkillVersion>("/v1/skills:upload", {
      method: "POST",
      body: JSON.stringify({
        packageBytes: await fileToBase64(file),
        overwrite,
        targetVersion,
        commitMsg,
      }),
    }),
  batchUpload: async (files: File[], overwrite = true) => {
    const versions: SkillVersion[] = [];
    for (const file of files) {
      versions.push(await skillApi.upload(file, overwrite));
    }
    return versions;
  },
  remove: (skillName: string) =>
    request<string>(`/v1/skills/${encodeURIComponent(skillName)}`, {
      method: "DELETE",
    }),
  publish: (skillName: string, version: string) =>
    request<string>(
      `/v1/skills/${encodeURIComponent(skillName)}/versions/${encodeURIComponent(version)}:publish`,
      { method: "POST", body: "{}" },
    ),
  submit: (skillName: string, version: string) =>
    request<string>(
      `/v1/skills/${encodeURIComponent(skillName)}/versions/${encodeURIComponent(version)}:submit`,
      { method: "POST", body: "{}" },
    ),
  online: (skillName: string, version: string) =>
    request<string>(
      `/v1/skills/${encodeURIComponent(skillName)}/versions/${encodeURIComponent(version)}:online`,
      { method: "POST", body: "{}" },
    ),
  offline: (skillName: string, version: string) =>
    request<string>(
      `/v1/skills/${encodeURIComponent(skillName)}/versions/${encodeURIComponent(version)}:offline`,
      { method: "POST", body: "{}" },
    ),
  labels: (skillName: string, labels: Record<string, string>) =>
    skillApi.update(skillName, { name: skillName, labels }),
  downloadUrl: (skillName: string, version: string) =>
    `/v1/skills/${encodeURIComponent(skillName)}/versions/${encodeURIComponent(version)}/download`,
  download: (skillName: string, version: string) =>
    request<SkillPackageDownload>(
      `/v1/skills/${encodeURIComponent(skillName)}/versions/${encodeURIComponent(version)}/download`,
    ),
  files: async (skillName: string, version: string) => {
    const encodedName = encodeURIComponent(skillName);
    const encodedVersion = encodeURIComponent(version);
    const versionMeta = await request<SkillVersion>(
      `/v1/skills/${encodedName}/versions/${encodedVersion}`,
    );
    if (versionMeta.status === "draft") {
      return request<SkillFileList>(
        `/v1/skills/${encodedName}/draft/files?${toQuery({ version })}`,
      );
    }
    return request<SkillFileList>(
      `/v1/skills/${encodedName}/versions/${encodedVersion}/files`,
    );
  },
  file: async (skillName: string, version: string, path: string) => {
    const encodedName = encodeURIComponent(skillName);
    const encodedVersion = encodeURIComponent(version);
    const versionMeta = await request<SkillVersion>(
      `/v1/skills/${encodedName}/versions/${encodedVersion}`,
    );
    if (versionMeta.status === "draft") {
      return request<SkillFileContent>(
        `/v1/skills/${encodedName}/draft/file?${toQuery({ version, path })}`,
      );
    }
    return request<SkillFileContent>(
      `/v1/skills/${encodedName}/versions/${encodedVersion}/file?${toQuery({ path })}`,
    );
  },
  /** Save (create or update) a single text file in a draft/editing version. */
  saveFile: (skillName: string, version: string, path: string, content: string, commitMsg = "") =>
    request<SkillFileContent>(
      `/v1/skills/${encodeURIComponent(skillName)}/draft/file`,
      {
        method: "PUT",
        body: JSON.stringify({
          version,
          path,
          type: contentTypeForPath(path),
          content,
          commitMsg,
          createParents: true,
        }),
      },
    ),
  /** Create a new empty file or folder. */
  createFile: (skillName: string, version: string, path: string, type: "file" | "dir" = "file", content = "") => {
    const encodedName = encodeURIComponent(skillName);
    if (type === "dir") {
      return request<SkillFileContent>(`/v1/skills/${encodedName}/draft/dir`, {
        method: "POST",
        body: JSON.stringify({ version, path }),
      });
    }
    return request<SkillFileContent>(`/v1/skills/${encodedName}/draft/file`, {
      method: "PUT",
      body: JSON.stringify({
        version,
        path,
        type: contentTypeForPath(path),
        content,
        createParents: true,
      }),
    });
  },
  /** Delete a file or directory from a draft version. */
  deleteFile: (skillName: string, version: string, path: string) =>
    request<unknown>(
      `/v1/skills/${encodeURIComponent(skillName)}/draft/path?${toQuery({ version, path, recursive: true })}`,
      {
        method: "DELETE",
      },
    ),
  /** Rename or move a file/directory inside a draft version. */
  renameFile: (skillName: string, version: string, oldPath: string, newPath: string) =>
    request<unknown>(
      `/v1/skills/${encodeURIComponent(skillName)}/draft/path:move`,
      {
        method: "POST",
        body: JSON.stringify({ version, oldPath, newPath, overwrite: false }),
      },
    ),
  /** Ensure a draft version exists for editing; creates one if the skill only has published versions. */
  ensureDraftVersion: async (skillName: string, baseVersion = "") => {
    const detail = await skillApi.detail(skillName);
    const existing = (detail.versions || []).find((v) => v.status === "draft");
    if (existing?.version) return { version: existing.version, created: false };
    const base = baseVersion || detail.version || detail.latestVersion || "0.0.1";
    const draftVersion = base.endsWith("-draft") ? base : `${base}-draft`;
    const encodedName = encodeURIComponent(skillName);
    const encodedBase = encodeURIComponent(base);
    const baseFiles = await request<SkillFileList>(
      `/v1/skills/${encodedName}/versions/${encodedBase}/files`,
    ).catch(() => ({ files: [] }));
    for (const file of baseFiles.files || []) {
      if (!file.path) continue;
      if (file.type === "directory") {
        await request<SkillFileContent>(`/v1/skills/${encodedName}/draft/dir`, {
          method: "POST",
          body: JSON.stringify({ version: draftVersion, path: file.path }),
        });
        continue;
      }
      const content = await request<SkillFileContent>(
        `/v1/skills/${encodedName}/versions/${encodedBase}/file?${toQuery({ path: file.path })}`,
      );
      await request<SkillFileContent>(`/v1/skills/${encodedName}/draft/file`, {
        method: "PUT",
        body: JSON.stringify({
          version: draftVersion,
          path: file.path,
          type: file.type || contentTypeForPath(file.path),
          content: content.content || "",
          binary: Boolean(content.binary || file.binary),
          createParents: true,
        }),
      });
    }
    return { version: draftVersion, created: true };
  },
  commitDraft: (skillName: string, version: string, opts: {
    commitMsg?: string;
    overwrite?: boolean;
    submit?: boolean;
    publish?: boolean;
    online?: boolean;
  } = {}) =>
    request<SkillVersion>(`/v1/skills/${encodeURIComponent(skillName)}/draft:commit`, {
      method: "POST",
      body: JSON.stringify({
        version,
        commitMsg: opts.commitMsg || "",
        overwrite: opts.overwrite ?? true,
        submit: opts.submit ?? false,
        publish: opts.publish ?? false,
        online: opts.online ?? false,
      }),
    }),
  compare: async (skillName: string, baseVersion: string, targetVersion: string) => {
    const [baseFiles, targetFiles] = await Promise.all([
      skillApi.files(skillName, baseVersion),
      skillApi.files(skillName, targetVersion),
    ]);
    const [baseSkillMd, targetSkillMd] = await Promise.all([
      skillApi.file(skillName, baseVersion, "SKILL.md").then((f) => f.content || "").catch(() => ""),
      skillApi.file(skillName, targetVersion, "SKILL.md").then((f) => f.content || "").catch(() => ""),
    ]);
    return {
      baseVersion,
      targetVersion,
      baseSkillMd,
      targetSkillMd,
      baseFiles: baseFiles.files || [],
      targetFiles: targetFiles.files || [],
    };
  },
  update: async (skillName: string, data: Partial<Skill>) => {
    // The backend PUT is not a sparse PATCH: protobuf default values make omitted
    // strings indistinguishable from empty strings. Always merge with current detail
    // first, so settings panels do not accidentally reset visibility/status/metadata.
    const current = normalizeSkill(
      await request<Skill>(`/v1/skills/${encodeURIComponent(skillName)}`),
    );
    const tags = mergeUniqueTags(
      (data as any).tags ?? current.tags,
      data.keywords ?? current.keywords,
      data.bizTags ?? current.bizTags,
    );
    const updated = await request<Skill>(
      `/v1/skills/${encodeURIComponent(skillName)}`,
      {
        method: "PUT",
        body: JSON.stringify({
          name: skillName,
          displayName: data.displayName ?? current.displayName ?? "",
          description: data.description ?? current.description ?? "",
          version: data.version ?? current.version ?? "",
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
    const created = await request<Skill>("/v1/skills", {
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
    skillApi.publish(skillName, version),
  redraft: (skillName: string, version: string) =>
    skillApi.ensureDraftVersion(skillName, version),
  bizTags: (skillName: string, tags: string[]) =>
    skillApi.update(skillName, { name: skillName, tags, bizTags: tags }),
  metadata: (skillName: string, metadata: Record<string, unknown>) =>
    skillApi.update(skillName, { name: skillName, metadata }),
  scope: async (skillName: string, scope: string) => {
    const visibility = String(scope || "").toLowerCase();
    if (visibility !== "private" && visibility !== "public") {
      throw new Error("Skill visibility must be private or public");
    }
    const updated = await request<Skill>(
      `/v1/skills/${encodeURIComponent(skillName)}:visibility`,
      {
        method: "POST",
        body: JSON.stringify({ name: skillName, visibility }),
      },
    );
    return normalizeSkill(updated);
  },
};

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

// ─── IAM Service API (aisphere-iam /v1/iam/*) ──────────────────────────
// These endpoints talk directly to the aisphere-iam service.
// The IAM service URL is configured via NEXT_PUBLIC_IAM_URL env var
// (defaults to http://127.0.0.1:18080 for local dev).

const configuredIamUrl = process.env.NEXT_PUBLIC_IAM_URL;
const IAM_URL: string = (
  configuredIamUrl === undefined ? 'http://127.0.0.1:18080' : configuredIamUrl
).replace(/\/+$/, '');

function iamRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const fullUrl = IAM_URL + path;
  const headers = new Headers(init.headers || []);
  const token = getToken();
  if (!IS_GATEWAY_OIDC && token) headers.set('Authorization', `Bearer ${token}`);
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

  /** List projects */
  listProjects: () =>
    iamRequest<{ projects: IamProject[] }>('/v1/iam/control-plane/projects'),

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
  /**
   * Query audit records. Mirrors the new hub's /v1/audit/records RPC.
   *
   * Filter fields are all optional — empty fields are wildcards.
   * Returns records sorted by time descending (newest first).
   */
  list: (params: Record<string, unknown> = {}) =>
    request<{
      records: AuditLog[];
      total: number;
    }>(`/v1/audit/records?${toQuery(params)}`),
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

export const sharesApi = {
  list: async (
    resourceType: AihubResourceType,
    resourceId: string,
    _params: Record<string, unknown> = {},
  ) => {
    if (resourceType !== 'skill') {
      // Non-skill resources not yet supported in new hub.
      return { items: [], total: 0, accessMode: 'private', canManage: false } as ShareListResponse;
    }
    const [raw, skill] = await Promise.all([
      request<{
      shares?: Array<{
        resourceType?: string;
        resourceId?: string;
        relation?: string;
        subjectType?: string;
        subjectId?: string;
        subjectRelation?: string;
      }>;
      }>(`/v1/skills/${encodeURIComponent(resourceId)}/shares`),
      request<Skill>(`/v1/skills/${encodeURIComponent(resourceId)}`).catch(() => null),
    ]);
    const items: ResourceGrant[] = (raw.shares || []).map((s) => ({
      id: buildGrantId(s.subjectType || 'user', s.subjectId || ''),
      app: 'aihub',
      resourceType: 'skill',
      resourceId,
      object: `skill:${resourceId}`,
      subjectType: (s.subjectType || 'user') as ResourceGrant['subjectType'],
      subjectId: s.subjectId || '',
      role: normalizeShareRole(s.relation),
      effect: 'allow',
      actions: [],
    }));
    if (skill?.visibility === "public" && !items.some((x) => x.subjectType === "public")) {
      items.unshift(publicGrant("skill", resourceId));
    }
    return {
      items,
      total: items.length,
      accessMode: skill?.visibility === "public" ? "public" : deriveAccessMode(items),
      canManage: true,
    } as ShareListResponse;
  },

  create: async (
    resourceType: AihubResourceType,
    resourceId: string,
    body: CreateShareRequest,
  ) => {
    if (resourceType !== 'skill') {
      throw new Error(`sharing for ${resourceType} not yet supported in new hub`);
    }
    if (body.subjectType === "public") {
      await skillApi.scope(resourceId, "public");
      return publicGrant("skill", resourceId);
    }
    const raw = await request<{
      resourceType?: string;
      resourceId?: string;
      relation?: string;
      subjectType?: string;
      subjectId?: string;
      subjectRelation?: string;
    }>(`/v1/skills/${encodeURIComponent(resourceId)}/shares`, {
      method: "POST",
      body: JSON.stringify({
        relation: toBackendShareRole(resourceType, body.role),
        subjectType: body.subjectType,
        subjectId: body.subjectId,
        subjectRelation: body.subjectRelation,
      }),
    });
    return {
      id: buildGrantId(raw.subjectType || body.subjectType, raw.subjectId || body.subjectId),
      app: 'aihub',
      resourceType: 'skill',
      resourceId,
      object: `skill:${resourceId}`,
      subjectType: (raw.subjectType || body.subjectType) as ResourceGrant['subjectType'],
      subjectId: raw.subjectId || body.subjectId,
      role: normalizeShareRole(raw.relation),
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
      throw new Error(`sharing for ${resourceType} not yet supported in new hub`);
    }
    const { subjectType, subjectId } = parseGrantId(grantId);
    if (subjectType === "public") {
      return skillApi.scope(resourceId, "private");
    }
    return request<unknown>(
      `/v1/skills/${encodeURIComponent(resourceId)}/shares/${encodeURIComponent(subjectType)}/${encodeURIComponent(subjectId)}`,
      { method: "DELETE" },
    );
  },

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
