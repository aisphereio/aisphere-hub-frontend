export type Page<T> = {
  items?: T[];
  skills?: T[];
  versions?: T[];
  files?: T[];
  shares?: T[];
  total?: number;
  pageNo?: number;
  pageSize?: number;
  list?: T[];
  data?: T[];
  pageItems?: T[];
  totalCount?: number;
};

export type SkillVisibility = 'private' | 'internal' | 'public';

export type Skill = {
  namespaceId?: string;
  namespaceID?: string;
  name: string;
  displayName?: string;
  description?: string;
  version?: string;
  status?: string;
  visibility?: SkillVisibility;
  scope?: SkillVisibility;
  owner?: string;
  ownerId?: string;
  orgId?: string;
  projectId?: string;
  sourceType?: string;
  sourceUri?: string;
  manifestJson?: string;
  enable?: boolean;
  labels?: Record<string, string>;
  latestVersion?: string;
  stableVersion?: string;
  grayVersion?: string;
  editingVersion?: string;
  reviewingVersion?: string;
  versions?: SkillVersion[];
  bizTags?: string[] | string;
  groups?: string[];
  /** Names of SkillSets this skill belongs to (backend-derived) */
  skillsets?: string[];
  keywords?: string[];
  metadata?: Record<string, unknown>;
  tags?: string[];
  onlineVersion?: string;
  downloadCount?: number;
  onlineCnt?: number;
  createTime?: number | string;
  updateTime?: number | string;
};

export type SkillVersion = {
  id?: number;
  skillName?: string;
  version: string;
  status?: string;
  md5?: string;
  sha256?: string;
  revision?: string;
  sizeBytes?: number;
  contentMd5?: string;
  createTime?: number | string;
  updateTime?: number | string;
  createdAt?: string;
  updatedAt?: string;
  commitMsg?: string;
  description?: string;
  author?: string;
  downloadCount?: number;
  skill?: Skill;
  skillCard?: unknown;
  manifestJson?: string;
};

/**
 * Skill file-content API types. These mirror the GitLab/Gitea
 * repository-files REST shape exposed by the hub FileService. Content
 * is base64-encoded end-to-end (proto field is declared base64 and the
 * backend actually encodes it); the adapter handles encode/decode so
 * UI components always see plaintext strings.
 */
export type SkillFileEntry = {
  name: string;
  path: string;
  type: "file" | "dir" | "symlink" | "commit";
  size: number;
  mode: string;
  sha: string;
  lastModified?: string;
};

export type SkillFile = {
  name: string;
  path: string;
  sha: string;
  size: number;
  content: string; // plaintext, already base64-decoded by the adapter
  encoding: "base64";
  ref: string;
  commitSha?: string;
  commitMessage?: string;
  lastModified?: string;
};

export type SkillSet = {
  namespaceId?: string;
  name: string;
  displayName?: string;
  description?: string;
  owner?: string;
  scope?: string;
  labels?: Record<string, string>;
  members?: SkillSetMember[];
  createdAt?: string;
  updatedAt?: string;
  downloadCount?: number;
};

export type SkillSetMember = {
  skillName: string;
  version?: string;
  label?: string;
  required?: boolean;
  order?: number;
};

export type AgentSkillRef = {
  name: string;
  version?: string;
  label?: string;
  required?: boolean;
};

export type AgentSkillSetRef = {
  name: string;
  required?: boolean;
};

export type AgentToolRef = {
  name: string;
  version?: string;
  label?: string;
  required?: boolean;
};

export type AgentServiceRef = {
  kind: "agent" | "skill" | "skillset" | "tool" | "mcp" | "workflow" | string;
  name: string;
  alias?: string;
  provider?: "hub" | "inline" | "external" | string;
  version?: string;
  label?: string;
  required?: boolean;
  reload?: "pinned" | "follow_label" | "live" | string;
  mountPath?: string;
  runtime?: Record<string, unknown>;
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  dependsOn?: AgentServiceRef[];
};

