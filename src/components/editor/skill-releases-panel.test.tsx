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

vi.mock('./skill-version-browser-dialog', () => ({
  SkillVersionBrowserDialog: ({ initialTag }: { initialTag: string }) => (
    <div>{`browser:${initialTag}`}</div>
  ),
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
      {
        tag: 'v2.0.0-beta.1',
        commitSha: '3333333333333333333333333333333333333333',
        publisherName: 'Release Owner',
        releaseNotes: 'Preview the next major version',
        createTime: '2026-07-24T11:00:00Z',
      },
      { tag: 'backup-0724' },
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
        name: 'experimental',
        fullRef: 'refs/heads/experimental',
        type: 'branch',
        isDefault: false,
        commitSha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
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
  useCompareSkillRefs: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    data: undefined,
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

  it('publishes the current draft without asking the user to select a branch', async () => {
    render(<SkillReleasesPanel skillName="search" />);

    expect(screen.getByText('当前草稿')).toBeDefined();
    expect(screen.queryByText('源分支')).toBeNull();
    expect(screen.queryByText('experimental')).toBeNull();

    fireEvent.change(screen.getByPlaceholderText('例如 1.4.2 或 1.5.0-beta.1'), {
      target: { value: '1.11.0' },
    });
    fireEvent.click(screen.getByRole('button', { name: '发布新版本' }));

    await waitFor(() => {
      expect(createRelease).toHaveBeenCalledWith({
        version: '1.11.0',
        sourceRef: 'refs/heads/main',
        expectedCommitSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        releaseNotes: undefined,
      });
    });
  });

  it('asks the user to refresh when the draft changed during publication', async () => {
    createRelease.mockRejectedValueOnce(new HubApiError(409, {
      code: 'SKILL_RELEASE_STALE',
      message: 'skill release source changed',
    }));

    render(<SkillReleasesPanel skillName="search" />);

    fireEvent.change(screen.getByPlaceholderText('例如 1.4.2 或 1.5.0-beta.1'), {
      target: { value: '1.11.0' },
    });
    fireEvent.click(screen.getByRole('button', { name: '发布新版本' }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        '发布失败：草稿已有新修改，请刷新后重新确认发布。',
      );
    });
  });

  it('classifies stable and prerelease versions and filters ordinary git tags', () => {
    render(<SkillReleasesPanel skillName="search" />);

    expect(screen.getByText('1.10.0')).toBeDefined();
    expect(screen.getByText('2.0.0-beta.1')).toBeDefined();
    expect(screen.getByText('最新稳定版')).toBeDefined();
    expect(screen.getAllByText('预发布').length).toBeGreaterThan(0);
    expect(screen.queryByText('backup-0724')).toBeNull();
    expect(screen.getByText('Improve ranking quality')).toBeDefined();
  });

  it('opens a read-only browser for the selected release', () => {
    render(<SkillReleasesPanel skillName="search" />);

    fireEvent.click(screen.getAllByRole('button', { name: '查看内容' })[0]);
    expect(screen.getByText('browser:v2.0.0-beta.1')).toBeDefined();
  });
});
