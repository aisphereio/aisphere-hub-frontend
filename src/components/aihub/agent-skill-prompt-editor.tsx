'use client';

import { useMemo, useState } from 'react';
import { useSkills } from '@/hooks/use-skills';
import { useSkillReleases } from '@/hooks/use-skill-releases';
import { useSkillSets, useSkillSetSkills } from '@/hooks/use-skillsets';
import type { AgentDefinition, AgentSkillRef, AgentSkillSetRef, Skill, SkillSet } from '@/lib/api/types';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const BUILTIN_SKILLS = [
  {
    name: 'sandbox-workspace-tools',
    version: 'builtin-d9f6a0bea925',
    description: '让 Agent 使用受 allowlist 保护的沙箱工作区工具。',
    source: 'builtin',
  },
];

function parseDefinition(raw: string): AgentDefinition | null {
  try {
    return JSON.parse(raw) as AgentDefinition;
  } catch {
    return null;
  }
}

function promptFromYaml(content: string): string {
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex((line) => /^instruction:\s*\|/.test(line));
  if (start < 0) return '';
  const body: string[] = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line && !/^\s/.test(line)) break;
    body.push(line.replace(/^  /, ''));
  }
  return body.join('\n').replace(/\n+$/, '');
}

function withPrompt(definition: AgentDefinition, prompt: string): AgentDefinition {
  const entryPoint = definition.entryPoint;
  const original = String(definition.files[entryPoint] || '');
  const lines = original.split(/\r?\n/);
  const start = lines.findIndex((line) => /^instruction:\s*\|/.test(line));
  if (start >= 0) {
    let end = start + 1;
    while (end < lines.length && (!lines[end] || /^\s/.test(lines[end]))) end += 1;
    lines.splice(start, end - start);
  }
  const clean = lines.join('\n').replace(/\n+$/, '');
  const nextContent = prompt.trim()
    ? `${clean}\ninstruction: |\n${prompt.trim().split(/\r?\n/).map((line) => `  ${line}`).join('\n')}\n`
    : `${clean}\n`;
  return { ...definition, files: { ...definition.files, [entryPoint]: nextContent } };
}

function setSkills(definition: AgentDefinition, skills: AgentSkillRef[]): AgentDefinition {
  return { ...definition, skills: skills.length > 0 ? skills : [] };
}

function setSkillSets(definition: AgentDefinition, sets: AgentSkillSetRef[]): AgentDefinition {
  return { ...definition, skillsets: sets.length > 0 ? sets : [] };
}

function isRunnableSkillSet(set: SkillSet): boolean {
  return Boolean(
    set.revision && set.revision > 0 && set.members?.length &&
    set.members.every((member) =>
      (!member.status || member.status === 'active') &&
      member.version && member.commitSha && member.treeSha && member.manifestSha256),
  );
}

export function AgentSkillPromptEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { data: catalogSkills = [], isLoading } = useSkills({ pageSize: 100 });
  const { data: skillSets = [], isLoading: setsLoading } = useSkillSets({ pageSize: 100 });
  const definition = useMemo(() => parseDefinition(value), [value]);
  const entryPoint = definition?.entryPoint || 'root_agent.yaml';
  const prompt = definition ? promptFromYaml(String(definition.files[entryPoint] || '')) : '';
  const selected = definition?.skills || [];
  const selectedSets = definition?.skillsets || [];

  const options = useMemo(() => [
    ...BUILTIN_SKILLS,
    ...catalogSkills
      .map((skill) => ({
        name: skill.name,
        version: skill.latestVersion || skill.stableVersion || skill.version || '',
        description: skill.description || 'Hub Skill catalog release',
        source: 'catalog',
      }))
      .filter((skill) => skill.name && skill.version),
  ], [catalogSkills]);

  const update = (next: AgentDefinition) => onChange(JSON.stringify(next, null, 2));
  const toggleSkill = (option: (typeof options)[number], checked: boolean, version = option.version) => {
    if (!definition) return;
    const next = selected.filter((item) => item.name !== option.name);
    if (checked) {
      next.push({ name: option.name, version, source: option.source, required: true });
    }
    update(setSkills(definition, next));
  };
  const toggleSkillSet = (set: SkillSet, checked: boolean) => {
    if (!definition) return;
    if (checked && !isRunnableSkillSet(set)) return;
    const next = selectedSets.filter((item) => item.name !== set.name);
    if (checked) {
      // revision is pinned at save time and resolved from Hub's immutable
      // SkillSet revision history, so later edits do not drift old Agents.
      next.push({ name: set.name, revision: set.revision ?? 0, required: true });
    }
    update(setSkillSets(definition, next));
  };

  return (
    <div className="space-y-4 rounded-lg border bg-muted/20 p-4" data-testid="agent-config-builder">
      <div>
        <Label className="text-xs">SkillSets</Label>
        <p className="mt-1 text-xs text-muted-foreground">SkillSet 是版本固定的技能集合；Agent 保存时按当前 revision 固定，运行 resolve 时展开为其全部成员 Skill（每个成员仍按目录授权校验）。</p>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          {setsLoading ? <p className="text-xs text-muted-foreground">Loading SkillSets…</p> : skillSets.map((set) => {
            const checked = selectedSets.some((item) => item.name === set.name);
            return (
              <SkillSetOption key={set.name} set={set} checked={checked} onToggle={toggleSkillSet} />
            );
          })}
          {!setsLoading && skillSets.length === 0 && (
            <p className="text-xs text-muted-foreground">暂无可用 SkillSet</p>
          )}
        </div>
      </div>
      <div>
        <Label className="text-xs">Skills</Label>
        <p className="mt-1 text-xs text-muted-foreground">选择的 Skill 会固定到 Agent 版本；runtime 挂载前会按目录授权校验（只读可见的 Catalog Skill 才能绑定）。</p>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          {isLoading ? <p className="text-xs text-muted-foreground">Loading Skills…</p> : options.map((option) => {
            const selectedBinding = selected.find((item) => item.name === option.name);
            if (option.source === 'catalog') {
              const skill = catalogSkills.find((item) => item.name === option.name);
              return skill ? (
                <CatalogSkillOption
                  key={option.name}
                  skill={skill}
                  selected={selectedBinding}
                  onToggle={(checked, version) => toggleSkill(option, checked, version)}
                />
              ) : null;
            }
            return (
              <label key={`${option.name}@${option.version}`} className="flex cursor-pointer items-start gap-2 rounded-md border bg-background p-2" data-testid={`skill-option-${option.name}`}>
                <Checkbox checked={Boolean(selectedBinding)} onCheckedChange={(next) => toggleSkill(option, next === true)} />
                <span className="min-w-0 text-xs">
                  <span className="block font-medium">{option.name}</span>
                  <span className="block font-mono text-[10px] text-muted-foreground">{option.version} · {option.source}</span>
                  <span className="mt-1 block text-muted-foreground">{option.description}</span>
                </span>
              </label>
            );
          })}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">System Prompt</Label>
        <p className="text-xs text-muted-foreground">Prompt 会写入 {entryPoint} 的 instruction 字段，Runtime 加载 Agent 时直接使用。</p>
        <Textarea
          data-testid="agent-system-prompt"
          className="min-h-[150px] text-sm"
          value={prompt}
          onChange={(event) => definition && update(withPrompt(definition, event.target.value))}
          placeholder="你是一个可靠的工作区助手……"
        />
      </div>
    </div>
  );
}

