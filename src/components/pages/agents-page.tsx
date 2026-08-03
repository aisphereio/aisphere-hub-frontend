'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Bot, FileCode2, PlayCircle, Plus, RefreshCw, Save, Share2, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { AgentToolPolicyEditor } from '@/components/aihub/agent-tool-policy-editor';
import { AgentSkillPromptEditor } from '@/components/aihub/agent-skill-prompt-editor';
import { AgentWorkspace } from '@/components/aihub/agent-workspace';
import { ResourceSharePanel } from '@/components/aihub/resource-share-panel';
import { ConfirmDialog, EmptyState, ListSkeleton, StatCard } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  useAgentDelete,
  useAgentDetail,
  useAgentResolve,
  useAgentRunPlan,
  useAgentSave,
  useAgentUpdate,
  useAgents,
} from '@/hooks/use-agents';
import type { AgentRunPlan } from '@/lib/api/agents';
import type { Agent, AgentDefinition, AgentListItem, AgentUpsertRequest } from '@/lib/api/types';
import { fmtTime } from '@/lib/utils';

const DEFAULT_DEFINITION = {
  entryPoint: 'root_agent.yaml',
  files: {
    'root_agent.yaml': 'name: demo-agent\ndescription: Managed by AIHub\n',
  },
  services: [],
  skills: [],
  skillSets: [],
  tools: [],
} as AgentDefinition;

function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function parseDefinition(raw: string): AgentDefinition {
  const parsed = JSON.parse(raw) as AgentDefinition;
  if (!parsed.entryPoint || !parsed.files || typeof parsed.files !== 'object') {
    throw new Error('definition must include entryPoint and files');
  }
  return parsed;
}

function latestVersion(agent?: Agent) {
  if (!agent) return undefined;
  return agent.latestVersion && agent.versions ? agent.versions[agent.latestVersion] : undefined;
}

