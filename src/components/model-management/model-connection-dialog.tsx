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
  type ModelConnection,
  useSaveModelConnection,
} from '@/hooks/use-model-management';
import type {
  ModelApiFormat,
  ModelEndpointWriteRequest,
  ModelProfileWriteRequest,
  ModelWriteRequest,
  ResourceStatus,
} from '@/lib/api/model-management';
import {
  API_FORMAT_OPTIONS,
  findModelPreset,
  MODEL_CATALOG_PRESETS,
  MODEL_PRESET_OPTIONS,
  type ModelPresetKey,
} from './model-catalog';

interface FormState {
  presetKey: ModelPresetKey;
  name: string;
  code: string;
  description: string;
  status: ResourceStatus;
  apiFormat: ModelApiFormat;
  baseUrl: string;
  apiKey: string;
  providerModelId: string;
  apiPath: string;
  contextWindow: string;
  maxOutputTokens: string;
  streaming: boolean;
  reasoning: boolean;
  toolCalling: boolean;
  structuredOutput: boolean;
  defaultParameters: string;
}

function initialForm(editing?: ModelConnection | null): FormState {
  const presetKey = findModelPreset(editing?.model.vendor, editing?.model.family);
  const preset = MODEL_CATALOG_PRESETS[presetKey];
  const endpoint = editing?.endpoint;
  const profile = editing?.profile;
  return {
    presetKey,
    name: profile?.displayName ?? endpoint?.displayName ?? editing?.model.displayName ?? '',
    code: profile?.code ?? editing?.model.code ?? '',
    description: profile?.description ?? editing?.model.description ?? '',
    status:
      profile?.status === 'disabled' || endpoint?.status === 'disabled' || editing?.model.status === 'disabled'
        ? 'disabled'
        : 'active',
    apiFormat: endpoint?.apiFormat ?? (preset.endpoint.apiFormat as ModelApiFormat),
    baseUrl: endpoint?.baseUrl ?? '',
    apiKey: endpoint?.credentialRef ?? '',
    providerModelId: endpoint?.providerModelId ?? '',
    apiPath: endpoint?.apiPath ?? preset.endpoint.apiPath,
    contextWindow: String(profile?.limits.contextWindow ?? endpoint?.limits.contextWindow ?? 131072),
    maxOutputTokens: String(profile?.limits.maxOutputTokens ?? endpoint?.limits.maxOutputTokens ?? 8192),
    streaming: editing?.model.capabilities.streaming ?? preset.capabilities.streaming,
    reasoning: editing?.model.reasoning.supported ?? preset.reasoning.supported,
    toolCalling: editing?.model.capabilities.toolCalling ?? preset.capabilities.toolCalling,
    structuredOutput: editing?.model.capabilities.structuredOutput ?? preset.capabilities.structuredOutput,
    defaultParameters: JSON.stringify(profile?.defaultParameters ?? endpoint?.requestDefaults ?? {}, null, 2),
  };
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 128);
}

function parseObject(value: string): Record<string, unknown> {
  const text = value.trim();
  if (!text) return {};
  const parsed: unknown = JSON.parse(text);
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('默认请求参数必须是 JSON 对象');
  }
  return parsed as Record<string, unknown>;
}

export function ModelConnectionDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: ModelConnection | null;
}) {
  const key = editing?.key ?? (open ? 'new-open' : 'closed');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ModelConnectionDialogBody
        key={key}
        editing={editing}
        onOpenChange={onOpenChange}
      />
    </Dialog>
  );
}

