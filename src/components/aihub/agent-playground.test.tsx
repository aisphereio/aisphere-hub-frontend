import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

import { AgentPlayground } from '@/components/aihub/agent-playground';
import type { RuntimeEvent } from '@/lib/api/runtime';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('lucide-react')>();
  return { ...actual };
});

const mockUseMe = vi.fn();
const mockPlanRun = vi.fn();
const mockGetSession = vi.fn();
const mockRuntimeRun = vi.fn();
const mockRunAgentStream = vi.fn();

vi.mock('@/hooks/use-auth', () => ({
  useMe: () => mockUseMe(),
}));

vi.mock('@/hooks/use-agents', () => ({
  useAgentRunPlan: () => mockPlanRun(),
}));

vi.mock('@/lib/api/runtime', () => ({
  agentRuntimeApi: {
    getSession: (...args: unknown[]) => mockGetSession(...args),
    run: (...args: unknown[]) => mockRuntimeRun(...args),
    createSession: vi.fn(),
    listSessions: vi.fn(),
    deleteSession: vi.fn(),
  },
  runAgentStream: (...args: unknown[]) => mockRunAgentStream(...args),
  createRuntimeSessionWithRetry: vi.fn().mockResolvedValue(undefined),
}));

type StreamHandlers = {
  onEvent: (event: RuntimeEvent) => void;
  onMetadata?: () => void;
  onDone?: () => void;
};

/** mock 会话历史 + 捕获 runAgentStream 的 handlers，便于测试手动注入流式事件。 */
function setup({ events }: { events: RuntimeEvent[] }) {
  mockGetSession.mockResolvedValue({ id: 'sess-1', appName: 'ag-1', userId: 'user-1', events });
  let streamHandlers: StreamHandlers | undefined;
  mockRunAgentStream.mockImplementation(async (_input: unknown, handlers: StreamHandlers) => {
    streamHandlers = handlers;
  });
  const emit = (event: RuntimeEvent) => act(() => streamHandlers?.onEvent(event));
  return { emit, getHandlers: () => streamHandlers };
}

function renderPlayground() {
  return render(<AgentPlayground agentId="ag-1" agentVersion="v1.0.0" sessionId="sess-1" />);
}

async function sendMessage(text: string) {
  fireEvent.change(screen.getByTestId('playground-input'), { target: { value: text } });
  fireEvent.click(screen.getByTestId('playground-send'));
}

describe('AgentPlayground', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMe.mockReturnValue({ data: { subjectId: 'user-1' } });
    mockPlanRun.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue({ tools: [] }) });
    mockGetSession.mockResolvedValue({ id: 'sess-1', appName: 'ag-1', userId: 'user-1', events: [] });
    mockRunAgentStream.mockResolvedValue(undefined);
  });

  it('renders history from getSession when mounted (no remount clears it)', async () => {
    setup({
      events: [
        { author: 'user', content: { role: 'user', parts: [{ text: '你好' }] } },
        { author: 'model', content: { role: 'model', parts: [{ text: '回复：历史内容' }] } },
      ],
    });
    renderPlayground();

    await waitFor(() => {
      expect(screen.getByText('你好')).toBeDefined();
      expect(screen.getByText('回复：历史内容')).toBeDefined();
    });
    expect(mockGetSession).toHaveBeenCalledWith('ag-1', 'user-1', 'sess-1');
  });

  it('streams assistant text incrementally via runAgentStream onEvent', async () => {
    const { emit } = setup({ events: [] });
    renderPlayground();

    await sendMessage('讲个故事');

    await waitFor(() => {
      expect(mockRunAgentStream).toHaveBeenCalled();
    });

    emit({ author: 'model', content: { role: 'model', parts: [{ text: '山' }] }, invocationId: 'inv-1', partial: true });
    await waitFor(() => {
      expect(screen.getByText('山')).toBeDefined();
    });

    emit({ author: 'model', content: { role: 'model', parts: [{ text: '顶上' }] }, invocationId: 'inv-1', partial: true });
    await waitFor(() => {
      expect(screen.getByText('山顶上')).toBeDefined();
    });
  });

  it('falls back to the non-stream run() when SSE fails', async () => {
    mockRunAgentStream.mockRejectedValue(new Error('stream down'));
    mockRuntimeRun.mockResolvedValue([
      { author: 'model', content: { role: 'model', parts: [{ text: '降级回复' }] } },
    ]);
    renderPlayground();

    await sendMessage('再问');

    await waitFor(() => {
      expect(mockRuntimeRun).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByText('降级回复')).toBeDefined();
    });
  });

  it('shows tool call and tool result as structured cards, not raw JSON text', async () => {
    const { emit } = setup({ events: [] });
    renderPlayground();

    await sendMessage('用工具');

    await waitFor(() => {
      expect(mockRunAgentStream).toHaveBeenCalled();
    });

    emit({
      author: 'model',
      content: {
        role: 'model',
        parts: [{ functionCall: { name: 'sandbox_workspace_tools', args: { op: 'list' } } }],
      },
      invocationId: 'inv-2',
    });
    emit({
      author: 'tool',
      content: {
        role: 'tool',
        parts: [{ functionResponse: { name: 'sandbox_workspace_tools', response: { files: ['a.txt'] } } }],
      },
      invocationId: 'inv-2',
    });

    await waitFor(() => {
      expect(screen.getAllByText('sandbox_workspace_tools', { exact: false }).length).toBeGreaterThan(0);
    });
    // 原始 JSON 不应作为正文文本出现
    expect(screen.queryByText('Tool call:', { exact: false })).toBeNull();
  });
});