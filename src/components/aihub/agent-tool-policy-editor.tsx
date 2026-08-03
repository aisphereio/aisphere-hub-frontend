'use client';

import { AlertTriangle, BrainCircuit, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { useToolDetail, useTools } from '@/hooks/use-tools';
import type { AgentApprovalMode } from '@/lib/api/agents';
import type { ToolListItem } from '@/lib/api/types';

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

// ToolBindingRow binds one Tool from the catalog: pick the tool, then a
// concrete immutable version, then the consent policy. Versions are loaded
// per selected tool so the binding always references an existing snapshot
// instead of a hand-typed string.
function ToolBindingRow({
  tool,
  catalog,
  onUpdate,
  onRemove,
}: {
  tool: ToolBinding;
  catalog: ToolListItem[];
  onUpdate: (patch: Partial<ToolBinding>) => void;
  onRemove: () => void;
}) {
  const { data: detail, isLoading: detailLoading } = useToolDetail(
    tool.name || null,
  );
  const catalogEntry = catalog.find((entry) => entry.id === tool.name);
  const detailTool = detail;
  const versionKeys = detailTool?.versions
    ? Object.keys(detailTool.versions).sort()
    : [];
  const mode = (tool.approvalMode || 'always') as AgentApprovalMode;
  const stale = Boolean(tool.name) && !catalogEntry;
  const versionMissing =
    Boolean(tool.version) &&
    versionKeys.length > 0 &&
    !versionKeys.includes(tool.version as string);

  return (
    <div className="space-y-2 rounded-md border p-2">
      <div className="grid items-center gap-2 md:grid-cols-[1fr_160px_36px]">
        <Select
          value={tool.name || ''}
          onValueChange={(name) => {
            const entry = catalog.find((item) => item.id === name);
            onUpdate({ name, version: entry?.latestVersion || '' });
          }}
        >
          <SelectTrigger data-testid={`agent-tool-name-${tool.name || 'empty'}`} size="sm" className="w-full">
            <SelectValue placeholder="Select a Tool from the catalog" />
          </SelectTrigger>
          <SelectContent>
            {stale && tool.name ? (
              <SelectItem value={tool.name}>
                {tool.name} · missing from catalog
              </SelectItem>
            ) : null}
            {catalog.map((entry) => (
              <SelectItem key={entry.id} value={entry.id}>
                {entry.displayName || entry.id} · {entry.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={tool.version || ''}
          onValueChange={(version) => onUpdate({ version })}
          disabled={!tool.name || detailLoading}
        >
          <SelectTrigger size="sm" className="w-full">
            <SelectValue
              placeholder={detailLoading ? 'Loading versions...' : 'Version'}
            />
          </SelectTrigger>
          <SelectContent>
            {versionMissing && tool.version ? (
              <SelectItem value={tool.version}>
                {tool.version} · not found
              </SelectItem>
            ) : null}
            {versionKeys.map((version) => (
              <SelectItem key={version} value={version}>
                {version}
                {version === detailTool?.latestVersion ? ' · latest' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
          aria-label="Remove tool binding"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      {stale ? (
        <div className="flex items-center gap-2 rounded border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5" />
          This Tool is not in the catalog (deleted?). Pick another one or
          remove the binding.
        </div>
      ) : null}
      {versionMissing ? (
        <div className="flex items-center gap-2 rounded border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5" />
          The pinned version no longer exists. Versions are immutable — pick an
          existing version.
        </div>
      ) : null}
      {catalogEntry?.status === 'disabled' ? (
        <div className="flex items-center gap-2 rounded border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5" />
          This Tool is disabled in the catalog and will be rejected on save.
        </div>
      ) : null}
      <div className="grid items-center gap-2 md:grid-cols-[1fr_170px_120px]">
        <p className="text-[10px] text-muted-foreground">
          {mode === 'always' &&
            'Exposed on every run; this does not create an IAM grant.'}
          {mode === 'per_run' &&
            'The user launching the Agent must approve this Tool for that run.'}
          {mode === 'disabled' &&
            'Kept in the definition but never exposed to the model.'}
        </p>
        <Select
          value={mode}
          onValueChange={(next) => onUpdate({ approvalMode: next })}
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
              onUpdate({ required: checked === true })
            }
          />
          Required
        </label>
      </div>
    </div>
  );
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
  const { data: catalog = [], isLoading: toolsLoading } = useTools({
    pageSize: 200,
  });

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

  const addTool = () => {
    if (!document) return;
    const nextTools = [
      ...tools,
      { name: '', version: '', required: false, approvalMode: 'always' },
    ];
    onChange(JSON.stringify({ ...document, tools: nextTools }, null, 2));
  };

  const removeTool = (index: number) => {
    if (!document) return;
    const nextTools = tools.filter((_, current) => current !== index);
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
          <div className="flex-1">
            <Label className="text-xs">Tool consent policy</Label>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Bind Tools from the catalog with a concrete version. Consent
              controls Tool exposure only. IAM still decides every concrete
              resource operation.
            </p>
          </div>
          <Button
            data-testid="add-agent-tool"
            type="button"
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={addTool}
            disabled={toolsLoading}
          >
            <Plus className="h-3.5 w-3.5" /> Add Tool
          </Button>
        </div>
        {tools.length === 0 ? (
          <p className="rounded bg-muted/40 p-2 text-xs text-muted-foreground">
            No Tools are bound. Use Add Tool to bind one from the catalog.
          </p>
        ) : (
          <div className="space-y-2">
            {tools.map((tool, index) => (
              <ToolBindingRow
                key={`${tool.name || 'new'}-${index}`}
                tool={tool}
                catalog={catalog}
                onUpdate={(patch) => updateTool(index, patch)}
                onRemove={() => removeTool(index)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
