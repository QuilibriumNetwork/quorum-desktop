// One-time local sweep: drop the embedded sender avatar from every stored
// bookmark.
//
// Dropping the field from new writes does not shrink an existing account.
// Bookmarks written before this change each carry their own base64 copy of the
// sender's avatar — measured 2026-08-05 on a real account: 18 bookmarks, ~34 KB
// apiece, 619.8 KB, which was 69% of an 873 KB config blob against a ~1 MB
// working ceiling. This sweep is what actually returns those bytes.
//
// It is safe in a way the per-space override clear was not. That one destroyed
// values nothing could reconstruct, so it had to log what it removed. This one
// removes a RENDER CACHE: `senderAddress` is retained and BookmarkCard resolves
// the avatar from it (`useBookmarkSenderIcon`). Nothing is lost, so there is no
// recovery log — only a count.
//
// It is also purely local. Unlike the override clear there is no wire half to
// broadcast: `ConfigService` strips the field from every upload AND from every
// inbound config, so an un-migrated sibling device cannot push the bytes back.
//
// See `.agents/issues/2026-08-05-bookmarks-are-75-percent-of-the-config-blob.md`.

import { useEffect, useRef } from 'react';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { logger, stripBookmarkSenderIcons } from '@quilibrium/quorum-shared';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { useInvalidateBookmarks } from '../../queries/bookmarks/useInvalidateBookmarks';

/** Bump to re-run if the set of stripped fields ever changes. */
const SWEEP_FLAG_PREFIX = 'bookmarkSenderIconsStripped:v1:';

export function useStripBookmarkSenderIcons(): void {
  const { messageDB } = useMessageDB();
  const { currentPasskeyInfo } = usePasskeysContext();
  const invalidateBookmarks = useInvalidateBookmarks();
  const ranRef = useRef(false);

  useEffect(() => {
    const userAddress = currentPasskeyInfo?.address;
    if (!userAddress || ranRef.current) return;

    const flagKey = `${SWEEP_FLAG_PREFIX}${userAddress}`;
    if (localStorage.getItem(flagKey)) return;
    ranRef.current = true;

    (async () => {
      try {
        const stored = await messageDB.getBookmarks();
        const { bookmarks, strippedCount, bytesFreed } =
          stripBookmarkSenderIcons(stored);

        // `stripBookmarkSenderIcon` returns the same reference when there was
        // nothing to strip, so this rewrites only the rows that changed.
        for (let i = 0; i < bookmarks.length; i++) {
          if (bookmarks[i] === stored[i]) continue;
          await messageDB.putBookmark(bookmarks[i]);
        }

        localStorage.setItem(flagKey, String(Date.now()));

        if (strippedCount > 0) {
          invalidateBookmarks({ userAddress });
          // console.info, not logger — logger calls compile to no-ops in
          // production builds, and this number is the whole point of the fix.
          console.info(
            `[Bookmarks] stripped ${strippedCount} embedded sender avatar(s) ` +
              `from ${stored.length} bookmark(s), freeing ~${Math.round(bytesFreed / 1024)} KB ` +
              `of the config sync payload.`
          );
        }
      } catch (error) {
        // Do NOT set the flag — retry on the next launch. Matching the
        // legacy-override clear's failure behaviour.
        ranRef.current = false;
        logger.error('[Bookmarks] sender-avatar sweep failed', error);
      }
    })();
  }, [currentPasskeyInfo, messageDB, invalidateBookmarks]);
}
