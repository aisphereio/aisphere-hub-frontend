'use client';

import { AlertTriangle, FileJson, Info, Lock, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import type { Tool, ToolDefinition } from '@/lib/api/types';

// parseSchema tolerates inputSchema arriving as a JSON string (the proto
// string field is serialized that way) or already-parsed as an object.
function parseSchema(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
}

interface ParamRow {
  name: string;
  type: string;
  required: boolean;
  description: string;
  defaultValue?: string;
}

function extractParams(def: ToolDefinition | undefined): ParamRow[] {
  const schema = parseSchema(def?.inputSchema);
  if (!schema) return [];
  const props = schema.properties as
    | Record<string, { type?: string; description?: string; default?: unknown; format?: string }>
    | undefined;
  if (!props) return [];
  const required = (schema.required as string[]) || [];
  return Object.entries(props).map(([name, p]) => ({
    name,
    type: p?.format ? `${p.type} (${p.format})` : p?.type || '-',
    required: required.includes(name),
    description: p?.description || '',
    defaultValue: p?.default !== undefined ? JSON.stringify(p.default) : undefined,
  }));
}

function MetaCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <div className="text-xs font-medium break-all">{value || '-'}</div>
    </div>
  );
}

// ToolOverview renders a readable, non-JSON summary of a Tool so users
// (especially of builtin tools) can understand what it does, its parameters,
// and its execution policy without reading raw JSON.
export function ToolOverview({ tool }: { tool: Tool }) {
  const def = tool.latestVersion && tool.versions ? tool.versions[tool.latestVersion]?.definition : undefined;
  const exec = def?.execution;
  const runtime = def?.runtime;
  const params = extractParams(def);
  const isBuiltin = tool.status === 'builtin';
  const description = tool.description || runtime?.description;

  return (
    <div className="space-y-4">
      {isBuiltin && (
        <div className="flex items-center gap-2 rounded-md border border-violet-500/30 bg-violet-500/5 p-2.5 text-xs text-violet-700 dark:text-violet-300">
          <Lock className="h-3.5 w-3.5" />
          内置工具（builtin）——由平台代码管理，只读。定义随 Hub 版本发布，不可在 UI 编辑或删除。
        </div>
      )}

      {description && (
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">说明</Label>
          <p className="text-sm leading-relaxed">{description}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="secondary" className="text-[10px]">{runtime?.type || '-'}</Badge>
        {exec && <Badge variant="outline" className="text-[10px]">placement: {exec.placement}</Badge>}
        {exec && <Badge variant="outline" className="text-[10px]">runner: {exec.runner}</Badge>}
        {exec?.filesystem && <Badge variant="outline" className="text-[10px]">fs: {exec.filesystem}</Badge>}
        {exec?.network && <Badge variant="outline" className="text-[10px]">net: {exec.network}</Badge>}
        {tool.status && <Badge variant="outline" className="text-[10px]">{tool.status}</Badge>}
        {tool.scope && <Badge variant="outline" className="text-[10px]">scope: {tool.scope}</Badge>}
      </div>

      <Separator />

      {params.length > 0 && (
        <div className="space-y-2">
          <Label className="text-[11px] text-muted-foreground">输入参数</Label>
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left font-medium p-2">参数</th>
                  <th className="text-left font-medium p-2 w-32">类型</th>
                  <th className="text-left font-medium p-2 w-16">必填</th>
                  <th className="text-left font-medium p-2">说明</th>
                </tr>
              </thead>
              <tbody>
                {params.map((p) => (
                  <tr key={p.name} className="border-t">
                    <td className="p-2 font-mono">{p.name}</td>
                    <td className="p-2 text-muted-foreground">{p.type}</td>
                    <td className="p-2">{p.required ? <Badge variant="destructive" className="text-[9px]">必填</Badge> : <span className="text-muted-foreground">可选</span>}</td>
                    <td className="p-2 text-muted-foreground">
                      {p.description}
                      {p.defaultValue && <span className="ml-1 text-muted-foreground/70">（默认: {p.defaultValue}）</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {params.length === 0 && (
        <div className="flex items-center gap-2 rounded-md bg-muted/40 p-2.5 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5" />
          此工具无输入参数。
        </div>
      )}

      <Separator />

      <div className="grid gap-3 md:grid-cols-3">
        <MetaCell label="执行位置 (placement)" value={exec?.placement} />
        <MetaCell label="执行器 (runner)" value={exec?.runner} />
        <MetaCell label="文件系统" value={exec?.filesystem} />
        <MetaCell label="网络" value={exec?.network} />
        <MetaCell label="超时 (ms)" value={def?.timeoutMillis} />
        <MetaCell label="凭证引用" value={runtime?.credentialRef} />
      </div>

      {exec?.capabilities && exec.capabilities.length > 0 && (
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground flex items-center gap-1"><Shield className="h-3 w-3" /> 权限能力 (capabilities)</Label>
          <div className="flex flex-wrap gap-1.5">
            {exec.capabilities.map((cap) => (
              <Badge key={cap} variant="outline" className="text-[10px] border-amber-500/40 text-amber-600 dark:text-amber-300">{cap}</Badge>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">调用此工具时，Runtime 会按 capability 做资源级 IAM 校验（如 skill:view / skill:publish）。</p>
        </div>
      )}

      {def?.retry && (
        <div className="grid gap-3 md:grid-cols-3">
          <MetaCell label="重试次数" value={def.retry.maxAttempts} />
          <MetaCell label="重试间隔 (ms)" value={def.retry.backoffMillis} />
        </div>
      )}

      <Separator />

      <div className="grid gap-3 md:grid-cols-4">
        <MetaCell label="最新版本" value={tool.latestVersion} />
        <MetaCell label="修订" value={tool.versions?.[tool.latestVersion ?? '']?.revision} />
        <MetaCell label="所有者" value={tool.ownerSubject} />
        <MetaCell label="更新时间" value={tool.updateTime ? new Date(tool.updateTime).toLocaleString('zh-CN') : '-'} />
      </div>

      {tool.versions && Object.keys(tool.versions).length > 1 && (
        <div className="space-y-1.5">
          <Label className="text-[11px] text-muted-foreground flex items-center gap-1"><FileJson className="h-3 w-3" /> 版本历史（{Object.keys(tool.versions).length}）</Label>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(tool.versions)
              .sort(([, a], [, b]) => (b.createTime || 0) - (a.createTime || 0))
              .map(([ver, rec]) => (
                <Badge key={ver} variant={ver === tool.latestVersion ? 'default' : 'outline'} className="text-[10px] font-mono">
                  {ver}{ver === tool.latestVersion ? ' · latest' : ''}
                </Badge>
              ))}
          </div>
        </div>
      )}

      {isBuiltin && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5 text-[11px] text-amber-700 dark:text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>内置工具的执行链路（Runtime Tool Broker → Sandbox/MCP/HTTP）尚未接通。当前可查看定义与参数；实际调用需等 P2 执行面落地。</span>
        </div>
      )}
    </div>
  );
}