function ModelConnectionDialogBody({
  editing,
  onOpenChange,
}: {
  editing?: ModelConnection | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [form, setForm] = useState<FormState>(() => initialForm(editing));
  const mutation = useSaveModelConnection();

  const applyPreset = (presetKey: ModelPresetKey) => {
    const preset = MODEL_CATALOG_PRESETS[presetKey];
    setForm((current) => ({
      ...current,
      presetKey,
      name: current.name.trim() ? current.name : preset.label,
      apiFormat: preset.endpoint.apiFormat as ModelApiFormat,
      apiPath: preset.endpoint.apiPath,
      streaming: preset.capabilities.streaming,
      reasoning: preset.reasoning.supported,
      toolCalling: preset.capabilities.toolCalling,
      structuredOutput: preset.capabilities.structuredOutput,
    }));
  };

  const applyProtocol = (apiFormat: ModelApiFormat) => {
    const option = API_FORMAT_OPTIONS.find((item) => item.value === apiFormat);
    setForm((current) => ({
      ...current,
      apiFormat,
      apiPath: option?.apiPath ?? current.apiPath,
    }));
  };

  const submit = async () => {
    try {
      const preset = MODEL_CATALOG_PRESETS[form.presetKey];
      const protocol = API_FORMAT_OPTIONS.find((item) => item.value === form.apiFormat);
      const code =
        form.code.trim() ||
        slugify(form.providerModelId) ||
        slugify(form.name) ||
        `model-${Date.now()}`;
      const contextWindow = Number(form.contextWindow);
      const maxOutputTokens = Number(form.maxOutputTokens);
      if (!Number.isInteger(contextWindow) || contextWindow <= 0) {
        throw new Error('上下文长度必须是正整数');
      }
      if (!Number.isInteger(maxOutputTokens) || maxOutputTokens <= 0) {
        throw new Error('最大输出长度必须是正整数');
      }
      const defaults = parseObject(form.defaultParameters);

      const model: ModelWriteRequest = {
        code,
        displayName: form.name.trim(),
        description: form.description.trim(),
        status: form.status,
        vendor: preset.vendor,
        family: preset.family,
        modelType: preset.modelType,
        capabilities: {
          ...preset.capabilities,
          streaming: form.streaming,
          toolCalling: form.toolCalling,
          structuredOutput: form.structuredOutput,
        },
        reasoning: form.reasoning
          ? preset.reasoning
          : {
              supported: false,
              modes: ['disabled'],
              effortLevels: ['none'],
              defaultMode: 'disabled',
              defaultEffort: 'none',
              supportsBudgetTokens: false,
              preserveReasoningContent: false,
            },
        providerConfig: {},
      };

      const endpoint: Omit<ModelEndpointWriteRequest, 'modelId'> = {
        displayName: form.name.trim(),
        description: form.description.trim(),
        status: form.status,
        adapter: protocol?.adapter ?? preset.endpoint.adapter,
        apiFormat: form.apiFormat,
        baseUrl: form.baseUrl.trim().replace(/\/$/, ''),
        providerModelId: form.providerModelId.trim(),
        apiPath: form.apiPath.trim(),
        credentialRef: form.apiKey.trim(),
        limits: { contextWindow, maxOutputTokens },
        reasoningMapping: form.reasoning ? preset.endpoint.reasoningMapping : { strategy: 'none' },
        requestDefaults: defaults,
        providerConfig: {},
      };

      const profile: Omit<ModelProfileWriteRequest, 'endpointId'> = {
        code,
        displayName: form.name.trim(),
        description: form.description.trim(),
        status: form.status,
        limits: { contextWindow, maxOutputTokens },
        reasoningPolicy: {
          mode: form.reasoning ? 'inherit' : 'disabled',
          effort: form.reasoning ? 'inherit' : 'none',
          exposeReasoning: false,
          providerOverrides: {},
        },
        defaultParameters: defaults,
        allowedTools: [],
        commitMsg: editing ? 'Update model connection' : 'Create model connection',
      };

      await mutation.mutateAsync({ current: editing, model, endpoint, profile });
      toast.success(editing ? '模型接入已更新' : '模型接入已创建');
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存模型接入失败');
    }
  };

  const canSubmit =
    Boolean(form.name.trim() && form.baseUrl.trim() && form.providerModelId.trim()) &&
    !mutation.isPending;

  return (
    <DialogContent
      className="max-h-[92vh] overflow-y-auto sm:max-w-3xl"
      onInteractOutside={(event) => mutation.isPending && event.preventDefault()}
    >
      <DialogHeader>
        <DialogTitle>{editing ? '编辑模型接入' : '添加模型接入'}</DialogTitle>
        <DialogDescription>
          一次配置模型名称、协议、API 地址、API Key、模型 ID 和能力。系统会自动维护底层 Model、Endpoint 与默认 Profile。
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-5">
        <section className="grid gap-4 sm:grid-cols-2">
          <Field label="模型类型" required>
            <Select value={form.presetKey} onValueChange={(value) => applyPreset(value as ModelPresetKey)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MODEL_PRESET_OPTIONS.map((preset) => (
                  <SelectItem key={preset.key} value={preset.key}>{preset.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="显示名称" required hint="例如：生产 GLM-5.2、内网 Qwen3">
            <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </Field>
          <Field label="API 协议" required>
            <Select value={form.apiFormat} onValueChange={(value) => applyProtocol(value as ModelApiFormat)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {API_FORMAT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="服务端模型 ID" required hint="实际发送到上游请求 model 字段的值">
            <Input
              className="font-mono"
              placeholder="glm-5.2 / qwen3-235b-a22b"
              value={form.providerModelId}
              onChange={(event) => setForm({ ...form, providerModelId: event.target.value })}
            />
          </Field>
          <Field label="API 地址" required hint="填写服务根地址，路径单独配置">
            <Input
              className="font-mono"
              placeholder="https://api.example.com"
              value={form.baseUrl}
              onChange={(event) => setForm({ ...form, baseUrl: event.target.value })}
            />
          </Field>
          <Field label="API Key" hint="当前版本会明文保存到 PostgreSQL；卡片列表不会展示完整 Key。">
            <Input
              type="password"
              autoComplete="new-password"
              className="font-mono"
              placeholder="sk-...（无鉴权服务可留空）"
              value={form.apiKey}
              onChange={(event) => setForm({ ...form, apiKey: event.target.value })}
            />
          </Field>
          <Field label="状态">
            <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value as ResourceStatus })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">启用</SelectItem>
                <SelectItem value="disabled">停用</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="配置标识" hint="留空时根据模型 ID 自动生成；创建后不建议修改。">
            <Input
              className="font-mono"
              placeholder="自动生成"
              value={form.code}
              disabled={Boolean(editing?.profile)}
              onChange={(event) => setForm({ ...form, code: event.target.value })}
            />
          </Field>
        </section>

        <Field label="描述">
          <Textarea rows={2} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        </Field>

        <section className="space-y-3 rounded-lg border p-4">
          <div>
            <h4 className="font-medium">模型能力</h4>
            <p className="text-xs text-muted-foreground">这些开关会进入 Agent 可选择的稳定模型配置。</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Toggle label="流式推理" checked={form.streaming} onCheckedChange={(streaming) => setForm({ ...form, streaming })} />
            <Toggle label="深度思考" checked={form.reasoning} onCheckedChange={(reasoning) => setForm({ ...form, reasoning })} />
            <Toggle label="Tool Calling" checked={form.toolCalling} onCheckedChange={(toolCalling) => setForm({ ...form, toolCalling })} />
            <Toggle label="结构化输出" checked={form.structuredOutput} onCheckedChange={(structuredOutput) => setForm({ ...form, structuredOutput })} />
          </div>
        </section>

        <section className="space-y-4 rounded-lg border p-4">
          <div>
            <h4 className="font-medium">运行参数</h4>
            <p className="text-xs text-muted-foreground">常用限制直接配置，厂商差异放到默认请求参数。</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="上下文长度">
              <Input type="number" min={1} value={form.contextWindow} onChange={(event) => setForm({ ...form, contextWindow: event.target.value })} />
            </Field>
            <Field label="最大输出 Tokens">
              <Input type="number" min={1} value={form.maxOutputTokens} onChange={(event) => setForm({ ...form, maxOutputTokens: event.target.value })} />
            </Field>
            <Field label="API 路径" hint="通常由协议自动填充">
              <Input className="font-mono" value={form.apiPath} onChange={(event) => setForm({ ...form, apiPath: event.target.value })} />
            </Field>
          </div>
          <Field label="默认请求参数" hint="JSON 对象，例如 temperature、top_p；不会覆盖模型 ID、流式和推理映射。">
            <Textarea
              className="min-h-28 font-mono text-xs"
              value={form.defaultParameters}
              onChange={(event) => setForm({ ...form, defaultParameters: event.target.value })}
            />
          </Field>
        </section>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>取消</Button>
        <Button onClick={submit} disabled={!canSubmit}>
          {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {editing ? '保存修改' : '添加模型'}
        </Button>
      </DialogFooter>
    </DialogContent>
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
      <Label>{label}{required ? <span className="ml-1 text-destructive">*</span> : null}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
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
    <div className="flex items-center justify-between rounded-md border px-3 py-2.5">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
