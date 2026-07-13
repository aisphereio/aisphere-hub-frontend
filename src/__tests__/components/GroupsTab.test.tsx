import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GroupsTab } from '@/components/pages/iam-page';

// Mock external dependencies
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('lucide-react')>();
  // Return all actual exports, but override specific ones that cause issues
  return { ...actual };
});

// Mock all hooks used by GroupsTab
const mockUseIamDirectoryGroups = vi.fn();
const mockUseIamCreateGroup = vi.fn();
const mockUseIamUpdateGroup = vi.fn();
const mockUseIamDeleteGroup = vi.fn();
const mockUseIamAssignUserToGroup = vi.fn();
const mockUseIamRemoveUserFromGroup = vi.fn();

vi.mock('@/hooks/use-iam', () => ({
  useIamDirectoryGroups: (...args: unknown[]) => mockUseIamDirectoryGroups(...args),
  useIamCreateGroup: () => mockUseIamCreateGroup(),
  useIamUpdateGroup: () => mockUseIamUpdateGroup(),
  useIamDeleteGroup: () => mockUseIamDeleteGroup(),
  useIamAssignUserToGroup: () => mockUseIamAssignUserToGroup(),
  useIamRemoveUserFromGroup: () => mockUseIamRemoveUserFromGroup(),
}));

const mockGroups = [
  { id: 'group-1', name: 'engineering', displayName: 'Engineering', type: 'group', users: ['alice', 'bob'] },
  { id: 'group-2', name: 'design', displayName: 'Design Team', type: 'folder', users: ['charlie'] },
  { id: 'group-3', name: 'product', displayName: 'Product', type: 'group', users: [] },
];

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('GroupsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseIamDirectoryGroups.mockReturnValue({ data: { groups: mockGroups }, isLoading: false, refetch: vi.fn() });
    mockUseIamCreateGroup.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false });
    mockUseIamUpdateGroup.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false });
    mockUseIamDeleteGroup.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false });
    mockUseIamAssignUserToGroup.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false });
    mockUseIamRemoveUserFromGroup.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false });
  });

  // TC-FE-001: Group list renders groups from API
  it('renders group list with data from API', async () => {
    renderWithProviders(<GroupsTab />);

    await waitFor(() => {
      expect(screen.getByText('engineering')).toBeDefined();
      expect(screen.getByText('design')).toBeDefined();
      expect(screen.getByText('product')).toBeDefined();
    });
  });

  // TC-FE-002: Loading skeleton
  it('shows loading skeleton while fetching', () => {
    mockUseIamDirectoryGroups.mockReturnValue({ data: null, isLoading: true, refetch: vi.fn() });

    const { container } = renderWithProviders(<GroupsTab />);
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  // TC-FE-003: Empty state
  it('shows empty state when no groups', () => {
    mockUseIamDirectoryGroups.mockReturnValue({ data: { groups: [] }, isLoading: false, refetch: vi.fn() });

    renderWithProviders(<GroupsTab />);
    expect(screen.getByText('No groups found')).toBeDefined();
  });

  // TC-FE-004: Search filters
  it('filters groups by search input', async () => {
    renderWithProviders(<GroupsTab />);

    const searchInput = screen.getByPlaceholderText('Search groups...');
    fireEvent.change(searchInput, { target: { value: 'eng' } });

    await waitFor(() => {
      expect(screen.getByText('engineering')).toBeDefined();
      expect(screen.queryByText('design')).toBeNull();
    });
  });

  // TC-FE-005: Create dialog opens
  it('opens create dialog on button click', async () => {
    renderWithProviders(<GroupsTab />);

    fireEvent.click(screen.getByText('Create Group'));

    await waitFor(() => {
      expect(screen.getByText('Create a new group in the organization')).toBeDefined();
    });
  });

  // TC-FE-006: Create group submits correct API
  it('calls create mutation with correct params', async () => {
    const createMutate = vi.fn().mockResolvedValue({});
    mockUseIamCreateGroup.mockReturnValue({ mutateAsync: createMutate, isPending: false });

    renderWithProviders(<GroupsTab />);

    fireEvent.click(screen.getByText('Create Group'));

    const nameInput = screen.getByPlaceholderText('my-group');
    const displayNameInput = screen.getByPlaceholderText('My Group');
    fireEvent.change(nameInput, { target: { value: 'test-group' } });
    fireEvent.change(displayNameInput, { target: { value: 'Test Group' } });

    fireEvent.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(createMutate).toHaveBeenCalledWith({
        orgId: 'aisphere',
        group: { name: 'test-group', displayName: 'Test Group', type: 'folder', parentId: undefined },
      });
    });
  });

  // TC-FE-007: Delete group
  it('calls delete mutation when delete button clicked', async () => {
    const deleteMutate = vi.fn().mockResolvedValue({});
    mockUseIamDeleteGroup.mockReturnValue({ mutateAsync: deleteMutate, isPending: false });

    renderWithProviders(<GroupsTab />);

    // Find the trash icon button in the table (not in dialog)
    const trashButtons = screen.getAllByRole('button').filter(b =>
      b.innerHTML.includes('lucide-trash2')
    );
    expect(trashButtons.length).toBeGreaterThan(0);
    fireEvent.click(trashButtons[0]);

    await waitFor(() => {
      expect(deleteMutate).toHaveBeenCalledWith({ orgId: 'aisphere', groupId: 'group-1' });
    });
  });

  // TC-FE-008: Assign member
  it('calls assign mutation when adding member', async () => {
    const assignMutate = vi.fn().mockResolvedValue({});
    mockUseIamAssignUserToGroup.mockReturnValue({ mutateAsync: assignMutate, isPending: false });

    renderWithProviders(<GroupsTab />);

    // Click on group row to open member panel
    fireEvent.click(screen.getByText('engineering'));

    await waitFor(() => {
      const userInput = screen.getByPlaceholderText('User ID...');
      fireEvent.change(userInput, { target: { value: 'dave' } });
    });

    fireEvent.click(screen.getByText('Add'));

    await waitFor(() => {
      expect(assignMutate).toHaveBeenCalledWith({
        orgId: 'aisphere',
        groupId: 'group-1',
        userId: 'dave',
      });
    });
  });
});