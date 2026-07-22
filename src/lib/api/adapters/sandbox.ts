/**
 * sandboxApi — adapter over the orval-generated SandboxService client.
 *
 * The generated client (generated/sandbox-service/sandbox-service.ts) speaks
 * protojson: every field is camelCase and optional, and the RPCs take a path
 * param (clusterId / namespaceId / id) as the first argument followed by a
 * params or body object. This adapter hides that shape behind a flat,
 * typed module so hooks and pages can call e.g.
 *   sandboxApi.createSandbox({ namespaceId, name, templateId })
 * without juggling positional path args.
 *
 * Sandboxes are scoped to a Namespace (which itself lives under a Cluster):
 *   - SandboxTemplates are cluster-scoped (/v1/clusters/{id}/sandbox-templates)
 *   - Sandboxes / WarmPools / Claims are namespace-scoped
 *     (/v1/namespaces/{id}/sandboxes, warm-pools, sandbox-claims)
 *   - Per-sandbox operations (get/delete/tools/call) use /v1/sandboxes/{id}
 *
 * Mutations that touch remote state (delete) require an expectedRevision for
 * optimistic-concurrency; the adapter passes '0' when the caller omits it,
 * matching the behavior of the cluster/namespace pages.
 */
import {
  sandboxServiceCallSandboxTool,
  sandboxServiceCreateSandbox,
  sandboxServiceCreateSandboxClaim,
  sandboxServiceCreateSandboxTemplate,
  sandboxServiceCreateWarmPool,
  sandboxServiceDeleteSandbox,
  sandboxServiceDeleteSandboxTemplate,
  sandboxServiceGetSandbox,
  sandboxServiceListSandboxClaims,
  sandboxServiceListSandboxTemplates,
  sandboxServiceListSandboxTools,
  sandboxServiceListSandboxes,
  sandboxServiceListWarmPools,
  sandboxServiceSyncSandboxes,
} from '../generated/sandbox-service/sandbox-service';
import type {
  SandboxServiceCallSandboxToolBody,
  SandboxServiceCreateSandboxBody,
  SandboxServiceCreateSandboxClaimBody,
  SandboxServiceCreateSandboxTemplateBody,
  SandboxServiceCreateWarmPoolBody,
  SandboxServiceDeleteSandboxParams,
  SandboxServiceDeleteSandboxTemplateParams,
  SandboxServiceListSandboxClaimsParams,
  SandboxServiceListSandboxTemplatesParams,
  SandboxServiceListSandboxesParams,
  SandboxServiceListWarmPoolsParams,
  V1CallSandboxToolResponse,
  V1ListSandboxClaimsResponse,
  V1ListSandboxTemplatesResponse,
  V1ListSandboxToolsResponse,
  V1ListSandboxesResponse,
  V1ListWarmPoolsResponse,
  V1Sandbox,
  V1SandboxClaim,
  V1SandboxTemplate,
  V1SyncSandboxesResponse,
  V1WarmPool,
} from '../generated/model';

/** Revision sentinel used when the caller does not have a tracked revision. */
const DEFAULT_REVISION = '0';

/** Page-size used by the console list calls. */
const DEFAULT_PAGE_SIZE = 200;

export interface ListSandboxTemplatesInput {
  clusterId: string;
  pageSize?: number;
  pageToken?: string;
}

export interface CreateSandboxTemplateInput {
  clusterId: string;
  name: string;
  displayName?: string;
  description?: string;
  image: string;
  /** Container entrypoint command, encoded as a JSON array string. */
  containerCommand?: string;
  labels?: Record<string, string>;
  ownerType?: string;
  ownerId?: string;
}

export interface DeleteSandboxTemplateInput {
  id: string;
  expectedRevision?: string;
}

export interface ListSandboxesInput {
  namespaceId: string;
  pageSize?: number;
  pageToken?: string;
}

export interface CreateSandboxInput {
  namespaceId: string;
  name: string;
  templateId?: string;
  warmPoolId?: string;
  labels?: Record<string, string>;
  ownerType?: string;
  ownerId?: string;
}

export interface DeleteSandboxInput {
  id: string;
  expectedRevision?: string;
  deletePolicy?: 'DELETE_POLICY_DETACH_ONLY' | 'DELETE_POLICY_CASCADE';
}

export interface CreateWarmPoolInput {
  namespaceId: string;
  name: string;
  templateId: string;
  replicas: number;
  ownerType?: string;
  ownerId?: string;
}

export interface CreateSandboxClaimInput {
  namespaceId: string;
  name: string;
  warmPoolId: string;
  ownerType?: string;
  ownerId?: string;
}

export interface CallSandboxToolInput {
  id: string;
  tool: string;
  /** Tool arguments as a JSON-encoded string (matches the proto field). */
  inputJson?: string;
  traceId?: string;
}

