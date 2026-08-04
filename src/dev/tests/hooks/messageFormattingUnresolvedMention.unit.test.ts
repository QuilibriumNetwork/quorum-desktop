import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';

/**
 * `mapSenderToUser` is typed `(senderId: string) => any`, and callers do return
 * undefined for a sender they cannot resolve — GlobalNotificationsModal passed
 * `() => undefined` outright. `processTextToken` dereferenced the result bare,
 * so a legacy `@<address>` mention in a notification body threw inside render
 * and the error boundary replaced the whole global notifications panel.
 *
 * The contract this pins: an unresolvable mention degrades to the address label.
 * It never throws.
 */

import { useMessageFormatting } from '@/hooks/business/messages/useMessageFormatting';

const SENDER = 'QmNSr2YL6iLho1CQfRNikQRs2mBxGQRSL2CXYmtKL5ihUB';
const MENTIONED = 'QmYVtoRkxvNqRc1CQfRNikQRs2mBxGQRSL2CXYmtKL5LjD';

const messageWithMention = () =>
  ({
    messageId: 'msg-1',
    spaceId: 'space-1',
    channelId: 'channel-1',
    createdDate: 1_000,
    content: { type: 'post', senderId: SENDER, text: [`hey @<${MENTIONED}> look`] },
    reactions: [],
    mentions: { memberIds: [MENTIONED], roleIds: [], channelIds: [] },
  }) as any;

const tokenFor = (mapSenderToUser: (id: string) => any) => {
  const { result } = renderHook(() =>
    useMessageFormatting({
      message: messageWithMention(),
      stickers: {},
      mapSenderToUser,
      onImageClick: () => {},
    })
  );
  return result.current.processTextToken(`@<${MENTIONED}>`, 'msg-1', 0, 1);
};

describe('useMessageFormatting — mention with an unresolvable sender', () => {
  it('falls back to the address label instead of throwing', () => {
    // The exact shape GlobalNotificationsModal passes.
    const token = tokenFor(() => undefined);

    expect(token.type).toBe('mention');
    expect(token.address).toBe(MENTIONED);
    expect(token.displayName).toBe(`@${MENTIONED.substring(0, 8)}...`);
  });

  it('still prefers a resolved display name when one is available', () => {
    const token = tokenFor(() => ({ address: MENTIONED, displayName: 'Ada Lovelace' }));

    expect(token.displayName).toBe('Ada Lovelace');
  });

  it('falls back when the resolver returns a row with no display name', () => {
    const token = tokenFor(() => ({ address: MENTIONED }));

    expect(token.displayName).toBe(`@${MENTIONED.substring(0, 8)}...`);
  });
});
