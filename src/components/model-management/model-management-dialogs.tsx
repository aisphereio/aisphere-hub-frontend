'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  useSaveModel,
  useSaveModelEndpoint,
  useSaveModelProfileV2,
} from '@/hooks/use-model-management';
import type {
  ModelEndpoint,
  ModelEndpointWriteRequest,
  ModelProfileV2,
  ModelProfileWriteRequest,
  ModelResource,
  ModelWriteRequest,
  ReasoningMapping,
} from '@/lib/api/model-management';

const MODEL_TYPES = ['llm', 'vision', 'embedding', 'rerank', 'asr', 'tts'];
const REASONING_MODES = ['auto', 'enabled', 'disabled'];
const REASONING_EFFORTS = ['none', 'minimal', 'low', 'medium', 'high', 'max'];

function parseJSONObject(value: string, label: string): Record<string, unknown> {
  const text = value.trim();
  if (!text) return {};
  const parsed: unknown = JSON.parse(text);
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error(`${label} 必须是 JSON 对象`);
  }
  return parsed as Record<string, unknown>;
}

function prettyJSON(value: unknown): string {
  if (!value || (typeof value === 'object' && Object.keys(value).length === 0)) {
    return '{}';
  }
  return JSON.stringify(value, null, 2);
}

function modelDefaults(): ModelWriteRequest {
  return {
    code: '',
    displayName: '',
    description: '',
    status: 'active',
    vendor: '',
    family: '',
    modelType: 'llm',
    capabilities: {
      chat: true,
      toolCalling: true,
      streaming: true,
      structuredOutput: true,
      visionInput: false,
      audioInput: false,
      audioOutput: false,
      embedding: false,
      rerank: false,
    },
    reasoning: {
      supported: true,
      modes: ['auto', 'enabled', 'disabled'],
      effortLevels: ['none', 'minimal', 'low', 'medium', 'high', 'max'],
      defaultMode: 'auto',
      defaultEffort: 'medium',
      supportsBudgetTokens: false,
      preserveReasoningContent: true,
    },
    providerConfig: {},
  };
}

