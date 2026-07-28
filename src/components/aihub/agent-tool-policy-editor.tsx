'use client';

import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { AgentApprovalMode } from '@/lib/api/agents';

interface ToolBinding {
  name?: string;
  version?: string;
  required?: boolean;
  approvalMode?: AgentApprovalMode | string;
  [key: string]: unknown;
}

export function AgentToolPolicyEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  let document: Record<string, unknown> | null = null;
  let tools: ToolBinding[] = [];
  try {
    document = JSON.parse(value) as Record<string, unknown>;
    tools = Array.isArray(document.tools) ? (document.tools as ToolBinding[]) : [];
  } catch {
    return (
      <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
        <AlertTriangle className="h-4 w-4" /> Fix the Definition JSON before editing Tool consent policies.
      </div>
    );
  }

  const updateTool = (index: number, patch: Partial<ToolBinding>) => {
    if (!document) return;
    const nextTools = tools.map((tool, current) => current === index ? { ...tool, ...patch } : tool);
    onChange(JSON.stringify({ ...document, tools: nextTools }, null, 2));
  };

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-start gap-2">
        <ShieldCheck className="mt-0.5 h-4 w-4 text-violet-500" />
        <div>
          <Label className="text-xs">Tool consent policy</Label>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Consent controls Tool exposure only. IAM still decides every concrete resource operation.
          </p>
        </div>
      </div>
      {tools.length === 0 ? (
        <p className="rounded bg-muted/40 p-2 text-xs text-muted-foreground">No Tools are bound. Add Tool entries in Definition JSON first.</p>
      ) : (
        <div className="space-y-2">
          {tools.map((tool, index) => {
            const mode = (tool.approvalMode || 'always') as AgentApprovalMode;
            return (
              <div key={`${tool.name || 'tool'}-${index}`} className="grid items-center gap-2 rounded-md border p-2 md:grid-cols-[1fr_170px_120px]">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-mono text-xs">{tool.name || `tool-${index + 1}`}</span>
                    {tool.version && <Badge variant="secondary" className="text-[10px]">{tool.version}</Badge>}
                  </div>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {mode === 'always' && 'Exposed on every run; this does not create an IAM grant.'}
                    {mode === 'per_run' && 'The user launching the Agent must approve this Tool for that run.'}
                    {mode === 'disabled' && 'Kept in the definition but never exposed to the model.'}
                  </p>
                </div>
                <Select value={mode} onValueChange={(next) => updateTool(index, { approvalMode: next })}>
                  <SelectTrigger size="sm" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="always">Always consented</SelectItem>
                    <SelectItem value="per_run">Ask every run</SelectItem>
                    <SelectItem value="disabled">Disabled</SelectItem>
                  </SelectContent>
                </Select>
                <label className="flex items-center gap-2 text-xs">
                  <Checkbox checked={Boolean(tool.required)} onCheckedChange={(checked) => updateTool(index, { required: checked === true })} />
                  Required
                </label>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