export type RuntimeServiceManifest = {
  kind: string;
  name: string;
  alias?: string;
  provider: string;
  object?: string;
  version?: string;
  label?: string;
  revision?: string;
  status?: string;
  required?: boolean;
  reload?: string;
  mountPath?: string;
  changeToken?: string;
  snapshotId?: string;
  runtime?: Record<string, unknown>;
  execution?: Record<string, unknown>;
  config?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  dependsOn?: RuntimeServiceManifest[];
};

export type ToolRuntimeDefinition = {
  type: "builtin" | "mcp" | "openapi" | "http" | "function" | string;
  server?: string;
  name?: string;
  url?: string;
  method?: string;
  package?: string;
  entryPoint?: string;
  headers?: Record<string, string>;
  config?: Record<string, unknown>;
  credentialRef?: string;
  description?: string;
};

export type ToolExecutionDefinition = {
  placement?: "sandbox" | "runtime" | "remote" | "hub" | string;
  runner?:
    | "builtin"
    | "mcp"
    | "stdio"
    | "http"
    | "container"
    | "wasm"
    | "python"
    | "binary"
    | string;
  image?: string;
  command?: string;
  args?: string[];
  workingDir?: string;
  filesystem?: "none" | "readonly" | "workspace" | string;
  network?: "none" | "restricted" | "egress" | string;
  mounts?: Array<{
    name: string;
    ref: string;
    mountPath: string;
    mode?: "ro" | "rw" | string;
  }>;
  env?: Record<string, string>;
  secretRefs?: string[];
  allowHosts?: string[];
  denyHosts?: string[];
  resources?: {
    cpu?: string;
    memory?: string;
    timeoutMillis?: number;
    maxOutputBytes?: number;
  };
  capabilities?: string[];
};

export type ToolRetryPolicy = {
  maxAttempts?: number;
  backoffMillis?: number;
  retryOnErrorCodes?: string[];
};

export type ToolDefinition = {
  runtime: ToolRuntimeDefinition;
  execution?: ToolExecutionDefinition;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  timeoutMillis?: number;
  retry?: ToolRetryPolicy;
  metadata?: Record<string, unknown>;
};

export type ToolVersionRecord = {
  version: string;
  revision?: string;
  sha256?: string;
  author?: string;
  commitMsg?: string;
  createTime?: number;
  definition: ToolDefinition;
};

export type Tool = {
  id: string;
  displayName?: string;
  description?: string;
  status?: string;
  scope?: string;
  labels?: Record<string, string>;
  object?: string;
  latestVersion?: string;
  versions?: Record<string, ToolVersionRecord>;
  ownerSubject?: string;
  createTime?: number;
  updateTime?: number;
};

export type ToolListItem = {
  id: string;
  displayName?: string;
  description?: string;
  status?: string;
  scope?: string;
  latestVersion?: string;
  runtimeType?: string;
  runtimeName?: string;
  object?: string;
  updateTime?: number;
  access?: Record<string, unknown>;
};

export type ToolUpsertRequest = {
  id?: string;
  displayName?: string;
  description?: string;
  status?: string;
  scope?: string;
  labels?: Record<string, string>;
  version?: string;
  commitMsg?: string;
  definition: ToolDefinition;
};

export type ToolResponse = {
  tool: Tool;
  object?: string;
  latestVersion?: string;
};

export type ToolRuntimeSnapshotItem = {
  name: string;
  version: string;
  revision?: string;
  object?: string;
  status?: string;
  runtime: ToolRuntimeDefinition;
  execution?: ToolExecutionDefinition;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  timeoutMillis?: number;
  retry?: ToolRetryPolicy;
  metadata?: Record<string, unknown>;
};

export type ToolRuntimeSnapshot = {
  snapshotId: string;
  runtimeId: string;
  sessionId: string;
  generatedAt: string;
  tool: ToolRuntimeSnapshotItem;
};

