import { request, toQuery } from './client';

export type ResourceStatus = 'active' | 'disabled';
export type ModelApiFormat =
  | 'chat_completions'
  | 'responses'
  | 'claude_code'
  | 'gemini'
  | 'custom';
export type ReasoningMode = 'inherit' | 'auto' | 'enabled' | 'disabled';
export type ReasoningEffort =
  | 'inherit'
  | 'none'
  | 'minimal'
  | 'low'
  | 'medium'
  | 'high'
  | 'max';

export interface ModelCapabilities {
  chat: boolean;
  toolCalling: boolean;
  streaming: boolean;
  structuredOutput: boolean;
  visionInput: boolean;
  audioInput: boolean;
  audioOutput: boolean;
  embedding: boolean;
  rerank: boolean;
}

export interface ReasoningCapability {
  supported: boolean;
  modes: Array<'auto' | 'enabled' | 'disabled' | string>;
  effortLevels: Array<Exclude<ReasoningEffort, 'inherit'> | string>;
  defaultMode: 'auto' | 'enabled' | 'disabled' | string;
  defaultEffort: Exclude<ReasoningEffort, 'inherit'> | string;
  supportsBudgetTokens: boolean;
  preserveReasoningContent: boolean;
  notes?: string;
}

export interface ModelResource {
  id: string;
  code: string;
  displayName: string;
  description?: string;
  status: ResourceStatus | string;
  vendor: string;
  family?: string;
  modelType: string;
  capabilities: ModelCapabilities;
  reasoning: ReasoningCapability;
  providerConfig?: Record<string, unknown>;
  orgId?: string;
  projectId?: string;
  createTime?: string;
  updateTime?: string;
}

export interface ModelWriteRequest {
  code: string;
  displayName: string;
  description?: string;
  status: ResourceStatus;
  vendor: string;
  family?: string;
  modelType: string;
  capabilities: ModelCapabilities;
  reasoning: ReasoningCapability;
  providerConfig?: Record<string, unknown>;
  projectId?: string;
}

export interface EndpointLimits {
  contextWindow: number;
  maxOutputTokens: number;
}

export interface ReasoningMapping {
  strategy: 'none' | 'field_map' | string;
  modeField?: string;
  enabledValue?: unknown;
  disabledValue?: unknown;
  autoValue?: unknown;
  effortField?: string;
  effortMap?: Record<string, string>;
  budgetField?: string;
  responseField?: string;
  preserveOnTool?: boolean;
}

export interface ModelEndpoint {
  id: string;
  modelId: string;
  displayName: string;
  description?: string;
  status: ResourceStatus | string;
  adapter: string;
  apiFormat: ModelApiFormat;
  baseUrl: string;
  providerModelId: string;
  apiPath?: string;
  credentialRef?: string;
  limits: EndpointLimits;
  reasoningMapping: ReasoningMapping;
  requestDefaults?: Record<string, unknown>;
  providerConfig?: Record<string, unknown>;
  healthStatus?: 'unknown' | 'healthy' | 'degraded' | 'unhealthy' | string;
  lastCheckedAt?: string;
  orgId?: string;
  projectId?: string;
  createTime?: string;
  updateTime?: string;
}

export interface ModelEndpointWriteRequest {
  modelId: string;
  displayName: string;
  description?: string;
  status: ResourceStatus;
  adapter: string;
  apiFormat: ModelApiFormat;
  baseUrl: string;
  providerModelId: string;
  apiPath?: string;
  credentialRef?: string;
  limits: EndpointLimits;
  reasoningMapping: ReasoningMapping;
  requestDefaults?: Record<string, unknown>;
  providerConfig?: Record<string, unknown>;
  projectId?: string;
}

export interface ModelEndpointTestResult {
  healthy: boolean;
  reachable: boolean;
  httpStatus: number;
  latencyMs: number;
  healthStatus: 'healthy' | 'degraded' | 'unhealthy' | string;
  message: string;
  checkedAt: string;
}

export interface ReasoningPolicy {
  mode: ReasoningMode;
  effort: ReasoningEffort;
  budgetTokens?: number;
  exposeReasoning?: boolean;
  providerOverrides?: Record<string, unknown>;
}

