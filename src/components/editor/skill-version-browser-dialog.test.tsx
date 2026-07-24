import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SkillVersionBrowserDialog } from './skill-version-browser-dialog';

const useFileTree = vi.fn((..._args: unknown[]) => ({
  data: [
    { name: 'docs', path: 'docs', type: 'dir' },
    { name: 'README.md', path: 'README.md', type: 'file' },
    { name: 'SKILL.md', path: 'SKILL.md', type: 'file' },
  ],
  isLoading: false,
}));
const useFileContent = vi.fn((..._args: unknown[]) => ({
  data: { content: '# release content', sha: 'release-file-sha' },
  isLoading: false,
  isError: false,
}));

vi.stubGlobal('ResizeObserver', class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
});

Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
  configurable: true,
  value: () => ({
    x: 0,
    y: 48,
    top: 48,
    left: 0,
    right: 960,
    bottom: 768,
    width: 960,
    height: 720,
    toJSON: () => ({}),
  }),
});

vi.mock('@/hooks/use-skill-files', () => ({
  useFileTree: (...args: unknown[]) => useFileTree(...args),
  useFileContent: (...args: unknown[]) => useFileContent(...args),
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children, ...props }: React.HTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>{children}</button>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('./monaco-skill-editor', () => ({
  MonacoSkillEditor: ({ branch, filePath, readOnly }: {
    branch: string;
    filePath: string;
    readOnly?: boolean;
  }) => <div>{`monaco:${branch}:${filePath}:${readOnly ? 'readonly' : 'editable'}`}</div>,
}));

const releases = [
  {
    tag: 'v1.0.0',
    commitSha: '1111111111111111111111111111111111111111',
  },
  {
    tag: 'v1.1.0-beta.1',
    commitSha: '2222222222222222222222222222222222222222',
  },
];

function renderInSkillEditor(onOpenChange = vi.fn()) {
  const result = render(
    <div className="flex h-full flex-col">
      <header>Skill header</header>
      <div className="flex min-h-0 flex-1">
        <div data-testid="main-editor-pane">draft editor remains mounted</div>
        <aside>
          <SkillVersionBrowserDialog
            skillName="search"
            releases={releases}
            initialTag="v1.0.0"
            open
            onOpenChange={onOpenChange}
          />
        </aside>
      </div>
    </div>,
  );
  return { ...result, onOpenChange };
}

describe('SkillVersionBrowserDialog inline workspace', () => {
  it('aligns a non-dialog release preview with the primary editor pane', async () => {
    renderInSkillEditor();

    const preview = await screen.findByTestId('skill-version-inline-preview');
    expect(preview.style.top).toBe('48px');
    expect(preview.style.left).toBe('0px');
    expect(preview.style.width).toBe('960px');
    expect(preview.style.height).toBe('720px');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('已发布版本预览')).toBeDefined();
    expect(screen.getByText('monaco:refs/tags/v1.0.0:SKILL.md:readonly')).toBeDefined();
    expect(useFileTree).toHaveBeenLastCalledWith(
      'search',
      '',
      'refs/tags/v1.0.0',
      { enabled: true },
    );
    expect(screen.getByText('draft editor remains mounted')).toBeDefined();
  });

  it('switches files in the same workspace and returns to the preserved draft', async () => {
    const onOpenChange = vi.fn();
    renderInSkillEditor(onOpenChange);

    await screen.findByText('已发布版本预览');

    fireEvent.click(screen.getByRole('button', { name: 'README.md' }));
    await waitFor(() => {
      expect(useFileContent).toHaveBeenLastCalledWith(
        'search',
        'README.md',
        'refs/tags/v1.0.0',
        { enabled: true },
      );
    });

    fireEvent.click(screen.getByRole('button', { name: '返回草稿' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.getByText('draft editor remains mounted')).toBeDefined();
  });
});
