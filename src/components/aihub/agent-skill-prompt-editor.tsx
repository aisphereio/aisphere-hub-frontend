'use client';

import { useMemo } from 'react';
import { useSkills } from '@/hooks/use-skills';
import { useSkillSets } from '@/hooks/use-skillsets';
import type { AgentDefinition, AgentSkillRef } from '@/lib/api/types';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type AgentSkillSetBinding = {
  name: string;
  revision: number;
  required?: boolean;
};

type AgentDefinitionWithExactSkillSets = Omit<AgentDefinition, 'skillSets'> & {
  skillSets?: AgentSkillSetBinding[];
};

const BUILTIN_SKILLS = [
  {
    name: 'sandbox-workspace-tools',
    version: 'builtin-d9f6a0bea925',
    description: '让 Agent 使用受 allowlist 保护的沙箱工作区工具。',
    source: 'builtin',
  },
];

function parseDefinition(raw: string): AgentDefinitionWithExactSkillSets | null {
  try {
    return JSON.parse(raw) as AgentDefinitionWithExactSkillSets;
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

function withPrompt(definition: AgentDefinitionWithExactSkillSets, prompt: string): AgentDefinitionWithExactSkillSets {
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

function setSkills(definition: AgentDefinitionWithExactSkillSets, skills: AgentSkillRef[]): AgentDefinitionWithExactSkillSets {
  return { ...definition, skills: skills.length > 0 ? skills : [] };
}

function setSkillSets(
  definition: AgentDefinitionWithExactSkillSets,
  skillSets: AgentSkillSetBinding[],
): AgentDefinitionWithExactSkillSets {
  return { ...definition, skillSets: skillSets.length > 0 ? skillSets : [] };
}

export function AgentSkillPromptEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { data: catalogSkills = [], isLoading: skillsLoading } = useSkills({ pageSize: 100 });
  const { data: catalogSkillSets = [], isLoading: skillSetsLoading } = useSkillSets({ pageSize: 100 });
  const definition = useMemo(() => parseDefinition(value), [value]);
  const entryPoint = definition?.entryPoint || 'root_agent.yaml';
  const prompt = definition ? promptFromYaml(String(definition.files[entryPoint] || '')) : '';
  const selected = definition?.skills || [];
  const selectedSkillSets = definition?.skillSets || [];

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

  const skillSetOptions = useMemo(() => catalogSkillSets
    .map((skillSet) => ({
      name: skillSet.name,
      revision: Number(skillSet.revision || 0),
      description: skillSet.description || 'Hub SkillSet',
      memberCount: skillSet.members?.length || 0,
    }))
    .filter((skillSet) => skillSet.name && skillSet.revision > 0), [catalogSkillSets]);

  const update = (next: AgentDefinitionWithExactSkillSets) => onChange(JSON.stringify(next, null, 2));
  const toggleSkill = (option: (typeof options)[number], checked: boolean) => {
    if (!definition) return;
    const next = selected.filter((item) => item.name !== option.name);
    if (checked) {
      next.push({ name: option.name, version: option.version, source: option.source, required: true });
    }
    update(setSkills(definition, next));
  };
  const toggleSkillSet = (option: (typeof skillSetOptions)[number], checked: boolean) => {
    if (!definition) return;
    const next = selectedSkillSets.filter((item) => item.name !== option.name);
    if (checked) {
      next.push({ name: option.name, revision: option.revision, required: true });
    }
    update(setSkillSets(definition, next));
  };

  return (
    <div className="space-y-4 rounded-lg border bg-muted/20 p-4" data-testid="agent-config-builder">
      <div>
        <Label className="text-xs">Skills</Label>
        <p className="mt-1 text-xs text-muted-foreground">选择的 Skill 会固定到正式发布版本；Runtime Resolve 时再次做可见性、生命周期和 release 校验。</p>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          {skillsLoading ? <p className="text-xs text-muted-foreground">Loading Skills…</p> : options.map((option) => {
            const checked = selected.some((item) => item.name === option.name);
            return (
              <label key={`${option.name}@${option.version}`} className="flex cursor-pointer items-start gap-2 rounded-md border bg-background p-2" data-testid={`skill-option-${option.name}`}>
                <Checkbox checked={checked} onCheckedChange={(next) => toggleSkill(option, next === true)} />
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

      <div>
        <Label className="text-xs">SkillSets</Label>
        <p className="mt-1 text-xs text-muted-foreground">绑定时固定当前 revision。以后 SkillSet 增删成员不会让已保存的 Agent 版本漂移。</p>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          {skillSetsLoading ? <p className="text-xs text-muted-foreground">Loading SkillSets…</p> : skillSetOptions.map((option) => {
            const selectedBinding = selectedSkillSets.find((item) => item.name === option.name);
            const checked = Boolean(selectedBinding);
            return (
              <label key={`${option.name}@${option.revision}`} className="flex cursor-pointer items-start gap-2 rounded-md border bg-background p-2" data-testid={`skillset-option-${option.name}`}>
                <Checkbox checked={checked} onCheckedChange={(next) => toggleSkillSet(option, next === true)} />
                <span className="min-w-0 text-xs">
                  <span className="block font-medium">{option.name}</span>
                  <span className="block font-mono text-[10px] text-muted-foreground">
                    revision {selectedBinding?.revision || option.revision} · {option.memberCount} skills
                  </span>
                  <span className="mt-1 block text-muted-foreground">{option.description}</span>
                  {selectedBinding && selectedBinding.revision !== option.revision ? (
                    <span className="mt-1 block text-amber-600">已固定 revision {selectedBinding.revision}；当前 SkillSet 已更新到 revision {option.revision}。</span>
                  ) : null}
                </span>
              </label>
            );
          })}
          {!skillSetsLoading && skillSetOptions.length === 0 ? (
            <p className="text-xs text-muted-foreground">暂无可绑定的 SkillSet。</p>
          ) : null}
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
