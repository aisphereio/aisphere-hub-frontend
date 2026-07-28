'use client';

import { AlertTriangle, BrainCircuit, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useModelProfilesV2 } from '@/hooks/use-model-management';
import type { AgentApprovalMode } from '@/lib/api/agents';

interface ToolBinding {
  name?: string;
  version?: string;
  required?: boolean;
  approvalMode?: AgentApprovalMode | string;
  [key: string]: unknown;
}

interface ModelBinding {
  profileId?: string;
  revision?: number;
}

export function AgentToolPolicyEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { data: modelProfiles = [], isLoading: modelsLoading } =
    useModelProfilesV2({ pageSize: 200 });

  let document: Record<string, unknown> | null = null;
  let tools: ToolBinding[] = [];
  let model: ModelBinding = {};
  try {
    document = JSON.parse(value) as Record<string, unknown>;
    tools = Array.isArray(document.tools)
      ? (document.tools as ToolBinding[])
      : [];
    model =
      document.model && typeof document.model === 'object'
        ? (document.model as ModelBinding)
        : {};
  } catch {
    return (
      <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
        <AlertTriangle className="h-4 w-4" /> Fix the Definition JSON before
        editing Model and Tool policies.
      </div>
    );
  }

  const updateModel = (profileId: string) => {
    if (!document) return;
    const next = { ...document };
    if (profileId === '__none__') {
      delete next.model;
    } else {
      next.model = { profileId };
    }
    onChange(JSON.stringify(next, null, 2));
  };

  const updateTool = (index: number, patch: Partial<ToolBinding>) => {
    if (!document) return;
    const nextTools = tools.map((tool, current) =>
      current === index ? { ...tool, ...patch } : tool,
    );
    onChange(JSON.stringify({ ...document, tools: nextTools }, null, 2));
  };

  const selectedProfile = modelProfiles.find(
    (profile) => profile.id === model.profileId,
  );

  return (
    <div className="space-y-3">
      <div className="space-y-3 rounded-md border p-3">
        <div className="flex items-start gap-2">
          <BrainCircuit className="mt-0.5 h-4 w-4 text-violet-500" />
          <div>
            <Label className="text-xs">ModelProfile</Label>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Agent stores an AISphere ModelProfile UUID. Hub resolves and
              freezes the concrete model, Endpoint, reasoning mapping and
              revision into each run snapshot.
            </p>
          </div>
        </div>
        <Select
          value={model.profileId || '__none__'}
          onValueChange={updateModel}
          disabled={modelsLoading}
        >
          <SelectTrigger className="w-full">
            <SelectValue
              placeholder={modelsLoading ? 'Loading ModelProfiles...' : 'Select ModelProfile'}
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">No model bound</SelectItem>
            {modelProfiles
              .filter((profile) => profile.status === 'active')
              .map((profile) => (
                <SelectItem key={profile.id} value={profile.id}>
                  {profile.displayName} · {profile.code}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        {selectedProfile ? (
          <div className="flex flex-wrap items-center gap-1.5 rounded bg-muted/40 p-2 text-[11px] text-muted-foreground">
            <Badge variant="outline">rev {selectedProfile.latestRevision}</Badge>
            <Badge variant="outline">
              reasoning: {selectedProfile.reasoningPolicy.mode}
            </Badge>
            <Badge variant="outline">
              effort: {selectedProfile.reasoningPolicy.effort}
            </Badge>
            <span className="font-mono">{selectedProfile.id}</span>
          </div>
        ) : model.profileId ? (
          <div className="flex items-center gap-2 rounded border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5" />
            The bound ModelProfile is unavailable or disabled. Select another
            profile before saving.
          </div>
        ) : null}
      </div>

      <div className="space-y-2 rounded-md border p-3">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 text-violet-500" />
          <div>
            <Label className="text-xs">Tool consent policy</Label>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Consent controls Tool exposure only. IAM still decides every
              concrete resource operation.
            </p>
          </div>
        </div>
        {tools.length === 0 ? (
          <p className="rounded bg-muted/40 p-2 text-xs text-muted-foreground">
            No Tools are bound. Add Tool entries in Definition JSON first.
          </p>
        ) : (
          <div className="space-y-2">
            {tools.map((tool, index) => {
              const mode = (tool.approvalMode ||
                'always') as AgentApprovalMode;
              return (
                <div
                  key={`${tool.name || 'tool'}-${index}`}
                  className="grid items-center gap-2 rounded-md border p-2 md:grid-cols-[1fr_170px_120px]"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-mono text-xs">
                        {tool.name || `tool-${index + 1}`}
                      </span>
                      {tool.version && (
                        <Badge variant="secondary" className="text-[10px]">
                          {tool.version}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {mode === 'always' &&
                        'Exposed on every run; this does not create an IAM grant.'}
                      {mode === 'per_run' &&
                        'The user launching the Agent must approve this Tool for that run.'}
                      {mode === 'disabled' &&
                        'Kept in the definition but never exposed to the model.'}
                    </p>
                  </div>
                  <Select
                    value={mode}
                    onValueChange={(next) =>
                      updateTool(index, { approvalMode: next })
                    }
                  >
                    <SelectTrigger size="sm" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="always">Always consented</SelectItem>
                      <SelectItem value="per_run">Ask every run</SelectItem>
                      <SelectItem value="disabled">Disabled</SelectItem>
                    </SelectContent>
                  </Select>
                  <label className="flex items-center gap-2 text-xs">
                    <Checkbox
                      checked={Boolean(tool.required)}
                      onCheckedChange={(checked) =>
                        updateTool(index, { required: checked === true })
                      }
                    />
                    Required
                  </label>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
