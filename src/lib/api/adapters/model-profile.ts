/**
 * modelProfileApi — adapter over the orval-generated ModelProfileService client.
 *
 * Hub is the source of truth for enterprise LLM model configs (endpoint /
 * protocol / capability / credential_ref / limits). The Runtime resolves an
 * immutable revision to build an ADK model.LLM via the aisphere:// factory;
 * plain-text credentials never enter Hub. This adapter wraps the generated
 * SDK (src/lib/api/generated/model-profile-service) and projects the sparse
 * proto shape (V1ModelProfile) into the UI's ModelProfile domain type.
 *
 * Contract notes (5 corrections baked into the proto/swagger, reflected here):
 *  - list returns V1ListModelProfilesResponse { modelProfiles, nextPageToken };
 *    the adapter unwraps into a Page<ModelProfile> so hooks can use asItems.
 *  - remove returns V1DeleteModelProfileResponse (empty body); the adapter
 *    resolves to void — callers only need success/failure.
 *  - CreateModelProfile is AUTHENTICATED at the gateway; the biz layer does
 *    the explicit edit-on-project check (no authz interpolation in proto).
 *  - TestModelProfile returns UNAVAILABLE (stub); the adapter surfaces the
 *    error but the page does not expose a test button in v1.
 *  - Enum values are snake_case (openai_responses / openai_chat_completions /
 *    gemini; active / disabled) matching the backend DB.
 *
 * Mapping notes:
 *  - reasoning/metadata are arbitrary JSON carried as a string (proto field
 *    type is string). Callers JSON.stringify before save/update; the adapter
 *    passes the string through unchanged.
 *  - V1ModelProfile.labels is {[key:string]:string}; ModelProfile.labels is
 *    Record<string,string> — structurally identical, cast directly.
 */
import {
  modelProfileServiceCreateModelProfile,
  modelProfileServiceDeleteModelProfile,
  modelProfileServiceGetModelProfile,
  modelProfileServiceListModelProfiles,
  modelProfileServiceResolveModelProfile,
  modelProfileServiceTestModelProfile,
  modelProfileServiceUpdateModelProfile,
} from '../generated/model-profile-service/model-profile-service';
import type {
  ModelProfileServiceListModelProfilesParams,
  V1CreateModelProfileRequest,
  V1ModelProfile,
  V1ResolveModelProfileResponse,
  V1TestModelProfileResponse,
} from '../generated/model';
import type { ModelProfile, Page } from '../types';

// --- generated → domain ---

function toModelProfile(p: V1ModelProfile): ModelProfile {
  return {
    id: p.id ?? '',
    version: p.version,
    status: p.status,
    displayName: p.displayName,
    description: p.description,
    provider: p.provider,
    apiFormat: p.apiFormat,
    endpoint: p.endpoint,
    model: p.model,
    upstreamModel: p.upstreamModel,
    upstreamPath: p.upstreamPath,
    secretRef: p.secretRef,
    allowedTools: p.allowedTools,
    limits: p.limits && {
      maxInputTokens: p.limits.maxInputTokens,
      maxOutputTokens: p.limits.maxOutputTokens,
    },
    reasoning: p.reasoning,
    labels: p.labels as Record<string, string> | undefined,
    metadata: p.metadata,
  };
}

// --- domain → generated request ---

function toCreateRequest(p: ModelProfile): V1CreateModelProfileRequest {
  return {
    id: p.id,
    displayName: p.displayName,
    description: p.description,
    status: p.status,
    provider: p.provider ?? '',
    apiFormat: p.apiFormat ?? '',
    endpoint: p.endpoint ?? '',
    model: p.model,
    upstreamModel: p.upstreamModel ?? '',
    upstreamPath: p.upstreamPath,
    secretRef: p.secretRef,
    allowedTools: p.allowedTools,
    limits: p.limits && {
      maxInputTokens: p.limits.maxInputTokens,
      maxOutputTokens: p.limits.maxOutputTokens,
    },
    reasoning: p.reasoning,
    labels: p.labels,
    metadata: p.metadata,
    version: p.version,
    projectId: (p as ModelProfile & { projectId?: string }).projectId,
  };
}

// --- adapter ---

export const modelProfileApi = {
  list: async (
    params?: Partial<ModelProfileServiceListModelProfilesParams>,
  ): Promise<Page<ModelProfile>> => {
    const reply = await modelProfileServiceListModelProfiles(params);
    const items = (reply.modelProfiles || []).map(toModelProfile);
    return {
      items,
      modelProfiles: items,
      nextPageToken: reply.nextPageToken,
    } as Page<ModelProfile>;
  },

  get: async (id: string): Promise<ModelProfile> => {
    const p = await modelProfileServiceGetModelProfile(id);
    return toModelProfile(p);
  },

  save: async (profile: ModelProfile): Promise<ModelProfile> => {
    const created = await modelProfileServiceCreateModelProfile(toCreateRequest(profile));
    return toModelProfile(created);
  },

  update: async (id: string, profile: ModelProfile): Promise<ModelProfile> => {
    // The PUT body is the full profile (proto defaults make omitted fields
    // indistinguishable from empty); send every settable field.
    const updated = await modelProfileServiceUpdateModelProfile(id, {
      displayName: profile.displayName,
      description: profile.description,
      status: profile.status,
      provider: profile.provider ?? '',
      apiFormat: profile.apiFormat ?? '',
      endpoint: profile.endpoint ?? '',
      model: profile.model,
      upstreamModel: profile.upstreamModel ?? '',
      upstreamPath: profile.upstreamPath,
      secretRef: profile.secretRef,
      allowedTools: profile.allowedTools,
      limits: profile.limits && {
        maxInputTokens: profile.limits.maxInputTokens,
        maxOutputTokens: profile.limits.maxOutputTokens,
      },
      reasoning: profile.reasoning,
      labels: profile.labels,
      metadata: profile.metadata,
      version: profile.version,
    });
    return toModelProfile(updated);
  },

  remove: async (id: string): Promise<void> => {
    await modelProfileServiceDeleteModelProfile(id);
  },

  resolve: async (
    id: string,
    body: { version?: string; runtimeId?: string; sessionId?: string } = {},
  ): Promise<V1ResolveModelProfileResponse> => {
    return modelProfileServiceResolveModelProfile(id, {
      version: body.version,
      runtimeId: body.runtimeId,
      sessionId: body.sessionId,
    });
  },

  test: async (
    id: string,
    body: { prompt?: string } = {},
  ): Promise<V1TestModelProfileResponse> => {
    // v1 stub: the backend returns UNAVAILABLE. The adapter surfaces the
    // rejection so callers can show "未接入"; the page does not expose a test
    // button yet.
    return modelProfileServiceTestModelProfile(id, { prompt: body.prompt });
  },
};