export const sandboxApi = {
  /** List SandboxTemplates under a cluster. */
  listSandboxTemplates: async ({
    clusterId,
    pageSize,
    pageToken,
  }: ListSandboxTemplatesInput): Promise<V1ListSandboxTemplatesResponse> => {
    const params: SandboxServiceListSandboxTemplatesParams = {
      pageSize: pageSize ?? DEFAULT_PAGE_SIZE,
      pageToken,
    };
    return sandboxServiceListSandboxTemplates(clusterId, params);
  },

  /** Create a SandboxTemplate (cluster-scoped Pod template). */
  createSandboxTemplate: async (
    input: CreateSandboxTemplateInput,
  ): Promise<V1SandboxTemplate> => {
    const body: SandboxServiceCreateSandboxTemplateBody = {
      name: input.name,
      displayName: input.displayName,
      description: input.description,
      image: input.image,
      containerCommand: input.containerCommand,
      labels: input.labels,
      ownerType: input.ownerType,
      ownerId: input.ownerId,
    };
    return sandboxServiceCreateSandboxTemplate(input.clusterId, body);
  },

  /** Delete a SandboxTemplate by id (requires expectedRevision). */
  deleteSandboxTemplate: async ({
    id,
    expectedRevision,
  }: DeleteSandboxTemplateInput) => {
    const params: SandboxServiceDeleteSandboxTemplateParams = {
      expectedRevision: expectedRevision ?? DEFAULT_REVISION,
    };
    return sandboxServiceDeleteSandboxTemplate(id, params);
  },

  /** List Sandboxes in a namespace. */
  listSandboxes: async ({
    namespaceId,
    pageSize,
    pageToken,
  }: ListSandboxesInput): Promise<V1ListSandboxesResponse> => {
    const params: SandboxServiceListSandboxesParams = {
      pageSize: pageSize ?? DEFAULT_PAGE_SIZE,
      pageToken,
    };
    return sandboxServiceListSandboxes(namespaceId, params);
  },

  /** Get a single Sandbox by id. */
  getSandbox: async (id: string): Promise<V1Sandbox> =>
    sandboxServiceGetSandbox(id),

  /** Create a Sandbox in a namespace (from a template or warm pool). */
  createSandbox: async (input: CreateSandboxInput): Promise<V1Sandbox> => {
    const body: SandboxServiceCreateSandboxBody = {
      name: input.name,
      templateId: input.templateId,
      warmPoolId: input.warmPoolId,
      labels: input.labels,
      ownerType: input.ownerType,
      ownerId: input.ownerId,
    };
    return sandboxServiceCreateSandbox(input.namespaceId, body);
  },

  /** Delete a Sandbox by id (requires expectedRevision). */
  deleteSandbox: async ({
    id,
    expectedRevision,
    deletePolicy,
  }: DeleteSandboxInput) => {
    const params: SandboxServiceDeleteSandboxParams = {
      expectedRevision: expectedRevision ?? DEFAULT_REVISION,
      deletePolicy,
    };
    return sandboxServiceDeleteSandbox(id, params);
  },

  /** Sync sandboxes from the remote cluster into the Hub (import/update/remove). */
  syncSandboxes: async (namespaceId: string): Promise<V1SyncSandboxesResponse> =>
    sandboxServiceSyncSandboxes(namespaceId),

  /** List WarmPools in a namespace. */
  listWarmPools: async ({
    namespaceId,
    pageSize,
    pageToken,
  }: {
    namespaceId: string;
    pageSize?: number;
    pageToken?: string;
  }): Promise<V1ListWarmPoolsResponse> => {
    const params: SandboxServiceListWarmPoolsParams = {
      pageSize: pageSize ?? DEFAULT_PAGE_SIZE,
      pageToken,
    };
    return sandboxServiceListWarmPools(namespaceId, params);
  },

  /** Create a WarmPool (pre-warm N pods from a template). */
  createWarmPool: async (input: CreateWarmPoolInput): Promise<V1WarmPool> => {
    const body: SandboxServiceCreateWarmPoolBody = {
      name: input.name,
      templateId: input.templateId,
      replicas: input.replicas,
      ownerType: input.ownerType,
      ownerId: input.ownerId,
    };
    return sandboxServiceCreateWarmPool(input.namespaceId, body);
  },

  /** List SandboxClaims in a namespace. */
  listSandboxClaims: async ({
    namespaceId,
    pageSize,
    pageToken,
  }: {
    namespaceId: string;
    pageSize?: number;
    pageToken?: string;
  }): Promise<V1ListSandboxClaimsResponse> => {
    const params: SandboxServiceListSandboxClaimsParams = {
      pageSize: pageSize ?? DEFAULT_PAGE_SIZE,
      pageToken,
    };
    return sandboxServiceListSandboxClaims(namespaceId, params);
  },

  /** Create a SandboxClaim (claim a pre-warmed pod from a WarmPool). */
  createSandboxClaim: async (
    input: CreateSandboxClaimInput,
  ): Promise<V1SandboxClaim> => {
    const body: SandboxServiceCreateSandboxClaimBody = {
      name: input.name,
      warmPoolId: input.warmPoolId,
      ownerType: input.ownerType,
      ownerId: input.ownerId,
    };
    return sandboxServiceCreateSandboxClaim(input.namespaceId, body);
  },

  /** List tools exposed by a Sandbox. */
  listSandboxTools: async (id: string): Promise<V1ListSandboxToolsResponse> =>
    sandboxServiceListSandboxTools(id),

  /** Call a tool on a Sandbox. */
  callSandboxTool: async (
    input: CallSandboxToolInput,
  ): Promise<V1CallSandboxToolResponse> => {
    const body: SandboxServiceCallSandboxToolBody = {
      tool: input.tool,
      inputJson: input.inputJson,
      traceId: input.traceId,
    };
    return sandboxServiceCallSandboxTool(input.id, body);
  },
};
