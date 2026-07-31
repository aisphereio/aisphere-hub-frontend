'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Hammer, Plus, Save, Trash2, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useToolSave } from '@/hooks/use-tools';
import type { ToolDefinition, ToolUpsertRequest } from '@/lib/api/types';

type ParamType = 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array';

interface ParamRow {
  name: string;
  type: ParamType;
  required: boolean;
  description: string;
}

const STEPS = ['基本信息', '类型与协议', '执行策略', '输入参数', '预览创建'] as const;

const ID_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,126}[A-Za-z0-9])?$/;

const RUNNER_BY_TYPE: Record<string, string> = {
  builtin: 'builtin',
  mcp: 'mcp',
  http: 'http',
  openapi: 'http',
  function: 'python',
};

const PLACEMENT_BY_TYPE: Record<string, string> = {
  builtin: 'sandbox',
  mcp: 'runtime',
  http: 'remote',
  openapi: 'remote',
  function: 'runtime',
};

function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function StepIndicator({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {STEPS.map((label, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <div key={label} className="flex items-center gap-1.5">
            {i > 0 && <div className={`h-px w-4 ${done || active ? 'bg-violet-500' : 'bg-border'}`} />}
            <div className="flex items-center gap-1.5">
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                  done
                    ? 'bg-violet-500 text-white'
                    : active
                      ? 'border border-violet-500 text-violet-500'
                      : 'border border-border text-muted-foreground'
                }`}
              >
                {done ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span className={`hidden text-[11px] md:inline ${active ? 'text-foreground' : 'text-muted-foreground'}`}>
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ToolCreateWizard turns Tool creation into a step-by-step form: basic info →
// runtime type & protocol → execution policy → input params → preview. It
// composes the ToolDefinition for the user instead of requiring a large raw
// JSON document up front.
export function ToolCreateWizard({ onCreated }: { onCreated: (id: string) => void }) {
  const save = useToolSave();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  // Step 1: basic info
  const [id, setId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');

  // Step 2: runtime type & protocol
  const [runtimeType, setRuntimeType] = useState('mcp');
  const [rtName, setRtName] = useState('');
  const [rtServer, setRtServer] = useState('');
  const [rtUrl, setRtUrl] = useState('');
  const [rtMethod, setRtMethod] = useState('POST');
  const [rtPackage, setRtPackage] = useState('');
  const [rtEntryPoint, setRtEntryPoint] = useState('');
  const [credentialRef, setCredentialRef] = useState('');

  // Step 3: execution policy
  const [placement, setPlacement] = useState(PLACEMENT_BY_TYPE.mcp);
  const [runner, setRunner] = useState(RUNNER_BY_TYPE.mcp);
  const [filesystem, setFilesystem] = useState('none');
  const [network, setNetwork] = useState('restricted');
  const [timeoutMillis, setTimeoutMillis] = useState('30000');
  const [maxAttempts, setMaxAttempts] = useState('2');
  const [backoffMillis, setBackoffMillis] = useState('1000');

  // Step 4: input params
  const [params, setParams] = useState<ParamRow[]>([]);
  const [outputSchemaText, setOutputSchemaText] = useState('');

  const changeType = (next: string) => {
    setRuntimeType(next);
    setPlacement(PLACEMENT_BY_TYPE[next] || 'runtime');
    setRunner(RUNNER_BY_TYPE[next] || 'builtin');
  };

  const idValid = ID_PATTERN.test(id.trim());
  const step2Valid = useMemo(() => {
    switch (runtimeType) {
      case 'mcp':
        return rtServer.trim() !== '' && rtName.trim() !== '';
      case 'http':
      case 'openapi':
        return rtUrl.trim() !== '';
      case 'function':
        return rtPackage.trim() !== '' && rtEntryPoint.trim() !== '';
      case 'builtin':
        return true; // name falls back to the tool id
      default:
        return false;
    }
  }, [runtimeType, rtServer, rtName, rtUrl, rtPackage, rtEntryPoint]);

  const paramNamesValid = useMemo(() => {
    const names = params.map((p) => p.name.trim()).filter(Boolean);
    return names.length === new Set(names).size && names.every((n) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(n));
  }, [params]);

  const canNext =
    step === 0 ? idValid : step === 1 ? step2Valid : step === 3 ? paramNamesValid : true;

  const definition = useMemo((): ToolDefinition => {
    const runtime: ToolDefinition['runtime'] = {
      type: runtimeType,
      name: rtName.trim() || id.trim(),
      description: description.trim(),
    } as ToolDefinition['runtime'];
    if (runtimeType === 'mcp' && rtServer.trim()) runtime.server = rtServer.trim();
    if ((runtimeType === 'http' || runtimeType === 'openapi') && rtUrl.trim()) {
      runtime.url = rtUrl.trim();
      runtime.method = rtMethod;
    }
    if (runtimeType === 'function') {
      runtime.package = rtPackage.trim();
      runtime.entryPoint = rtEntryPoint.trim();
    }
    if (credentialRef.trim()) runtime.credentialRef = credentialRef.trim();

    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const p of params) {
      const name = p.name.trim();
      if (!name) continue;
      properties[name] = {
        type: p.type,
        ...(p.description.trim() ? { description: p.description.trim() } : {}),
      };
      if (p.required) required.push(name);
    }

    const def: ToolDefinition = {
      runtime,
      execution: {
        placement,
        runner,
        filesystem,
        network,
        capabilities: [],
      } as ToolDefinition['execution'],
      inputSchema: {
        type: 'object',
        properties,
        required,
        additionalProperties: false,
      } as ToolDefinition['inputSchema'],
      timeoutMillis: Number.parseInt(timeoutMillis, 10) || 30000,
      retry: {
        maxAttempts: Number.parseInt(maxAttempts, 10) || 1,
        backoffMillis: Number.parseInt(backoffMillis, 10) || 1000,
      } as ToolDefinition['retry'],
    };
    const outSchema = outputSchemaText.trim();
    if (outSchema) {
      try {
        def.outputSchema = JSON.parse(outSchema);
      } catch {
        // invalid output schema JSON is surfaced at create time; keep raw out
      }
    }
    return def;
  }, [
    runtimeType, rtName, rtServer, rtUrl, rtMethod, rtPackage, rtEntryPoint,
    credentialRef, id, description, placement, runner, filesystem, network,
    params, timeoutMillis, maxAttempts, backoffMillis, outputSchemaText,
  ]);

  const submit = async () => {
    try {
      const body: ToolUpsertRequest = {
        id: id.trim(),
        displayName: displayName.trim(),
        description: description.trim(),
        status: 'active',
        definition,
      };
      const out = await save.mutateAsync(body);
      const toolId = out?.id || body.id || '';
      toast.success(`Tool ${toolId} created`);
      setOpen(false);
      setStep(0);
      onCreated(toolId);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Create tool failed');
    }
  };

  const addParam = () =>
    setParams((rows) => [...rows, { name: '', type: 'string', required: false, description: '' }]);
  const updateParam = (index: number, patch: Partial<ParamRow>) =>
    setParams((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const removeParam = (index: number) => setParams((rows) => rows.filter((_, i) => i !== index));

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setStep(0); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-gradient-to-r from-violet-600 to-fuchsia-500">
          <Plus className="h-3.5 w-3.5 mr-1" /> New Tool
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Wand2 className="h-4 w-4 text-violet-500" /> Create Tool
          </DialogTitle>
          <StepIndicator step={step} />
        </DialogHeader>
        <Separator />

        <ScrollArea className="max-h-[55vh] pr-3">
          <div className="space-y-4 py-1">
            {step === 0 && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Tool ID *</Label>
                  <Input
                    value={id}
                    onChange={(e) => setId(e.target.value)}
                    placeholder="e.g. github.issue.create"
                    className="font-mono"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    字母数字开头结尾，中间可用 . _ -（如 workspace.read、skill.publish）。
                  </p>
                  {id && !idValid && (
                    <p className="flex items-center gap-1 text-[11px] text-destructive">
                      <AlertTriangle className="h-3 w-3" /> ID 格式不正确
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Display Name</Label>
                  <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. GitHub Create Issue" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Description</Label>
                  <Textarea
                    className="min-h-[72px]"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="这个工具是干什么的？会展示给 Agent 和调用方。"
                  />
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Tool 类型 *</Label>
                  <Select value={runtimeType} onValueChange={changeType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mcp">MCP — 外部 MCP Server 提供的工具</SelectItem>
                      <SelectItem value="http">HTTP — 调用一个 HTTP 接口</SelectItem>
                      <SelectItem value="openapi">OpenAPI — 按 OpenAPI 文档调用</SelectItem>
                      <SelectItem value="function">Function — 函数包/脚本入口</SelectItem>
                      <SelectItem value="builtin">Builtin — 平台内置能力</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {runtimeType === 'mcp' && (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">MCP Server *</Label>
                      <Input value={rtServer} onChange={(e) => setRtServer(e.target.value)} placeholder="e.g. github" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Tool 名称 *</Label>
                      <Input value={rtName} onChange={(e) => setRtName(e.target.value)} placeholder="e.g. create_issue" />
                    </div>
                  </div>
                )}
                {(runtimeType === 'http' || runtimeType === 'openapi') && (
                  <div className="grid gap-3 md:grid-cols-[1fr_140px]">
                    <div className="space-y-1.5">
                      <Label className="text-xs">URL *</Label>
                      <Input value={rtUrl} onChange={(e) => setRtUrl(e.target.value)} placeholder="https://api.example.com/do" className="font-mono" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Method</Label>
                      <Select value={rtMethod} onValueChange={setRtMethod}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
                            <SelectItem key={m} value={m}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
                {runtimeType === 'function' && (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Package *</Label>
                      <Input value={rtPackage} onChange={(e) => setRtPackage(e.target.value)} placeholder="e.g. tools/image_resize" className="font-mono" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Entry Point *</Label>
                      <Input value={rtEntryPoint} onChange={(e) => setRtEntryPoint(e.target.value)} placeholder="e.g. main" className="font-mono" />
                    </div>
                  </div>
                )}
                {runtimeType === 'builtin' && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tool 名称</Label>
                    <Input value={rtName} onChange={(e) => setRtName(e.target.value)} placeholder={`默认为 Tool ID（${id.trim() || '未填'}）`} />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label className="text-xs">Credential Ref（可选）</Label>
                  <Input
                    value={credentialRef}
                    onChange={(e) => setCredentialRef(e.target.value)}
                    placeholder="secret://project/xxx — 只存引用，凭证由 Runtime 解析"
                    className="font-mono"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    不要在这里填真实 Token；凭证统一走 Secret 引用，执行时由 Runtime 解析。
                  </p>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">在哪里执行（placement）</Label>
                    <Select value={placement} onValueChange={setPlacement}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sandbox">sandbox — Agent 沙箱内（受限）</SelectItem>
                        <SelectItem value="runtime">runtime — Runtime 代理（带权限）</SelectItem>
                        <SelectItem value="remote">remote — 远端服务</SelectItem>
                        <SelectItem value="hub">hub — Hub 自身</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">由什么执行（runner）</Label>
                    <Select value={runner} onValueChange={setRunner}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['builtin', 'mcp', 'stdio', 'http', 'container', 'wasm', 'python', 'binary'].map((r) => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">文件系统</Label>
                    <Select value={filesystem} onValueChange={setFilesystem}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">none — 不接触文件</SelectItem>
                        <SelectItem value="readonly">readonly — 只读工作区</SelectItem>
                        <SelectItem value="workspace">workspace — 读写工作区</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">网络</Label>
                    <Select value={network} onValueChange={setNetwork}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">none — 无外网</SelectItem>
                        <SelectItem value="restricted">restricted — 受限出口</SelectItem>
                        <SelectItem value="egress">egress — 允许外网</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">超时 (ms)</Label>
                    <Input type="number" value={timeoutMillis} onChange={(e) => setTimeoutMillis(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">重试次数</Label>
                    <Input type="number" value={maxAttempts} onChange={(e) => setMaxAttempts(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">重试间隔 (ms)</Label>
                    <Input type="number" value={backoffMillis} onChange={(e) => setBackoffMillis(e.target.value)} />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  placement 决定治理路径：sandbox 走沙箱网关，runtime 走 Runtime 代理与凭证托管，remote 直连外部服务。
                </p>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">输入参数（生成 inputSchema）</Label>
                  <Button type="button" variant="outline" size="sm" className="gap-1" onClick={addParam}>
                    <Plus className="h-3.5 w-3.5" /> 加参数
                  </Button>
                </div>
                {params.length === 0 ? (
                  <p className="rounded bg-muted/40 p-3 text-xs text-muted-foreground">
                    还没有参数。无参工具可以直接下一步；有参工具点「加参数」逐行填写。
                  </p>
                ) : (
                  <div className="space-y-2">
                    {params.map((p, index) => (
                      <div key={index} className="grid items-center gap-2 rounded-md border p-2 md:grid-cols-[1fr_110px_1fr_90px_32px]">
                        <Input
                          value={p.name}
                          onChange={(e) => updateParam(index, { name: e.target.value })}
                          placeholder="参数名"
                          className="font-mono h-8 text-xs"
                        />
                        <Select value={p.type} onValueChange={(v) => updateParam(index, { type: v as ParamType })}>
                          <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {(['string', 'number', 'integer', 'boolean', 'object', 'array'] as ParamType[]).map((t) => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          value={p.description}
                          onChange={(e) => updateParam(index, { description: e.target.value })}
                          placeholder="参数说明（可选）"
                          className="h-8 text-xs"
                        />
                        <label className="flex items-center gap-1.5 text-xs">
                          <Checkbox
                            checked={p.required}
                            onCheckedChange={(c) => updateParam(index, { required: c === true })}
                          />
                          必填
                        </label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => removeParam(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                {!paramNamesValid && (
                  <p className="flex items-center gap-1 text-[11px] text-destructive">
                    <AlertTriangle className="h-3 w-3" /> 参数名需为合法标识符且不能重复
                  </p>
                )}
                <div className="space-y-1.5">
                  <Label className="text-xs">输出 Schema（可选，JSON）</Label>
                  <Textarea
                    className="font-mono text-xs min-h-[72px]"
                    value={outputSchemaText}
                    onChange={(e) => setOutputSchemaText(e.target.value)}
                    placeholder='{"type":"object","properties":{...}}'
                  />
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <Badge variant="secondary">{id.trim() || '未命名'}</Badge>
                  <Badge variant="outline">{runtimeType}</Badge>
                  <Badge variant="outline">{placement} / {runner}</Badge>
                  <Badge variant="outline">fs: {filesystem}</Badge>
                  <Badge variant="outline">net: {network}</Badge>
                  <Badge variant="outline">{params.filter((p) => p.name.trim()).length} 参数</Badge>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">生成的 Definition（只读预览）</Label>
                  <Textarea readOnly className="font-mono text-xs min-h-[280px]" value={pretty(definition)} />
                </div>
                <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                  <Hammer className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  创建后仍可随时在详情页编辑并发布新版本；版本不可变，每次修改都会生成新版本。
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        <Separator />
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            <ChevronLeft className="h-3.5 w-3.5 mr-1" /> 上一步
          </Button>
          {step < STEPS.length - 1 ? (
            <Button size="sm" onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
              下一步 <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          ) : (
            <Button size="sm" onClick={submit} disabled={save.isPending || !idValid || !step2Valid}>
              <Save className="h-3.5 w-3.5 mr-1" /> 创建 Tool
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
