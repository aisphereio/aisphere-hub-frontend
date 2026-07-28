import { request, toQuery } from './client';
import type {
  AgentListItem,
  AgentResponse,
  AgentRuntimeSnapshot,
  AgentUpsertRequest,
  Page,
} from './types';

export type AgentApprovalMode = 'always' | 'per_run' | 'disabled';

export interface AgentIAMPermission {
  resourceType: string;
  permission: string;
  enforcement: 'iam_at_resource_service' | string;
}

export interface AgentToolApproval {
  tool: string;
  version?: string;
  required?: boolean;
  approvalMode: AgentApprovalMode | string;
  approved: boolean;
  capabilities?: string[];
  permissions?: AgentIAMPermission[];
}

export interface AgentRunPlan {
  agentId: string;
  agentVersion: string;
  agentRevision?: string;
  principalSubject?: string;
  principalPropagation: 'trusted_internal_context' | string;
  iamEnforcement: 'resource_service' | string;
  requiresApproval: boolean;
  approvalConfirmed: boolean;
  tools: AgentToolApproval[];
}

export interface AgentRunRequest {
  runtimeId?: string;
  sessionId?: string;
  version?: string;
  approvalConfirmed?: boolean;
  approvedTools?: string[];
}

export interface AgentRuntimeSnapshotV1 extends AgentRuntimeSnapshot {
  policy?: string;
  authorization?: AgentRunPlan;
  tools?: Record<string, unknown>[];
}

export const agentApiV1 = {
  list: (params: Record<string, unknown> = {}) =>
    request<Page<AgentListItem>>(`/v1/agents?${toQuery(params)}`),
  detail: (agentId: string) =>
    request<AgentResponse>(`/v1/agents/${encodeURIComponent(agentId)}`),
  create: (data: AgentUpsertRequest) =>
    request<AgentResponse>('/v1/agents', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (agentId: string, data: AgentUpsertRequest) =>
    request<AgentResponse>(`/v1/agents/${encodeURIComponent(agentId)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  remove: (agentId: string) =>
    request<unknown>(`/v1/agents/${encodeURIComponent(agentId)}`, {
      method: 'DELETE',
    }),
  planRun: (agentId: string, body: AgentRunRequest = {}) =>
    request<AgentRunPlan>(`/v1/agents/${encodeURIComponent(agentId)}:plan-run`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  resolve: (agentId: string, body: AgentRunRequest = {}) =>
    request<AgentRuntimeSnapshotV1>(`/v1/agents/${encodeURIComponent(agentId)}:resolve`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};