export type ToolFailureRecord = {
  id: string;
  object?: string;
  toolId: string;
  toolVersion?: string;
  agentId?: string;
  agentVersion?: string;
  runtimeId?: string;
  sessionId?: string;
  runId?: string;
  traceId?: string;
  snapshotId?: string;
  attempt?: number;
  errorCode?: string;
  errorMessage: string;
  retryable?: boolean;
  inputDigest?: string;
  inputPreview?: string;
  durationMillis?: number;
  metadata?: Record<string, unknown>;
  reporter?: string;
  createTime?: number;
};

export type AgentSandboxRef = {
  profile?: string;
  reuse?: string;
  templateRef?: string;
  warmPoolRef?: string;
};

export type AgentDefinition = {
  entryPoint: string;
  files: Record<string, string>;
  sandbox?: AgentSandboxRef;
  services?: AgentServiceRef[];
  skills?: AgentSkillRef[];
  skillSets?: AgentSkillSetRef[];
  tools?: AgentToolRef[];
};

export type AgentVersionRecord = {
  version: string;
  revision?: string;
  sha256?: string;
  author?: string;
  commitMsg?: string;
  createTime?: number;
  definition: AgentDefinition;
};

export type Agent = {
  id: string;
  displayName?: string;
  description?: string;
  status?: string;
  scope?: string;
  labels?: Record<string, string>;
  object?: string;
  latestVersion?: string;
  versions?: Record<string, AgentVersionRecord>;
  ownerSubject?: string;
  createTime?: number;
  updateTime?: number;
};

export type AgentListItem = {
  id: string;
  displayName?: string;
  description?: string;
  status?: string;
  scope?: string;
  latestVersion?: string;
  object?: string;
  updateTime?: number;
  access?: Record<string, unknown>;
};

export type AgentUpsertRequest = {
  id?: string;
  displayName?: string;
  description?: string;
  status?: string;
  scope?: string;
  labels?: Record<string, string>;
  version?: string;
  commitMsg?: string;
  definition: AgentDefinition;
};

export type AgentResponse = {
  agent: Agent;
  object?: string;
  latestVersion?: string;
};

export type AgentRuntimeSkillSnapshot = {
  name: string;
  version: string;
  revision?: string;
  object?: string;
  sha256?: string;
  md5?: string;
  size?: number;
  downloadUrl?: string;
};

export type AgentRuntimeSnapshot = {
  snapshotId: string;
  runtimeId: string;
  sessionId: string;
  agentId: string;
  agentVersion: string;
  agentRevision: string;
  generatedAt: string;
  policy: string;
  definition: AgentDefinition;
  services: RuntimeServiceManifest[];
  skills: AgentRuntimeSkillSnapshot[];
  tools?: ToolRuntimeSnapshotItem[];
  changeToken?: string;
};

export type RuntimeServicesSnapshot = {
  snapshotId: string;
  runtimeId: string;
  sessionId: string;
  generatedAt: string;
  changeToken: string;
  services: RuntimeServiceManifest[];
};

export type SandboxLimits = {
  cpu?: string;
  memory?: string;
  storage?: string;
  idleTtlSeconds?: number;
  maxSessionSeconds?: number;
};

export type SandboxToolMount = {
  name: string;
  type?: "pvc" | "configmap" | "secret" | "emptyDir" | string;
  ref?: string;
  mountPath: string;
  mode?: "ro" | "rw" | string;
};

export type SandboxNetworkPolicy = {
  mode?: "offline" | "restricted" | "online" | string;
  egressCidrs?: string[];
};

export type SandboxEnsureRequest = {
  sandboxId?: string;
  runtimeId?: string;
  sessionId?: string;
  runId?: string;
  ownerSubject?: string;
  orgId?: string;
  projectId?: string;
  agentId?: string;
  agentVersion?: string;
  snapshotId?: string;
  image?: string;
  imagePullPolicy?: string;
  workspacePvc?: string;
  workspaceSize?: string;
  storageClass?: string;
  network?: SandboxNetworkPolicy;
  restart?: boolean;
  deleteWorkspace?: boolean;
  limits?: SandboxLimits;
  services?: RuntimeServiceManifest[];
  toolMounts?: SandboxToolMount[];
  metadata?: Record<string, unknown>;
};

