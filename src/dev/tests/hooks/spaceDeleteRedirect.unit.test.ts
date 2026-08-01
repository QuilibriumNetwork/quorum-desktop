import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

/**
 * Deleting or leaving a Space must land the user on the Spaces list.
 *
 * Both call sites used to navigate into the DM/contacts list instead: the leave
 * flow went to '/messages' directly, and the settings-modal delete went to '/',
 * which the router redirects to '/messages'. The destination is a bare string in
 * each hook, so nothing but a test stops it drifting back.
 */

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  deleteSpace: vi.fn().mockResolvedValue(undefined),
  getConfig: vi.fn().mockResolvedValue({ spaceTagId: undefined }),
  enqueue: vi.fn().mockResolvedValue(undefined),
  updateUserProfile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('react-router', () => ({
  useNavigate: () => mocks.navigate,
}));

vi.mock('@quilibrium/quilibrium-js-sdk-channels', () => ({
  usePasskeysContext: () => ({
    currentPasskeyInfo: { address: 'user-address', displayName: 'Tester' },
  }),
}));

vi.mock('@quilibrium/quorum-shared', () => ({
  useTwoStepConfirm: () => ({
    confirmationStep: 'idle',
    armOrConfirm: (run: () => void) => run(),
    resetConfirmation: vi.fn(),
  }),
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/components/context/useMessageDB', () => ({
  useMessageDB: () => ({
    deleteSpace: mocks.deleteSpace,
    getConfig: mocks.getConfig,
    actionQueueService: { enqueue: mocks.enqueue },
    updateUserProfile: mocks.updateUserProfile,
    messageDB: {},
  }),
}));

vi.mock('@/components/context/useRegistrationContext', () => ({
  useRegistrationContext: () => ({
    keyset: { userKeyset: { user_key: {} } },
  }),
}));

vi.mock('@/hooks/queries', () => ({
  useSpace: () => ({ data: null }),
  buildSpaceKey: ({ spaceId }: { spaceId: string }) => ['Space', spaceId],
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn(), setQueryData: vi.fn() }),
}));

import { useSpaceLeaving } from '@/hooks/business/spaces/useSpaceLeaving';
import { useSpaceManagement } from '@/hooks/business/spaces/useSpaceManagement';

const SPACE_ID = 'space-to-remove';

describe('Space removal redirects to the Spaces list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.deleteSpace.mockResolvedValue(undefined);
    mocks.getConfig.mockResolvedValue({ spaceTagId: undefined });
  });

  it('leaving a Space navigates to /spaces, not the DM list', async () => {
    const { result } = renderHook(() => useSpaceLeaving());

    await act(async () => {
      await result.current.leaveSpace(SPACE_ID);
    });

    expect(mocks.deleteSpace).toHaveBeenCalledWith(SPACE_ID);
    expect(mocks.navigate).toHaveBeenCalledWith('/spaces');
  });

  it('deleting a Space from settings navigates to /spaces, not / (which redirects to the DM list)', async () => {
    const { result } = renderHook(() =>
      useSpaceManagement({ spaceId: SPACE_ID })
    );

    await act(async () => {
      await result.current.handleDeleteSpace();
    });

    expect(mocks.deleteSpace).toHaveBeenCalledWith(SPACE_ID);
    expect(mocks.navigate).toHaveBeenCalledWith('/spaces');
  });

  it('does not navigate when the delete itself fails', async () => {
    mocks.deleteSpace.mockRejectedValue(new Error('hub unreachable'));
    const { result } = renderHook(() => useSpaceLeaving());

    await act(async () => {
      await result.current.leaveSpace(SPACE_ID);
    });

    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(result.current.error).toBe('hub unreachable');
  });
});