function AgentCreateDialog({ onCreated }: { onCreated: (id: string) => void }) {
  const save = useAgentSave();
  const [open, setOpen] = useState(false);
  const [id, setId] = useState('demo-agent');
  const [displayName, setDisplayName] = useState('Demo Agent');
  const [description, setDescription] = useState('Hub-managed Agent with human Tool consent');
  const [definitionText, setDefinitionText] = useState(pretty(DEFAULT_DEFINITION));

  const submit = async () => {
    try {
      const body: AgentUpsertRequest = {
        id: id.trim(),
        displayName: displayName.trim(),
        description: description.trim(),
        status: 'active',
        definition: parseDefinition(definitionText),
      };
      const out = await save.mutateAsync(body);
      const agentId = out.agent?.id || body.id || '';
      toast.success(`Agent ${agentId} created`);
      setOpen(false);
      onCreated(agentId);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Create agent failed');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="new-agent" size="sm" className="bg-gradient-to-r from-violet-600 to-fuchsia-500">
          <Plus className="mr-1 h-3.5 w-3.5" /> New Agent
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader><DialogTitle>Create Agent</DialogTitle></DialogHeader>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5"><Label className="text-xs">Agent ID</Label><Input data-testid="agent-id" value={id} onChange={(e) => setId(e.target.value)} /></div>
          <div className="space-y-1.5"><Label className="text-xs">Display Name</Label><Input data-testid="agent-display-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></div>
          <div className="space-y-1.5 md:col-span-2"><Label className="text-xs">Description</Label><Input data-testid="agent-description" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        </div>
        <AgentToolPolicyEditor value={definitionText} onChange={setDefinitionText} />
        <AgentSkillPromptEditor value={definitionText} onChange={setDefinitionText} />
        <div className="space-y-1.5">
          <Label className="text-xs">Definition JSON</Label>
          <Textarea className="min-h-[300px] font-mono text-xs" value={definitionText} onChange={(e) => setDefinitionText(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button data-testid="create-agent-submit" onClick={submit} disabled={save.isPending}><Save className="mr-1 h-3.5 w-3.5" /> Create</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AgentListCard({ item, active, onClick }: { item: AgentListItem; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`w-full rounded-lg border p-3 text-left transition-colors ${active ? 'border-violet-500 bg-violet-500/5' : 'hover:bg-accent/50'}`}>
      <div className="flex items-start gap-2">
        <Bot className="mt-0.5 h-4 w-4 text-violet-500" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{item.displayName || item.id}</span>
            <Badge variant="secondary" className="text-[10px]">{item.latestVersion || '-'}</Badge>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.id}</p>
          {item.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.description}</p>}
        </div>
      </div>
    </button>
  );
}

export function AgentsPage() {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [definitionText, setDefinitionText] = useState(pretty(DEFAULT_DEFINITION));
  const [version, setVersion] = useState('');
  const [commitMsg, setCommitMsg] = useState('update agent definition');
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<AgentRunPlan | null>(null);
  const [approvedTools, setApprovedTools] = useState<string[]>([]);

  const { data: agents = [], isLoading, error, refetch } = useAgents({ q: search || undefined, pageSize: 80 });
  const filtered = useMemo(
    () => agents.filter((a) => !search || `${a.id} ${a.displayName || ''} ${a.description || ''}`.toLowerCase().includes(search.toLowerCase())),
    [agents, search],
  );
  const { data: detail, refetch: refetchDetail } = useAgentDetail(selectedId);
  const update = useAgentUpdate();
  const remove = useAgentDelete();
  const planRun = useAgentRunPlan();
  const resolve = useAgentResolve();
  const agent = detail?.agent;
  const v = latestVersion(agent);

  useEffect(() => {
    if (!selectedId && filtered.length > 0) setSelectedId(filtered[0].id);
  }, [filtered, selectedId]);

  useEffect(() => {
    if (v?.definition) setDefinitionText(pretty(v.definition));
    if (agent?.latestVersion) setVersion('');
  }, [agent?.latestVersion, v?.definition]);

  const saveUpdate = async () => {
    if (!agent) return;
    try {
      await update.mutateAsync({
        agentId: agent.id,
        data: {
          id: agent.id,
          displayName: agent.displayName,
          description: agent.description,
          status: agent.status || 'active',
          scope: agent.scope,
          labels: agent.labels,
          version: version.trim() || undefined,
          commitMsg,
          definition: parseDefinition(definitionText),
        },
      });
      toast.success(`Agent ${agent.id} updated`);
      refetch();
      refetchDetail();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Update agent failed');
    }
  };

  const resolveRun = async (tools: string[]) => {
    if (!agent) return;
    const out = await resolve.mutateAsync({
      agentId: agent.id,
      request: {
        runtimeId: 'agentkit-console',
        sessionId: `console-${Date.now()}`,
        approvalConfirmed: true,
        approvedTools: tools,
      },
    });
    toast.success(`Snapshot ${out.snapshotId} resolved with ${out.tools?.length || 0} Tools`);
  };

  const runAgent = async () => {
    if (!agent) return;
    try {
      const plan = await planRun.mutateAsync({ agentId: agent.id });
      const perRun = plan.tools.filter((tool) => tool.approvalMode === 'per_run');
      if (perRun.length === 0) {
        await resolveRun([]);
        return;
      }
      setPendingPlan(plan);
      setApprovedTools(perRun.filter((tool) => tool.required).map((tool) => tool.tool));
      setApprovalOpen(true);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Plan Agent run failed');
    }
  };

  const confirmRun = async () => {
    try {
      await resolveRun(approvedTools);
      setApprovalOpen(false);
      setPendingPlan(null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Resolve runtime snapshot failed');
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await remove.mutateAsync(deleteId);
      toast.success(`Agent ${deleteId} deleted`);
      setSelectedId(null);
      refetch();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Delete agent failed');
    }
    setDeleteId(null);
  };

  const perRunTools = pendingPlan?.tools.filter((tool) => tool.approvalMode === 'per_run') || [];

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={<Bot className="h-4 w-4" />} label="Agents" value={agents.length} />
        <StatCard icon={<FileCode2 className="h-4 w-4" />} label="Versioned" value={agents.filter((a) => a.latestVersion).length} />
        <StatCard icon={<PlayCircle className="h-4 w-4" />} label="Runnable" value={agents.filter((a) => a.status !== 'disabled').length} />
        <StatCard icon={<Share2 className="h-4 w-4" />} label="AIHub Objects" value="agent" />
      </div>

      <div className="flex items-center gap-2">
        <Input className="max-w-md" placeholder="Search agents..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh</Button>
        <AgentCreateDialog onCreated={(id) => { setSelectedId(id); refetch(); }} />
      </div>

      <div className="flex items-start gap-2 rounded-md border border-violet-500/30 bg-violet-500/5 p-3 text-xs">
        <ShieldCheck className="mt-0.5 h-4 w-4 text-violet-500" />
        <div>
          <div className="font-medium">Human consent is not an IAM grant</div>
          <p className="mt-0.5 text-muted-foreground">Hub controls which Tools enter the immutable run snapshot. Runtime propagates the Principal. The target service still calls IAM for the actual resource and action.</p>
        </div>
      </div>

      {error && <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"><AlertTriangle className="h-4 w-4" />{error.message}</div>}

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader className="py-3"><CardTitle className="text-sm">Agent Registry</CardTitle></CardHeader>
          <CardContent className="p-3 pt-0">
            {isLoading ? <ListSkeleton count={4} /> : filtered.length === 0 ? (
              <EmptyState icon={<Bot className="h-10 w-10" />} title="No agents" description="Create an Agent definition and configure Tool consent." />
            ) : (
              <ScrollArea className="h-[620px] pr-2">
                <div className="space-y-2">
                  {filtered.map((item) => <AgentListCard key={item.id} item={item} active={selectedId === item.id} onClick={() => setSelectedId(item.id)} />)}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-sm">{agent?.displayName || agent?.id || 'Agent Detail'}</CardTitle>
                {detail?.object && <p className="mt-1 text-xs text-muted-foreground">{detail.object}</p>}
              </div>
              {agent && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={runAgent} disabled={planRun.isPending || resolve.isPending}>
                    <PlayCircle className="mr-1 h-3.5 w-3.5" /> Plan & Run
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => setDeleteId(agent.id)}><Trash2 className="mr-1 h-3.5 w-3.5" /> Delete</Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!agent ? (
              <EmptyState icon={<Bot className="h-10 w-10" />} title="Select an agent" description="Choose an Agent to edit its versioned definition and Tool consent policy." />
            ) : (
              <Tabs defaultValue="definition" className="space-y-4">
                <TabsList><TabsTrigger value="definition">Definition</TabsTrigger><TabsTrigger value="runtime">Playground</TabsTrigger><TabsTrigger value="shares">Shares</TabsTrigger></TabsList>
                <TabsContent value="definition" className="space-y-3">
                  <div className="grid gap-3 text-xs md:grid-cols-4">
                    <div><Label className="text-muted-foreground">Latest</Label><div className="mt-1 font-medium">{agent.latestVersion || '-'}</div></div>
                    <div><Label className="text-muted-foreground">Revision</Label><div className="mt-1 font-mono">{v?.revision || '-'}</div></div>
                    <div><Label className="text-muted-foreground">Updated</Label><div className="mt-1">{agent.updateTime ? fmtTime(agent.updateTime) : '-'}</div></div>
                    <div><Label className="text-muted-foreground">Tools</Label><div className="mt-1">{v?.definition?.tools?.length || 0} bound</div></div>
                  </div>
                  <Separator />
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1.5"><Label className="text-xs">New Version</Label><Input placeholder="blank = next patch" value={version} onChange={(e) => setVersion(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label className="text-xs">Commit Message</Label><Input value={commitMsg} onChange={(e) => setCommitMsg(e.target.value)} /></div>
                  </div>
                  <AgentToolPolicyEditor value={definitionText} onChange={setDefinitionText} />
                  <AgentSkillPromptEditor value={definitionText} onChange={setDefinitionText} />
                  <div className="space-y-1.5">
                    <Label className="text-xs">Definition JSON</Label>
                    <Textarea className="min-h-[380px] font-mono text-xs" value={definitionText} onChange={(e) => setDefinitionText(e.target.value)} />
                  </div>
                  <div className="flex justify-end"><Button data-testid="save-agent-version" onClick={saveUpdate} disabled={update.isPending}><Save className="mr-1 h-3.5 w-3.5" /> Save new version</Button></div>
                </TabsContent>
                <TabsContent value="runtime" className="space-y-3">
                  <p className="text-xs text-muted-foreground">The snapshot contains only approved Tool versions and marks authorization as principal passthrough with IAM enforcement at the resource service.</p>
                  <Textarea readOnly className="min-h-[420px] font-mono text-xs" value={resolve.data ? pretty(resolve.data) : (planRun.data ? pretty(planRun.data) : 'Click Plan & Run to preview consent and resolve the Runtime snapshot.')} />
                  <AgentWorkspace agentId={agent.id} agentVersion={agent.latestVersion} />
                </TabsContent>
                <TabsContent value="shares">
                  <ResourceSharePanel resourceType="agent" resourceId={agent.id} object={`agent:${agent.id}`} owner={agent.ownerSubject} />
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={approvalOpen} onOpenChange={setApprovalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Approve Tools for this run</DialogTitle></DialogHeader>
          <div className="rounded-md border bg-muted/30 p-3 text-xs">
            <p>Approval only exposes the selected Tools to the model for this run.</p>
            <p className="mt-1 text-muted-foreground">IAM still validates the Principal against each concrete Skill, Tool, cluster, namespace, or other resource when the operation is executed.</p>
          </div>
          <div className="max-h-[420px] space-y-2 overflow-y-auto">
            {perRunTools.map((tool) => {
              const checked = approvedTools.includes(tool.tool);
              return (
                <label key={tool.tool} className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
                  <Checkbox
                    className="mt-0.5"
                    checked={checked}
                    disabled={Boolean(tool.required)}
                    onCheckedChange={(next) => {
                      setApprovedTools((current) => next === true ? [...new Set([...current, tool.tool])] : current.filter((name) => name !== tool.tool));
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm">{tool.tool}</span>
                      {tool.required && <Badge>Required</Badge>}
                      <Badge variant="secondary">Ask every run</Badge>
                    </div>
                    {tool.capabilities?.length ? <p className="mt-1 text-xs text-muted-foreground">Capabilities: {tool.capabilities.join(', ')}</p> : null}
                    {tool.permissions?.map((permission) => (
                      <p key={`${permission.resourceType}:${permission.permission}`} className="mt-1 text-xs text-muted-foreground">
                        IAM at resource service: {permission.resourceType}.{permission.permission}
                      </p>
                    ))}
                  </div>
                </label>
              );
            })}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setApprovalOpen(false)}>Cancel</Button>
            <Button onClick={confirmRun} disabled={resolve.isPending}><ShieldCheck className="mr-1 h-4 w-4" /> Approve and resolve</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteId)}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
        title="Delete Agent"
        description={`Delete agent ${deleteId || ''}? This removes all stored versions from Hub.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