export type SandboxEndpoint = {
  name: string;
  url: string;
  port?: number;
};

export type SandboxStatus = {
  sandboxId: string;
  namespace?: string;
  driver: string;
  phase: string;
  reason?: string;
  message?: string;
  podName?: string;
  podIp?: string;
  nodeName?: string;
  serviceName?: string;
  workspacePvc?: string;
  image?: string;
  networkMode?: string;
  runtimeId?: string;
  sessionId?: string;
  runId?: string;
  agentId?: string;
  snapshotId?: string;
  endpoints?: SandboxEndpoint[];
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  createdAt?: string;
  updatedAt?: string;
};

export type SandboxToolSchema = {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type SandboxToolListResponse = {
  sandboxId?: string;
  endpoint?: string;
  tools: SandboxToolSchema[];
  modelTools?: Record<string, unknown>[];
};

export type SandboxToolCallRequest = {
  tool: string;
  input?: Record<string, unknown>;
  traceId?: string;
  runId?: string;
  attempt?: number;
  timeoutMillis?: number;
  metadata?: Record<string, unknown>;
};

export type SandboxToolCallResult = {
  ok: boolean;
  sandboxId?: string;
  tool: string;
  result?: Record<string, unknown>;
  error?: { code?: string; message?: string };
  trace?: string;
  traceId?: string;
  durationMillis?: number;
  raw?: Record<string, unknown>;
};

export type Proposal = {
  proposalId: string;
  namespaceId?: string;
  skillName: string;
  baseVersion?: string;
  candidateVersion?: string;
  proposalType?: string;
  status?: string;
  reason?: string;
  overlayRef?: string;
  source?: ProposalSource;
  delta?: Record<string, unknown>;
  evidence?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
};

export type ProposalSource = {
  agentId?: string;
  sessionId?: string;
  runId?: string;
  taskId?: string;
};

export type LocalUser = {
  username: string;
  subjectId?: string;
  subjectType?: string;
  displayName?: string;
  email?: string;
  organization?: string;
  roles?: string[];
  permissions?: string[];
  namespaces?: string[];
  disabled?: boolean;
};

// ─── IAM Service Types (aisphere-iam /v1/iam/*) ────────────────────────

/** IAM Principal (authenticated identity) */
export interface IamPrincipal {
  subjectId: string;
  subjectType: string;
  provider?: string;
  externalId?: string;
  issuer?: string;
  audience?: string[];
  tenantId?: string;
  orgId?: string;
  appId?: string;
  projectId?: string;
  username?: string;
  name?: string;
  email?: string;
  phone?: string;
  roles?: string[];
  groups?: string[];
  scopes?: string[];
  authMethod?: string;
  issuedAt?: string;
  expiresAt?: string;
}

/** IAM Directory User */
export interface IamUser {
  id: string;
  externalId?: string;
  provider?: string;
  orgId?: string;
  username: string;
  displayName?: string;
  email?: string;
  phone?: string;
  roles?: string[];
  groups?: string[];
  enabled?: boolean;
}

/** IAM Directory Organization */
export interface IamOrganization {
  id: string;
  externalId?: string;
  name: string;
  displayName?: string;
  ownerId?: string;
  parentId?: string;
  tags?: string[];
  enabled?: boolean;
}

/** IAM Directory Group */
export interface IamGroup {
  id: string;
  externalId?: string;
  orgId?: string;
  parentId?: string;
  name: string;
  displayName?: string;
  type?: string;
  path?: string;
  users?: string[];
}

/** IAM Control Plane Organization */
export interface IamCpOrganization {
  id: string;
  slug: string;
  displayName?: string;
  status?: string;
  casdoorOrg?: string;
  plan?: string;
  region?: string;
  metadata?: Record<string, string>;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** IAM Control Plane Project */
export interface IamProject {
  id: string;
  orgId: string;
  slug: string;
  displayName?: string;
  description?: string;
  status?: string;
  visibility?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  metadata?: Record<string, string>;
  createdBy?: string;
  owners?: string[];
  joined?: boolean;
  canManage?: boolean;
  stats?: {
    countMembers?: number;
    countResources?: number;
    countSkills?: number;
    countRepositories?: number;
    countAgents?: number;
    countSandboxes?: number;
  };
  createdAt?: string;
  updatedAt?: string;
}

/** IAM Capability */
export interface IamCapability {
  id: string;
  name: string;
  displayName?: string;
  ownerService?: string;
  status?: string;
  configSchema?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** IAM Project Capability */
export interface IamProjectCapability {
  projectId: string;
  capabilityId: string;
  enabled: boolean;
  config?: string;
  quota?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** IAM Resource Type */
export interface IamResourceType {
  type: string;
  capabilityId?: string;
  ownerService?: string;
  displayName?: string;
  description?: string;
  parentTypes?: string[];
  grantable?: boolean;
  auditable?: boolean;
  spicedbType?: string;
  relations?: string[];
  permissions?: string[];
  labels?: Record<string, string>;
  metadata?: Record<string, string>;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** IAM Resource Ref */
export interface IamResourceRef {
  type: string;
  id: string;
}

/** IAM Resource */
export interface IamResource {
  ref: IamResourceRef;
  orgId?: string;
  projectId?: string;
  parent?: IamResourceRef;
  ownerService?: string;
  ownerResourceId?: string;
  slug?: string;
  displayName?: string;
  path?: string;
  status?: string;
  visibility?: string;
  grantable?: boolean;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  metadata?: Record<string, string>;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** IAM Resource Binding */
export interface IamResourceBinding {
  id: string;
  source: IamResourceRef;
  relation: string;
  target: IamResourceRef;
  status?: string;
  metadata?: Record<string, string>;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** IAM Role Template */
export interface IamRoleTemplate {
  id: string;
  resourceType?: string;
  roleKey: string;
  displayName?: string;
  description?: string;
  relation?: string;
  builtIn?: boolean;
  enabled?: boolean;
  sortOrder?: number;
  metadata?: Record<string, string>;
  createdAt?: string;
  updatedAt?: string;
}

/** IAM Grant */
export interface IamGrant {
  id: string;
  resource?: IamResourceRef;
  roleKey?: string;
  relation?: string;
  subject?: { type: string; id: string; relation?: string };
  source?: string;
  reason?: string;
  expiresAt?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  revokedAt?: string;
  consistencyToken?: string;
  metadata?: Record<string, string>;
}

/** IAM Subject Ref */
export interface IamSubjectRef {
  type: string;
  id: string;
  relation?: string;
}

/** IAM Relationship */
export interface IamRelationship {
  resource: IamResourceRef;
  relation: string;
  subject: IamSubjectRef;
}

/** IAM Permission Check Request */
export interface IamCheckPermissionRequest {
  subject: IamSubjectRef;
  resource: IamResourceRef;
  permission: string;
}

/** IAM Permission Check Response */
export interface IamCheckPermissionResponse {
  allowed: boolean;
  reason?: string;
  consistencyToken?: string;
}

export type NamespaceInfo = {
  namespaceId: string;
  displayName?: string;
  description?: string;
  owner?: string;
  visibility?: string;
  metadata?: Record<string, unknown>;
  createTime?: number;
  updateTime?: number;
};

export type NamespaceMember = {
  namespaceId: string;
  subjectId: string;
  subjectType?: string;
  displayName?: string;
  roles?: string[];
  createTime?: number;
  updateTime?: number;
};

export type SkillSocialStats = {
  namespaceId: string;
  skillName: string;
  stars: number;
  ratingAverage: number;
  ratingCount: number;
  subscribers: number;
  myStarred?: boolean;
  mySubscribed?: boolean;
  myRating?: number;
  downloadCount?: number;
  proposalCount?: number;
  governanceOpen?: number;
};

export type AuditLog = {
  id: string;
  namespaceId?: string;
  resourceType?: string;
  resourceName?: string;
  version?: string;
  action: string;
  operator?: string;
  detail?: Record<string, unknown>;
  requestId?: string;
  createTime: number;
};

export type TokenInfo = {
  keyId: string;
  name: string;
  subjectId: string;
  subjectType?: string;
  roles?: string[];
  permissions?: string[];
  namespaces?: string[];
  status?: string;
  expiresAt?: number;
  createTime?: number;
  token?: string;
  tokenHash?: string;
};

export type MetricsSnapshot = {
  uptimeSeconds: number;
  requestsTotal: number;
  errorsTotal: number;
  byPath: Record<string, number>;
  byStatus: Record<string, number>;
  skills?: number;
  groups?: number;
  proposals?: number;
};

export type Notification = {
  id: string;
  namespaceId?: string;
  subjectId?: string;
  targetType?: string;
  targetName?: string;
  eventType?: string;
  title: string;
  message: string;
  payload?: Record<string, unknown>;
  read: boolean;
  createTime?: number;
};

// ─── New Types for Enhanced Features ─────────────────────────────────────────

export type SkillDraft = {
  name: string;
  displayName?: string;
  description?: string;
  scope?: string;
  keywords?: string[];
  bizTags?: string[];
  metadata?: Record<string, unknown>;
  version?: string;
  orgId?: string;
  projectId?: string;
};

export type SkillScopeUpdate = {
  scope: string;
};

export type SkillBizTagsUpdate = {
  bizTags: string[];
};

export type SkillMetadataUpdate = {
  metadata: Record<string, unknown>;
};

export type SkillSetUpdate = {
  displayName?: string;
  description?: string;
  scope?: string;
  labels?: Record<string, string>;
};

export type Tab =
  | "skills"
  | "skillsets"
  | "agents"
  | "tools"
  | "model-profiles"
  | "sandbox-profiles"
  | "sandboxes"
  | "namespaces"
  | "governance"
  | "ops"
  | "proposals"
  | "iam"
  | "access"
  | "authz"
  | "docs";
export type AccessResourceTemplate = {
  area: string;
  object: string;
  action: string;
  description?: string;
};

export type AccessQuickLink = {
  title: string;
  url: string;
};

export type AccessEvaluateResult = {
  allowed: boolean;
  subject: string;
  object: string;
  action: string;
  provider?: string;
};

export type AccessOverview = {
  provider: string;
  endpoint?: string;
  owner?: string;
  permissionId?: string;
  modelId?: string;
  resourceId?: string;
  enforcerId?: string;
  subjectFormat?: string;
  resolvedSubject?: string;
  cacheTTLSeconds?: number;
  failClosed?: boolean;
  principal?: Record<string, unknown>;
  resources?: AccessResourceTemplate[];
  quickLinks?: AccessQuickLink[];
};

export type SkillSetDetailTab =
  | "overview"
  | "members"
  | "manifest"
  | "settings"
  | "shares";

// ─── AIHub Resource Sharing (IAM ResourceGrant) ─────────────────────
// Replaces the legacy `scope: PUBLIC | PRIVATE` mechanism.
// Sharing is now expressed via ResourceGrant records; the visible
// "access mode" (private / shared / public) is derived from the grants.

export type AihubResourceType =
  | "skill"
  | "skillset"
  | "agent"
  | "tool"
  | "mcp"
  | "service"
  | "app"
  | "agent-service"
  | "runtime"
  | "workflow"
  | "run"
  | "proposal"
  | "knowledge"
  | "modelkey";

export type ShareSubjectType =
  | "user" // specific user, e.g. aisphere/test_viewer
  | "group" // IAM group, supports multi-level, e.g. org-a/platform/devops
  | "org" // organization, e.g. org-hongmei
  | "project" // project, e.g. project-hongmei-prod
  | "app" // application/service principal
  | "service" // service principal
  | "agent" // agent principal
  | "workflow" // workflow principal
  | "runtime" // runtime/sandbox principal
  | "public"; // public access, subjectId can be empty or '*'

export type ShareRole =
  | "viewer" // read-only
  | "consumer" // read/download/use Skill at runtime
  | "runner" // legacy frontend alias; mapped to consumer for Skill shares
  | "editor" // read/write, publish, rollback
  | "reviewer" // approve/reject proposals
  | "admin" // manage resource and shares
  | "owner"; // resource owner, frontend should not create this

export type AccessMode = "private" | "internal" | "shared" | "public";

export interface ResourceGrant {
  id: string;
  app?: string; // 'aihub'
  orgId?: string;
  projectId?: string;

  resourceType: AihubResourceType;
  resourceId: string;
  object?: string; // 'aihub:skill:demo-skill'

  subjectType: ShareSubjectType;
  subjectId: string;
  subjectName?: string;

  role: ShareRole;
  effect?: "allow" | "deny";
  actions?: string[];
  expiresAt?: number;

  createdBy?: string;
  createdAt?: string | number;
  updatedAt?: string | number;
  metadata?: Record<string, string>;
}

export interface CreateShareRequest {
  subjectType: ShareSubjectType;
  subjectId: string;
  subjectRelation?: string;
  role: ShareRole;
  actions?: string[];
  orgId?: string;
  projectId?: string;
  effect?: "allow" | "deny";
  expiresAt?: number;
  metadata?: Record<string, string>;
}

export interface ShareListResponse {
  items: ResourceGrant[];
  total?: number;
  limit?: number;
  offset?: number;
  // Optional hints from backend; if absent, frontend derives them.
  accessMode?: AccessMode;
  visibility?: SkillVisibility;
  governingOrgId?: string;
  canManage?: boolean;
}

// Derive the visible access mode from a list of grants, when the backend
// does not return `accessMode` directly.
export function deriveAccessMode(items: ResourceGrant[]): AccessMode {
  if (items.some((x) => x.subjectType === "public" && x.effect !== "deny")) {
    return "public";
  }
  if (
    items.some(
      (x) =>
        [
          "user",
          "group",
          "org",
          "project",
          "app",
          "service",
          "agent",
          "workflow",
          "runtime",
        ].includes(x.subjectType) && x.effect !== "deny",
    )
  ) {
    return "shared";
  }
  return "private";
}

export interface SandboxProfile {
  id: string;
  version?: string;
  status?: string;
  displayName?: string;
  description?: string;
  driver?: string;
  templateRef?: string;
  warmPoolRef?: string;
  network?: { mode?: string; egressCidrs?: string[] };
  workspace?: { size?: string; mountPath?: string; reuse?: string };
  resources?: Record<string, string>;
  capabilities?: {
    browser?: boolean;
    shell?: boolean;
    mcp?: boolean;
    online?: boolean;
    customTools?: boolean;
  };
  builtinTools?: string[];
  labels?: Record<string, string>;
  metadata?: Record<string, unknown>;
}
export interface SandboxPolicy {
  id: string;
  targetType: string;
  targetId: string;
  allowedProfiles?: string[];
  limits?: Record<string, unknown>;
}

export interface ModelProfile {
  id: string;
  version?: string;
  status?: string;
  displayName?: string;
  description?: string;
  provider?: string;
  apiFormat?: string;
  endpoint?: string;
  model?: string;
  upstreamModel?: string;
  upstreamPath?: string;
  secretRef?: string;
  allowedTools?: string[];
  limits?: { maxInputTokens?: number; maxOutputTokens?: number };
  reasoning?: Record<string, unknown>;
  labels?: Record<string, string>;
  metadata?: Record<string, unknown>;
}