export interface ModelProfileV2 {
  id: string;
  code: string;
  displayName: string;
  description?: string;
  status: ResourceStatus | string;
  endpointId: string;
  limits: EndpointLimits;
  reasoningPolicy: ReasoningPolicy;
  defaultParameters?: Record<string, unknown>;
  allowedTools?: string[];
  latestRevision: number;
  orgId?: string;
  projectId?: string;
  createTime?: string;
  updateTime?: string;
}

export interface ModelProfileWriteRequest {
  code: string;
  displayName: string;
  description?: string;
  status: ResourceStatus;
  endpointId: string;
  limits: EndpointLimits;
  reasoningPolicy: ReasoningPolicy;
  defaultParameters?: Record<string, unknown>;
  allowedTools?: string[];
  commitMsg?: string;
  projectId?: string;
}

export interface ModelProfileRevision {
  profileId: string;
  revision: number;
  snapshot: Record<string, unknown>;
  sha256: string;
  author: string;
  commitMsg: string;
  createTime: string;
}

export interface ModelRuntimeSnapshot {
  profileId: string;
  revision: number;
  sha256: string;
  logicalName: string;
  generatedAt: string;
  profile: Record<string, unknown>;
  model: Record<string, unknown>;
  endpoint: Record<string, unknown>;
  reasoning: {
    policy: ReasoningPolicy;
    providerRequestPatch: Record<string, unknown>;
    responseField?: string;
    preserveOnTool?: boolean;
  };
}

interface ListResponse<T> {
  items: T[];
  nextPageToken?: string;
}

interface ModelResponse {
  model: ModelResource;
}

interface EndpointResponse {
  endpoint: ModelEndpoint;
}

interface ProfileResponse {
  profile: ModelProfileV2;
  revision?: number;
  revisions?: ModelProfileRevision[];
}

export const modelManagementApi = {
  listModels: (params: Record<string, unknown> = {}) =>
    request<ListResponse<ModelResource>>(`/v1/models?${toQuery(params)}`),
  getModel: (id: string) =>
    request<ModelResponse>(`/v1/models/${encodeURIComponent(id)}`),
  createModel: (body: ModelWriteRequest) =>
    request<ModelResponse>('/v1/models', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateModel: (id: string, body: ModelWriteRequest) =>
    request<ModelResponse>(`/v1/models/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  deleteModel: (id: string) =>
    request<{ modelId: string }>(`/v1/models/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  listEndpoints: (params: Record<string, unknown> = {}) =>
    request<ListResponse<ModelEndpoint>>(
      `/v1/model-endpoints?${toQuery(params)}`,
    ),
  getEndpoint: (id: string) =>
    request<EndpointResponse>(`/v1/model-endpoints/${encodeURIComponent(id)}`),
  createEndpoint: (body: ModelEndpointWriteRequest) =>
    request<EndpointResponse>('/v1/model-endpoints', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateEndpoint: (id: string, body: ModelEndpointWriteRequest) =>
    request<EndpointResponse>(`/v1/model-endpoints/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  deleteEndpoint: (id: string) =>
    request<{ endpointId: string }>(
      `/v1/model-endpoints/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
  testEndpoint: (id: string) =>
    request<ModelEndpointTestResult>(
      `/v1/model-endpoints/${encodeURIComponent(id)}/test`,
      { method: 'POST' },
    ),

  listProfiles: (params: Record<string, unknown> = {}) =>
    request<ListResponse<ModelProfileV2>>(
      `/v1/model-profiles?${toQuery(params)}`,
    ),
  getProfile: (id: string) =>
    request<ProfileResponse>(`/v1/model-profiles/${encodeURIComponent(id)}`),
  createProfile: (body: ModelProfileWriteRequest) =>
    request<ProfileResponse>('/v1/model-profiles', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateProfile: (id: string, body: ModelProfileWriteRequest) =>
    request<ProfileResponse>(`/v1/model-profiles/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  deleteProfile: (id: string) =>
    request<{ profileId: string }>(
      `/v1/model-profiles/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
  resolveProfile: (id: string, revision?: number) =>
    request<ModelRuntimeSnapshot>(
      `/v1/model-profiles/${encodeURIComponent(id)}:resolve${
        revision ? `?revision=${revision}` : ''
      }`,
      { method: 'POST' },
    ),
};
