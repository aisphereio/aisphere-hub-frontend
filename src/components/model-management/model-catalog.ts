import type {
  ModelCapabilities,
  ReasoningCapability,
  ReasoningMapping,
} from '@/lib/api/model-management';

export type ModelPresetKey =
  | 'deepseek_v4'
  | 'glm'
  | 'qwen'
  | 'openai'
  | 'custom';

export interface ModelCatalogPreset {
  key: ModelPresetKey;
  label: string;
  vendor: string;
  family: string;
  modelType: string;
  capabilities: ModelCapabilities;
  reasoning: ReasoningCapability;
  endpoint: {
    adapter: string;
    apiFormat: string;
    apiPath: string;
    reasoningMapping: ReasoningMapping;
  };
}

const chatCapabilities: ModelCapabilities = {
  chat: true,
  toolCalling: true,
  streaming: true,
  structuredOutput: true,
  visionInput: false,
  audioInput: false,
  audioOutput: false,
  embedding: false,
  rerank: false,
};

const noReasoning: ReasoningCapability = {
  supported: false,
  modes: ['disabled'],
  effortLevels: ['none'],
  defaultMode: 'disabled',
  defaultEffort: 'none',
  supportsBudgetTokens: false,
  preserveReasoningContent: false,
};

const toggleReasoning: ReasoningCapability = {
  supported: true,
  modes: ['enabled', 'disabled'],
  effortLevels: ['none'],
  defaultMode: 'enabled',
  defaultEffort: 'none',
  supportsBudgetTokens: false,
  preserveReasoningContent: true,
};

const effortReasoning: ReasoningCapability = {
  supported: true,
  modes: ['auto', 'enabled', 'disabled'],
  effortLevels: ['low', 'medium', 'high'],
  defaultMode: 'auto',
  defaultEffort: 'medium',
  supportsBudgetTokens: false,
  preserveReasoningContent: true,
};

const openAIReasoning: ReasoningCapability = {
  ...effortReasoning,
  effortLevels: ['minimal', 'low', 'medium', 'high', 'max'],
  defaultEffort: 'medium',
};

const qwenMapping: ReasoningMapping = {
  strategy: 'field_map',
  modeField: 'chat_template_kwargs.enable_thinking',
  enabledValue: true,
  disabledValue: false,
};

const deepseekMapping: ReasoningMapping = {
  strategy: 'field_map',
  modeField: 'thinking.type',
  enabledValue: 'enabled',
  disabledValue: 'disabled',
  effortField: 'reasoning_effort',
  effortMap: { low: 'low', medium: 'medium', high: 'high' },
  responseField: 'reasoning_content',
  preserveOnTool: true,
};

const glmMapping: ReasoningMapping = {
  strategy: 'field_map',
  modeField: 'thinking.type',
  enabledValue: 'enabled',
  disabledValue: 'disabled',
  responseField: 'reasoning_content',
  preserveOnTool: true,
};

const responsesMapping: ReasoningMapping = {
  strategy: 'field_map',
  modeField: 'reasoning.enabled',
  enabledValue: true,
  disabledValue: false,
  effortField: 'reasoning.effort',
  effortMap: { minimal: 'minimal', low: 'low', medium: 'medium', high: 'high', max: 'xhigh' },
  responseField: 'output.reasoning',
  preserveOnTool: true,
};

const anthropicMapping: ReasoningMapping = {
  strategy: 'field_map',
  modeField: 'thinking.type',
  enabledValue: 'enabled',
  disabledValue: 'disabled',
  effortField: 'thinking.budget_tokens',
  responseField: 'content.thinking',
  preserveOnTool: true,
};

const endpoint = (
  adapter: string,
  apiFormat: string,
  apiPath: string,
  reasoningMapping: ReasoningMapping,
) => ({ adapter, apiFormat, apiPath, reasoningMapping });

export const MODEL_CATALOG_PRESETS: Record<ModelPresetKey, ModelCatalogPreset> = {
  deepseek_v4: {
    key: 'deepseek_v4',
    label: 'DeepSeek V4',
    vendor: 'deepseek',
    family: 'deepseek-v4',
    modelType: 'llm',
    capabilities: chatCapabilities,
    reasoning: effortReasoning,
    endpoint: endpoint('openai_compatible', 'chat_completions', '/v1/chat/completions', deepseekMapping),
  },
  glm: {
    key: 'glm',
    label: 'GLM',
    vendor: 'zhipu',
    family: 'glm',
    modelType: 'llm',
    capabilities: chatCapabilities,
    reasoning: toggleReasoning,
    endpoint: endpoint('openai_compatible', 'chat_completions', '/v1/chat/completions', glmMapping),
  },
  qwen: {
    key: 'qwen',
    label: 'Qwen',
    vendor: 'alibaba',
    family: 'qwen',
    modelType: 'llm',
    capabilities: chatCapabilities,
    reasoning: toggleReasoning,
    endpoint: endpoint('openai_compatible', 'chat_completions', '/v1/chat/completions', qwenMapping),
  },
  openai: {
    key: 'openai',
    label: 'OpenAI Responses',
    vendor: 'openai',
    family: 'openai',
    modelType: 'llm',
    capabilities: chatCapabilities,
    reasoning: openAIReasoning,
    endpoint: endpoint('openai_compatible', 'responses', '/v1/responses', responsesMapping),
  },
  custom: {
    key: 'custom',
    label: 'Custom',
    vendor: 'custom',
    family: 'custom',
    modelType: 'llm',
    capabilities: chatCapabilities,
    reasoning: noReasoning,
    endpoint: endpoint('custom', 'custom', '', { strategy: 'field_map' }),
  },
};

export const MODEL_PRESET_OPTIONS = Object.values(MODEL_CATALOG_PRESETS);

export const API_FORMAT_OPTIONS = [
  {
    value: 'chat_completions',
    label: 'Chat Completions',
    adapter: 'openai_compatible',
    apiPath: '/v1/chat/completions',
  },
  {
    value: 'responses',
    label: 'Responses',
    adapter: 'openai_compatible',
    apiPath: '/v1/responses',
  },
  {
    value: 'claude_code',
    label: 'Claude Code',
    adapter: 'anthropic',
    apiPath: '/v1/messages',
  },
  {
    value: 'gemini',
    label: 'Gemini',
    adapter: 'gemini',
    apiPath: '/v1beta/models',
  },
  {
    value: 'custom',
    label: 'Custom',
    adapter: 'custom',
    apiPath: '',
  },
] as const;

export function findModelPreset(vendor?: string, family?: string): ModelPresetKey {
  const value = `${vendor ?? ''} ${family ?? ''}`.toLowerCase();
  if (value.includes('deepseek') && value.includes('v4')) return 'deepseek_v4';
  if (value.includes('glm') || value.includes('zhipu')) return 'glm';
  if (value.includes('qwen') || value.includes('alibaba')) return 'qwen';
  if (value.includes('openai')) return 'openai';
  return 'custom';
}
