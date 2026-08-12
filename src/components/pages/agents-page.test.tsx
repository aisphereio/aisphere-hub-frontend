import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CompatibilityWarnings } from './agents-page';

describe('CompatibilityWarnings', () => {
  it('shows missing tools and states that no permission was granted', () => {
    render(<CompatibilityWarnings warnings={[{
      code: 'SKILL_TOOL_COMPATIBILITY_MISSING',
      skill: 'k8s-debug',
      missingTools: ['k8s.logs'],
      message: 'Skill k8s-debug may not function completely',
    }]} />);

    expect(screen.getByTestId('agent-compatibility-warnings')).toHaveTextContent('Missing: k8s.logs');
    expect(screen.getByTestId('agent-compatibility-warnings')).toHaveTextContent('did not add or grant any Tool');
  });
});
