import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SkillsPage } from './skills-page';

const mockUseSkills = vi.fn();
const mockLifecycle = vi.fn();
const mockDelete = vi.fn();

vi.mock('@/hooks/use-skills', () => ({
  useSkills: (...args: unknown[]) => mockUseSkills(...args),
  useSkillLifecycle: () => ({ mutateAsync: mockLifecycle }),
  useSkillDelete: () => ({ mutateAsync: mockDelete }),
}));

vi.mock('@/components/layout/app-shell', () => ({ useOpenSkillEditor: () => vi.fn() }));
vi.mock('@/lib/i18n', () => ({ useT: () => (key: string) => key }));
vi.mock('@/components/shared', () => ({
  StatCard: () => null,
  CardGridSkeleton: () => null,
  EmptyState: () => null,
  ConfirmDialog: ({ open, onConfirm }: { open: boolean; onConfirm: () => void }) =>
    open ? <button onClick={onConfirm}>confirm-action</button> : null,
}));
vi.mock('@/components/skills', () => ({
  SkillCard: ({ skill, onAction }: { skill: { name: string }; onAction: (action: string, skill: { name: string }) => void }) => (
    <div>
      <button onClick={() => onAction('disable', skill)}>disable-skill</button>
      <button onClick={() => onAction('archive', skill)}>archive-skill</button>
      <button onClick={() => onAction('activate', skill)}>activate-skill</button>
      <button onClick={() => onAction('delete', skill)}>delete-skill</button>
    </div>
  ),
  SkillCardCompact: () => null,
  SkillCreateDialog: () => null,
  SkillShareDialog: () => null,
  SkillFilters: () => null,
}));

describe('SkillsPage lifecycle management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSkills.mockReturnValue({
      data: [{ name: 'release-notes', status: 'active', visibility: 'private' }],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    mockLifecycle.mockResolvedValue({});
    mockDelete.mockResolvedValue('');
  });

  it('lists inactive assets and sends explicit lifecycle transitions', async () => {
    render(<SkillsPage />);
    expect(mockUseSkills.mock.calls[0][0]).toMatchObject({ includeInactive: true });

    fireEvent.click(screen.getByText('disable-skill'));
    fireEvent.click(screen.getByText('confirm-action'));
    await waitFor(() => expect(mockLifecycle).toHaveBeenLastCalledWith({
      skillName: 'release-notes', status: 'disabled',
    }));

    fireEvent.click(screen.getByText('archive-skill'));
    fireEvent.click(screen.getByText('confirm-action'));
    await waitFor(() => expect(mockLifecycle).toHaveBeenLastCalledWith({
      skillName: 'release-notes', status: 'archived',
    }));

    fireEvent.click(screen.getByText('activate-skill'));
    fireEvent.click(screen.getByText('confirm-action'));
    await waitFor(() => expect(mockLifecycle).toHaveBeenLastCalledWith({
      skillName: 'release-notes', status: 'active',
    }));
  });

  it('keeps deletion on its separate destructive mutation', async () => {
    render(<SkillsPage />);
    fireEvent.click(screen.getByText('delete-skill'));
    fireEvent.click(screen.getByText('confirm-action'));
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('release-notes'));
    expect(mockLifecycle).not.toHaveBeenCalled();
  });
});
