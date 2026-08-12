import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AgentSkillPromptEditor } from './agent-skill-prompt-editor';

const mockUseSkills = vi.fn();
const mockUseSkillReleases = vi.fn();
const mockUseSkillSets = vi.fn();
const mockUseSkillSetSkills = vi.fn();

vi.mock('@/hooks/use-skills', () => ({
  useSkills: (...args: unknown[]) => mockUseSkills(...args),
}));

vi.mock('@/hooks/use-skill-releases', () => ({
  useSkillReleases: (...args: unknown[]) => mockUseSkillReleases(...args),
}));

vi.mock('@/hooks/use-skillsets', () => ({
  useSkillSets: (...args: unknown[]) => mockUseSkillSets(...args),
  useSkillSetSkills: (...args: unknown[]) => mockUseSkillSetSkills(...args),
}));

const definition = JSON.stringify({
  entryPoint: 'root_agent.yaml',
  files: { 'root_agent.yaml': 'name: test-agent\n' },
  skills: [],
  skillsets: [],
});

describe('AgentSkillPromptEditor', () => {
  beforeEach(() => {
    mockUseSkills.mockReturnValue({
      data: [{
        name: 'release-notes',
        description: 'Summarize a release',
        latestVersion: 'v1.2.0',
      }],
      isLoading: false,
    });
    mockUseSkillReleases.mockReturnValue({
      data: [{ tag: 'v1.2.0' }, { tag: 'v1.1.0' }],
      isLoading: false,
    });
    mockUseSkillSets.mockReturnValue({
      data: [{
        name: 'release-workflow',
        revision: 3,
        members: [{
          skillName: 'release-notes',
          status: 'active',
          version: 'v1.2.0',
          commitSha: 'commit-sha',
          treeSha: 'tree-sha',
          manifestSha256: 'manifest-sha',
        }],
      }, {
        name: 'unresolved-set',
        revision: 1,
        members: [{ skillName: 'draft-only' }],
      }, {
        name: 'archived-member-set',
        revision: 2,
        members: [{
          skillName: 'old-release-notes',
          status: 'archived',
          version: 'v1.0.0',
          commitSha: 'commit-sha',
          treeSha: 'tree-sha',
          manifestSha256: 'manifest-sha',
        }],
      }],
      isLoading: false,
    });
    mockUseSkillSetSkills.mockReturnValue({ data: [], isLoading: false });
  });

  it('pins a catalog Skill to an exact published release', () => {
    const onChange = vi.fn();
    render(<AgentSkillPromptEditor value={definition} onChange={onChange} />);

    const option = screen.getByTestId('skill-option-release-notes');
    fireEvent.click(within(option).getByRole('checkbox'));

    const saved = JSON.parse(onChange.mock.calls.at(-1)?.[0]);
    expect(saved.skills).toEqual([{
      name: 'release-notes',
      version: 'v1.2.0',
      source: 'catalog',
      required: true,
    }]);
  });

  it('writes the canonical skillsets field and blocks unresolved sets', () => {
    const onChange = vi.fn();
    render(<AgentSkillPromptEditor value={definition} onChange={onChange} />);

    const valid = screen.getByTestId('skillset-option-release-workflow');
    const invalid = screen.getByTestId('skillset-option-unresolved-set');
    const archived = screen.getByTestId('skillset-option-archived-member-set');
    expect(within(invalid).getByRole('checkbox')).toBeDisabled();
    expect(within(archived).getByRole('checkbox')).toBeDisabled();
    fireEvent.click(within(valid).getByRole('checkbox'));

    const saved = JSON.parse(onChange.mock.calls.at(-1)?.[0]);
    expect(saved.skillsets).toEqual([{ name: 'release-workflow', revision: 3, required: true }]);
    expect(saved).not.toHaveProperty('skillSets');
  });
});