export function ModelFormDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: ModelResource | null;
}) {
  const initial = editing
    ? {
        ...modelDefaults(),
        code: editing.code,
        displayName: editing.displayName,
        description: editing.description ?? '',
        status: editing.status === 'disabled' ? 'disabled' : 'active',
        vendor: editing.vendor,
        family: editing.family ?? '',
        modelType: editing.modelType,
        capabilities: editing.capabilities,
        reasoning: editing.reasoning,
        providerConfig: editing.providerConfig ?? {},
      }
    : modelDefaults();
  const [form, setForm] = useState<ModelWriteRequest>(initial);
  const [providerJSON, setProviderJSON] = useState(prettyJSON(initial.providerConfig));
  const [efforts, setEfforts] = useState(initial.reasoning.effortLevels.join(', '));
  const mutation = useSaveModel();

  const setCapability = (key: keyof ModelWriteRequest['capabilities'], value: boolean) =>
    setForm((current) => ({
      ...current,
      capabilities: { ...current.capabilities, [key]: value },
    }));

  const submit = async () => {
    try {
      const body: ModelWriteRequest = {
        ...form,
        code: form.code.trim(),
        displayName: form.displayName.trim(),
        vendor: form.vendor.trim(),
        family: form.family?.trim(),
        reasoning: {
          ...form.reasoning,
          modes: form.reasoning.supported
            ? ['auto', 'enabled', 'disabled']
            : ['disabled'],
          effortLevels: efforts
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
        },
        providerConfig: parseJSONObject(providerJSON, '模型个性化配置'),
      };
      await mutation.mutateAsync({ id: editing?.id, body });
      toast.success(editing ? '模型已更新' : '模型已创建');
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存模型失败');
    }
  };

  const canSubmit =
    Boolean(form.code.trim() && form.displayName.trim() && form.vendor.trim()) &&
    !mutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(next) => !mutation.isPending && onOpenChange(next)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{editing ? '编辑模型' : '新增模型'}</DialogTitle>
          <DialogDescription>
            模型保存公共身份、能力与统一推理语义；服务地址和请求字段映射在“服务接入”中配置。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <section className="grid gap-3 sm:grid-cols-2">
            <Field label="模型编码" required hint="组织内唯一，例如 glm-5-2、qwen-3-6">
              <Input
                value={form.code}
                disabled={Boolean(editing) || mutation.isPending}
                onChange={(event) => setForm({ ...form, code: event.target.value })}
              />
            </Field>
            <Field label="显示名称" required>
              <Input
                value={form.displayName}
                onChange={(event) => setForm({ ...form, displayName: event.target.value })}
              />
            </Field>
            <Field label="厂商" required>
              <Input
                value={form.vendor}
                placeholder="alibaba / deepseek / zhipu"
                onChange={(event) => setForm({ ...form, vendor: event.target.value })}
              />
            </Field>
            <Field label="模型家族">
              <Input
                value={form.family ?? ''}
                placeholder="qwen / deepseek / glm"
                onChange={(event) => setForm({ ...form, family: event.target.value })}
              />
            </Field>
            <Field label="模型类型">
              <Select
                value={form.modelType}
                onValueChange={(value) => setForm({ ...form, modelType: value })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MODEL_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="状态">
              <Select
                value={form.status}
                onValueChange={(value) => setForm({ ...form, status: value as 'active' | 'disabled' })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">启用</SelectItem>
                  <SelectItem value="disabled">停用</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </section>

          <Field label="描述">
            <Textarea
              rows={2}
              value={form.description ?? ''}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </Field>

          <section className="space-y-3 rounded-lg border p-4">
            <div>
              <h4 className="font-medium">公共能力</h4>
              <p className="text-xs text-muted-foreground">描述模型本身能做什么，不代表当前 Profile 一定允许使用。</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Toggle label="对话" checked={form.capabilities.chat} onCheckedChange={(v) => setCapability('chat', v)} />
              <Toggle label="Tool Calling" checked={form.capabilities.toolCalling} onCheckedChange={(v) => setCapability('toolCalling', v)} />
              <Toggle label="流式输出" checked={form.capabilities.streaming} onCheckedChange={(v) => setCapability('streaming', v)} />
              <Toggle label="结构化输出" checked={form.capabilities.structuredOutput} onCheckedChange={(v) => setCapability('structuredOutput', v)} />
              <Toggle label="视觉输入" checked={form.capabilities.visionInput} onCheckedChange={(v) => setCapability('visionInput', v)} />
              <Toggle label="音频输入" checked={form.capabilities.audioInput} onCheckedChange={(v) => setCapability('audioInput', v)} />
              <Toggle label="Embedding" checked={form.capabilities.embedding} onCheckedChange={(v) => setCapability('embedding', v)} />
              <Toggle label="Rerank" checked={form.capabilities.rerank} onCheckedChange={(v) => setCapability('rerank', v)} />
            </div>
          </section>

          <section className="space-y-4 rounded-lg border p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h4 className="font-medium">公共推理能力</h4>
                <p className="text-xs text-muted-foreground">统一表达是否支持推理、模式和强度；具体请求字段由 Endpoint 映射。</p>
              </div>
              <Switch
                checked={form.reasoning.supported}
                onCheckedChange={(supported) =>
                  setForm({ ...form, reasoning: { ...form.reasoning, supported } })
                }
              />
            </div>
            {form.reasoning.supported ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="默认推理模式">
                  <Select
                    value={form.reasoning.defaultMode}
                    onValueChange={(defaultMode) => setForm({ ...form, reasoning: { ...form.reasoning, defaultMode } })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{REASONING_MODES.map((mode) => <SelectItem key={mode} value={mode}>{mode}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="默认推理强度">
                  <Select
                    value={form.reasoning.defaultEffort}
                    onValueChange={(defaultEffort) => setForm({ ...form, reasoning: { ...form.reasoning, defaultEffort } })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{REASONING_EFFORTS.map((effort) => <SelectItem key={effort} value={effort}>{effort}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="支持的强度" hint="逗号分隔；用于 Profile 表单校验">
                  <Input value={efforts} onChange={(event) => setEfforts(event.target.value)} />
                </Field>
                <div className="space-y-2 pt-7">
                  <Toggle
                    label="支持 Token Budget"
                    checked={form.reasoning.supportsBudgetTokens}
                    onCheckedChange={(supportsBudgetTokens) => setForm({ ...form, reasoning: { ...form.reasoning, supportsBudgetTokens } })}
                  />
                  <Toggle
                    label="工具调用时保留推理内容"
                    checked={form.reasoning.preserveReasoningContent}
                    onCheckedChange={(preserveReasoningContent) => setForm({ ...form, reasoning: { ...form.reasoning, preserveReasoningContent } })}
                  />
                </div>
              </div>
            ) : null}
          </section>

          <Field label="模型个性化配置" hint="可保存厂商特有但不参与统一语义的 JSON，例如架构、许可、训练信息。">
            <Textarea className="min-h-28 font-mono text-xs" value={providerJSON} onChange={(event) => setProviderJSON(event.target.value)} />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button disabled={!canSubmit} onClick={() => void submit()}>
            {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const ENDPOINT_PRESETS = {
  qwen_vllm: {
    label: 'Qwen · vLLM/SGLang',
    mapping: {
      strategy: 'field_map',
      modeField: 'chat_template_kwargs.enable_thinking',
      enabledValue: true,
      disabledValue: false,
    } satisfies ReasoningMapping,
  },
  deepseek: {
    label: 'DeepSeek API',
    mapping: {
      strategy: 'field_map',
      modeField: 'thinking.type',
      enabledValue: 'enabled',
      disabledValue: 'disabled',
      effortField: 'reasoning_effort',
      effortMap: { low: 'high', medium: 'high', high: 'high', max: 'max' },
      responseField: 'reasoning_content',
      preserveOnTool: true,
    } satisfies ReasoningMapping,
  },
  glm: {
    label: 'GLM / 智谱兼容',
    mapping: {
      strategy: 'field_map',
      modeField: 'thinking.type',
      enabledValue: 'enabled',
      disabledValue: 'disabled',
      effortField: 'reasoning_effort',
      effortMap: { low: 'high', medium: 'high', high: 'high', max: 'max' },
      responseField: 'reasoning_content',
      preserveOnTool: true,
    } satisfies ReasoningMapping,
  },
  custom: {
    label: '自定义映射',
    mapping: { strategy: 'field_map' } satisfies ReasoningMapping,
  },
  none: {
    label: '不发送推理参数',
    mapping: { strategy: 'none' } satisfies ReasoningMapping,
  },
};

type EndpointPreset = keyof typeof ENDPOINT_PRESETS;

function endpointDefaults(models: ModelResource[]): ModelEndpointWriteRequest {
  return {
    modelId: models[0]?.id ?? '',
    displayName: '',
    description: '',
    status: 'active',
    adapter: 'openai_compatible',
    apiFormat: 'chat_completions',
    baseUrl: '',
    providerModelId: '',
    apiPath: '/v1/chat/completions',
    credentialRef: '',
    limits: { contextWindow: 0, maxOutputTokens: 0 },
    reasoningMapping: ENDPOINT_PRESETS.none.mapping,
    requestDefaults: {},
    providerConfig: {},
  };
}

export function EndpointFormDialog({
  open,
  onOpenChange,
  models,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  models: ModelResource[];
  editing?: ModelEndpoint | null;
}) {
  const initial = editing
    ? {
        ...endpointDefaults(models),
        ...editing,
        status: editing.status === 'disabled' ? 'disabled' : 'active',
      }
    : endpointDefaults(models);
  const [form, setForm] = useState<ModelEndpointWriteRequest>(initial);
  const [preset, setPreset] = useState<EndpointPreset>('none');
  const [mappingJSON, setMappingJSON] = useState(prettyJSON(initial.reasoningMapping));
  const [defaultsJSON, setDefaultsJSON] = useState(prettyJSON(initial.requestDefaults));
  const mutation = useSaveModelEndpoint();

  const applyPreset = (value: EndpointPreset) => {
    setPreset(value);
    const mapping = ENDPOINT_PRESETS[value].mapping;
    setForm((current) => ({ ...current, reasoningMapping: mapping }));
    setMappingJSON(prettyJSON(mapping));
  };

  const submit = async () => {
    try {
      const body: ModelEndpointWriteRequest = {
        ...form,
        baseUrl: form.baseUrl.trim(),
        providerModelId: form.providerModelId.trim(),
        reasoningMapping: parseJSONObject(mappingJSON, '推理字段映射') as unknown as ReasoningMapping,
        requestDefaults: parseJSONObject(defaultsJSON, '请求默认参数'),
      };
      await mutation.mutateAsync({ id: editing?.id, body });
      toast.success(editing ? '服务接入已更新' : '服务接入已创建');
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存服务接入失败');
    }
  };

  const canSubmit = Boolean(form.modelId && form.displayName.trim() && form.baseUrl.trim() && form.providerModelId.trim()) && !mutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(next) => !mutation.isPending && onOpenChange(next)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{editing ? '编辑服务接入' : '新增服务接入'}</DialogTitle>
          <DialogDescription>
            Endpoint 描述模型部署在哪里、服务端模型 ID 是什么，以及如何把统一推理策略翻译成厂商请求字段。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <section className="grid gap-3 sm:grid-cols-2">
            <Field label="模型" required>
              <Select value={form.modelId} onValueChange={(modelId) => setForm({ ...form, modelId })}>
                <SelectTrigger><SelectValue placeholder="选择模型" /></SelectTrigger>
                <SelectContent>{models.map((model) => <SelectItem key={model.id} value={model.id}>{model.displayName} · {model.vendor}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="服务名称" required>
              <Input value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} placeholder="910B GLM-5.2 生产服务" />
            </Field>
            <Field label="Adapter">
              <Select value={form.adapter} onValueChange={(adapter) => setForm({ ...form, adapter })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai_compatible">OpenAI Compatible</SelectItem>
                  <SelectItem value="gemini">Gemini</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="API 格式">
              <Select value={form.apiFormat} onValueChange={(apiFormat) => setForm({ ...form, apiFormat })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="chat_completions">Chat Completions</SelectItem>
                  <SelectItem value="responses">Responses</SelectItem>
                  <SelectItem value="gemini">Gemini</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </section>
          <Field label="服务地址" required>
            <Input className="font-mono" value={form.baseUrl} onChange={(event) => setForm({ ...form, baseUrl: event.target.value })} placeholder="https://model-gateway.internal" />
          </Field>
          <section className="grid gap-3 sm:grid-cols-2">
            <Field label="服务端模型 ID" required hint="真正写入请求 model 字段；不是 AISphere 内部 UUID。">
              <Input className="font-mono" value={form.providerModelId} onChange={(event) => setForm({ ...form, providerModelId: event.target.value })} placeholder="glm-5.2-w4a8" />
            </Field>
            <Field label="API 路径">
              <Input className="font-mono" value={form.apiPath ?? ''} onChange={(event) => setForm({ ...form, apiPath: event.target.value })} />
            </Field>
            <Field label="凭据引用">
              <Input className="font-mono" value={form.credentialRef ?? ''} onChange={(event) => setForm({ ...form, credentialRef: event.target.value })} placeholder="secret://models/glm-prod" />
            </Field>
            <Field label="状态">
              <Select value={form.status} onValueChange={(status) => setForm({ ...form, status: status as 'active' | 'disabled' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="active">启用</SelectItem><SelectItem value="disabled">停用</SelectItem></SelectContent>
              </Select>
            </Field>
            <Field label="上下文窗口">
              <Input type="number" min={0} value={form.limits.contextWindow} onChange={(event) => setForm({ ...form, limits: { ...form.limits, contextWindow: Number(event.target.value) || 0 } })} />
            </Field>
            <Field label="最大输出 Token">
              <Input type="number" min={0} value={form.limits.maxOutputTokens} onChange={(event) => setForm({ ...form, limits: { ...form.limits, maxOutputTokens: Number(event.target.value) || 0 } })} />
            </Field>
          </section>

          <section className="space-y-3 rounded-lg border p-4">
            <div>
              <h4 className="font-medium">推理字段映射</h4>
              <p className="text-xs text-muted-foreground">Profile 只选择统一模式和强度；Endpoint 把它转换为 Qwen、DeepSeek、GLM 等服务的实际字段。</p>
            </div>
            <Field label="映射预设">
              <Select value={preset} onValueChange={(value) => applyPreset(value as EndpointPreset)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(ENDPOINT_PRESETS).map(([key, item]) => <SelectItem key={key} value={key}>{item.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Textarea className="min-h-44 font-mono text-xs" value={mappingJSON} onChange={(event) => setMappingJSON(event.target.value)} />
          </section>

          <Field label="请求默认参数" hint="Endpoint 级别参数，例如超时、采样默认值；Profile 参数在运行时覆盖它。">
            <Textarea className="min-h-28 font-mono text-xs" value={defaultsJSON} onChange={(event) => setDefaultsJSON(event.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button disabled={!canSubmit} onClick={() => void submit()}>{mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function profileDefaults(endpoints: ModelEndpoint[]): ModelProfileWriteRequest {
  return {
    code: '',
    displayName: '',
    description: '',
    status: 'active',
    endpointId: endpoints[0]?.id ?? '',
    limits: { contextWindow: 0, maxOutputTokens: 0 },
    reasoningPolicy: { mode: 'inherit', effort: 'inherit', budgetTokens: 0, exposeReasoning: false, providerOverrides: {} },
    defaultParameters: {},
    allowedTools: [],
  };
}

export function ProfileFormDialog({
  open,
  onOpenChange,
  endpoints,
  models,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  endpoints: ModelEndpoint[];
  models: ModelResource[];
  editing?: ModelProfileV2 | null;
}) {
  const initial = editing
    ? { ...profileDefaults(endpoints), ...editing, status: editing.status === 'disabled' ? 'disabled' : 'active' }
    : profileDefaults(endpoints);
  const [form, setForm] = useState<ModelProfileWriteRequest>(initial);
  const [defaultsJSON, setDefaultsJSON] = useState(prettyJSON(initial.defaultParameters));
  const [overridesJSON, setOverridesJSON] = useState(prettyJSON(initial.reasoningPolicy.providerOverrides));
  const [tools, setTools] = useState((initial.allowedTools ?? []).join(', '));
  const mutation = useSaveModelProfileV2();

  const selectedEndpoint = endpoints.find((item) => item.id === form.endpointId);
  const selectedModel = models.find((item) => item.id === selectedEndpoint?.modelId);
  const effortOptions = selectedModel?.reasoning.effortLevels?.length
    ? ['inherit', ...selectedModel.reasoning.effortLevels]
    : ['inherit', ...REASONING_EFFORTS];

  const submit = async () => {
    try {
      const body: ModelProfileWriteRequest = {
        ...form,
        code: form.code.trim(),
        displayName: form.displayName.trim(),
        defaultParameters: parseJSONObject(defaultsJSON, '默认参数'),
        reasoningPolicy: {
          ...form.reasoningPolicy,
          providerOverrides: parseJSONObject(overridesJSON, '厂商参数覆盖'),
        },
        allowedTools: tools.split(',').map((item) => item.trim()).filter(Boolean),
        commitMsg: editing ? 'update model profile' : 'create model profile',
      };
      await mutation.mutateAsync({ id: editing?.id, body });
      toast.success(editing ? '使用配置已更新' : '使用配置已创建');
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存使用配置失败');
    }
  };

  const canSubmit = Boolean(form.code.trim() && form.displayName.trim() && form.endpointId) && !mutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(next) => !mutation.isPending && onOpenChange(next)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{editing ? '编辑使用配置' : '新增使用配置'}</DialogTitle>
          <DialogDescription>
            Profile 是 Agent 使用策略：选择 Endpoint，配置统一推理模式、强度、上下文限制和默认参数；版本由系统自动生成。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <section className="grid gap-3 sm:grid-cols-2">
            <Field label="配置编码" required hint="Agent 使用 aisphere://model-profiles/{code}">
              <Input value={form.code} disabled={Boolean(editing)} onChange={(event) => setForm({ ...form, code: event.target.value })} placeholder="coding-default" />
            </Field>
            <Field label="显示名称" required>
              <Input value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} />
            </Field>
            <Field label="服务接入" required>
              <Select value={form.endpointId} onValueChange={(endpointId) => setForm({ ...form, endpointId })}>
                <SelectTrigger><SelectValue placeholder="选择 Endpoint" /></SelectTrigger>
                <SelectContent>{endpoints.map((endpoint) => <SelectItem key={endpoint.id} value={endpoint.id}>{endpoint.displayName} · {endpoint.providerModelId}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="状态">
              <Select value={form.status} onValueChange={(status) => setForm({ ...form, status: status as 'active' | 'disabled' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="active">启用</SelectItem><SelectItem value="disabled">停用</SelectItem></SelectContent>
              </Select>
            </Field>
          </section>

          <section className="space-y-3 rounded-lg border p-4">
            <div>
              <h4 className="font-medium">统一推理策略</h4>
              <p className="text-xs text-muted-foreground">
                {selectedModel ? `当前模型：${selectedModel.displayName}；默认 ${selectedModel.reasoning.defaultMode}/${selectedModel.reasoning.defaultEffort}` : '选择 Endpoint 后继承模型能力。'}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="推理模式">
                <Select value={form.reasoningPolicy.mode} onValueChange={(mode) => setForm({ ...form, reasoningPolicy: { ...form.reasoningPolicy, mode: mode as ModelProfileWriteRequest['reasoningPolicy']['mode'] } })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['inherit', 'auto', 'enabled', 'disabled'].map((mode) => <SelectItem key={mode} value={mode}>{mode}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="推理强度">
                <Select value={form.reasoningPolicy.effort} onValueChange={(effort) => setForm({ ...form, reasoningPolicy: { ...form.reasoningPolicy, effort: effort as ModelProfileWriteRequest['reasoningPolicy']['effort'] } })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{effortOptions.map((effort) => <SelectItem key={effort} value={effort}>{effort}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="推理 Token Budget" hint={selectedModel?.reasoning.supportsBudgetTokens ? '当前模型声明支持' : '当前模型未声明支持，非零值会被后端拒绝'}>
                <Input type="number" min={0} value={form.reasoningPolicy.budgetTokens ?? 0} onChange={(event) => setForm({ ...form, reasoningPolicy: { ...form.reasoningPolicy, budgetTokens: Number(event.target.value) || 0 } })} />
              </Field>
              <div className="pt-7"><Toggle label="向调用方暴露 reasoning content" checked={Boolean(form.reasoningPolicy.exposeReasoning)} onCheckedChange={(exposeReasoning) => setForm({ ...form, reasoningPolicy: { ...form.reasoningPolicy, exposeReasoning } })} /></div>
            </div>
            <Field label="厂商参数覆盖" hint="仅用于预设无法覆盖的特殊参数；公共配置仍应使用上面的模式与强度。">
              <Textarea className="min-h-24 font-mono text-xs" value={overridesJSON} onChange={(event) => setOverridesJSON(event.target.value)} />
            </Field>
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <Field label="Profile 上下文上限">
              <Input type="number" min={0} value={form.limits.contextWindow} onChange={(event) => setForm({ ...form, limits: { ...form.limits, contextWindow: Number(event.target.value) || 0 } })} />
            </Field>
            <Field label="Profile 最大输出 Token">
              <Input type="number" min={0} value={form.limits.maxOutputTokens} onChange={(event) => setForm({ ...form, limits: { ...form.limits, maxOutputTokens: Number(event.target.value) || 0 } })} />
            </Field>
          </section>
          <Field label="默认采样参数">
            <Textarea className="min-h-28 font-mono text-xs" value={defaultsJSON} onChange={(event) => setDefaultsJSON(event.target.value)} placeholder={'{\n  "temperature": 0.2,\n  "top_p": 0.9\n}'} />
          </Field>
          <Field label="允许工具" hint="逗号分隔；这是 Profile 的暴露策略，不替代 Tool 和资源 IAM。">
            <Input value={tools} onChange={(event) => setTools(event.target.value)} placeholder="workspace.read, workspace.write" />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button disabled={!canSubmit} onClick={() => void submit()}>{mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}{required ? ' *' : ''}</Label>
      {children}
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
