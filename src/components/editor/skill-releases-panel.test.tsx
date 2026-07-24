import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HubApiError } from '@/lib/api/hub-fetch';

import { SkillReleasesPanel } from './skill-releases-panel';

const createRelease = vi.fn();
const refetch = vi.fn().mockResolvedValue({});

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
  TabsContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/hooks/use-skill-releases', () => ({
  useSkillReleases: () => ({
    data: [
      {
        tag: 'v1.10.0',
        commitSha: '1111111111111111111111111111111111111111',
        treeSha: '2222222222222222222222222222222222222222',
        manifestSha256: 'manifest-sha-256',
        publisherName: 'Release Owner',
        releaseNotes: 'Improve ranking quality',
        sourceRef: 'refs/heads/main',
        createTime: '2026-07-24T10:00:00Z',
      },
    ],
    isLoading: false,
    isFetching: false,
    refetch,
  }),
  useSkillRefs: () => ({
    data: [
      {
        name: 'main',
        fullRef: 'refs/heads/main',
        type: 'branch',
        isDefault: true,
        commitSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      },
      {
        name: 'v1.10.0',
        fullRef: 'refs/tags/v1.10.0',
        type: 'tag',
        commitSha: '1111111111111111111111111111111111111111',
      },
    ],
    isLoading: false,
    refetch,
  }),
  useSkillCommits: () => ({
    data: [],
    isLoading: false,
    refetch,
  }),
  useCreateSkillRelease: () => ({
    mutateAsync: createRelease,
    isPending: false,
  }),
  useResolveSkillRelease: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useCompareSkillRefs: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useRestoreSkillRef: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

describe('SkillReleasesPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    refetch.mockResolvedValue({});
    createRelease.mockResolvedValue({
      tag: 'v1.11.0',
      commitSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    });
  });

  // TC-FE-019
  it('publishes with the current default branch HEAD instead of manual SHA input', async () => {
    render(<SkillReleasesPanel skillName="search" />);

    expect(
      screen.getByText('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
    ).toBeDefined();
    expect(screen.queryByPlaceholderText('发布前确认的精确 commit SHA')).toBeNull();

    fireEvent.change(screen.getByPlaceholderText('例如 1.0.0 或 v1.0.0'), {
      target: { value: '1.11.0' },
    });
    fireEvent.click(screen.getByRole('button', { name: '发布不可变版本' }));

    await waitFor(() => {
      expect(createRelease).toHaveBeenCalledWith({
        version: '1.11.0',
        sourceRef: 'refs/heads/main',
        expectedCommitSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        releaseNotes: undefined,
      });
    });
  });

  it('asks the user to refresh when the selected branch HEAD became stale', async () => {
    createRelease.mockRejectedValueOnce(new HubApiError(409, {
      code: 'SKILL_RELEASE_STALE',
      message: 'skill release source changed',
    }));

    render(<SkillReleasesPanel skillName="search" />);

    fireEvent.change(screen.getByPlaceholderText('例如 1.0.0 或 v1.0.0'), {
      target: { value: '1.11.0' },
    });
    fireEvent.click(screen.getByRole('button', { name: '发布不可变版本' }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        '发布失败：源分支已有新提交，请刷新分支后重新确认发布。',
      );
    });
  });

  // TC-FE-020
  it('renders release provenance and integrity metadata', async () => {
    render(<SkillReleasesPanel skillName="search" />);

    await waitFor(() => {
      expect(screen.getByText('v1.10.0')).toBeDefined();
      expect(screen.getByText('Improve ranking quality')).toBeDefined();
      expect(screen.getByText(/Release Owner/)).toBeDefined();
      expect(screen.getByText(/commit 1111111111 · tree 2222222222/)).toBeDefined();
      expect(screen.getByText(/manifest manifest-sha-256/)).toBeDefined();
      expect(screen.getByText('refs/heads/main')).toBeDefined();
    });
  });
});
