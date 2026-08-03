'use client';

import { useMemo } from 'react';
import { useSkills } from '@/hooks/use-skills';
import type { AgentDefinition, AgentSkillRef } from '@/lib/api/types';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
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

export function AgentSkillPromptEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { data: catalogSkills = [], isLoading } = useSkills({ pageSize: 100 });
  const definition = useMemo(() => parseDefinition(value), [value]);
  const entryPoint = definition?.entryPoint || 'root_agent.yaml';
  const prompt = definition ? promptFromYaml(String(definition.files[entryPoint] || '')) : '';
  const selected = definition?.skills || [];

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
  const toggleSkill = (option: (typeof options)[number], checked: boolean) => {
    if (!definition) return;
    const next = selected.filter((item) => item.name !== option.name);
    if (checked) {
      next.push({ name: option.name, version: option.version, source: option.source, required: true });
    }
    update(setSkills(definition, next));
  };

  return (
    <div className="space-y-4 rounded-lg border bg-muted/20 p-4" data-testid="agent-config-builder">
      <div>
        <Label className="text-xs">Skills</Label>
        <p className="mt-1 text-xs text-muted-foreground">选择的 Skill 会固定到 Agent 版本，并在 Runtime 启动时挂载到上下文。当前可运行闭环开放 builtin Skill；Catalog Skill 等下载契约接通后再启用。</p>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          {isLoading ? <p className="text-xs text-muted-foreground">Loading Skills…</p> : options.map((option) => {
            const checked = selected.some((item) => item.name === option.name);
            return (
              <label key={`${option.name}@${option.version}`} className={`flex items-start gap-2 rounded-md border bg-background p-2 ${option.source === 'builtin' ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`} data-testid={`skill-option-${option.name}`}>
                <Checkbox disabled={option.source !== 'builtin'} checked={checked} onCheckedChange={(next) => toggleSkill(option, next === true)} />
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