function CatalogSkillOption({
  skill,
  selected,
  onToggle,
}: {
  skill: Skill;
  selected?: AgentSkillRef;
  onToggle: (checked: boolean, version: string) => void;
}) {
  const releases = useSkillReleases(skill.name);
  const releaseTags = (releases.data ?? []).map((release) => release.tag).filter(Boolean) as string[];
  const version = selected?.version || skill.latestVersion || releaseTags[0] || '';
  const selectable = Boolean(version) && !releases.isLoading;

  return (
    <div className="rounded-md border bg-background p-2" data-testid={`skill-option-${skill.name}`}>
      <label className={`flex items-start gap-2 ${selectable ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
        <Checkbox
          disabled={!selectable}
          checked={Boolean(selected)}
          onCheckedChange={(next) => onToggle(next === true, version)}
        />
        <span className="min-w-0 flex-1 text-xs">
          <span className="block font-medium">{skill.name}</span>
          <span className="mt-1 block text-muted-foreground">{skill.description || 'Hub Skill catalog release'}</span>
        </span>
      </label>
      <Select disabled={releaseTags.length === 0} value={version} onValueChange={(next) => selected && onToggle(true, next)}>
        <SelectTrigger className="mt-2 h-7 w-full font-mono text-[10px]" aria-label={`${skill.name} Release`}>
          <SelectValue placeholder={releases.isLoading ? '加载 Release…' : '无已发布 Release'} />
        </SelectTrigger>
        <SelectContent>
          {releaseTags.map((tag) => <SelectItem key={tag} value={tag}>{tag}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function SkillSetOption({
  set,
  checked,
  onToggle,
}: {
  set: SkillSet;
  checked: boolean;
  onToggle: (set: SkillSet, checked: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { data: members = [], isLoading: membersLoading } = useSkillSetSkills(expanded ? set.name : null);
  const runnable = isRunnableSkillSet(set);

  return (
    <div className="rounded-md border bg-background p-2" data-testid={`skillset-option-${set.name}`}>
      <label className={`flex items-start gap-2 ${runnable ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
        <Checkbox disabled={!runnable} checked={checked} onCheckedChange={(next) => onToggle(set, next === true)} />
        <span className="min-w-0 flex-1 text-xs">
          <span className="block font-medium">{set.name}</span>
          <span className="block font-mono text-[10px] text-muted-foreground">
            revision {set.revision ?? '—'} · {set.members?.length ?? 0} members
          </span>
          {!runnable && <span className="block text-[10px] text-destructive">需先为全部成员固定 Release</span>}
        </span>
        <button
          type="button"
          className="text-[10px] text-muted-foreground underline-offset-2 hover:underline"
          onClick={(event) => {
            event.preventDefault();
            setExpanded((value) => !value);
          }}
        >
          {expanded ? '收起' : '展开'}
        </button>
      </label>
      {expanded && (
        <div className="mt-1.5 space-y-1 border-t pt-1.5">
          {membersLoading ? (
            <p className="px-1 text-[10px] text-muted-foreground">加载成员…</p>
          ) : members.length === 0 ? (
            <p className="px-1 text-[10px] text-muted-foreground">无成员</p>
          ) : (
            members.map((member) => (
              <p key={member.skillName} className="px-1 font-mono text-[10px] text-muted-foreground">
                {member.skillName} @ {member.version ?? '—'}
              </p>
            ))
          )}
        </div>
      )}
    </div>
  );
}
