/**
 * Fake QNS — the resident panel.
 *
 * Makes every QNS surface reachable on an account that owns no registered `.q`
 * name. See `fakeQnsCore.ts` for why this exists, why the injection point is the
 * API client rather than the hooks, and what a green run does and does not
 * prove.
 *
 * Nothing here writes to the network, including the "give myself a .q" control.
 * Desktop never publishes a primary username (see `PublicProfileService.ts`),
 * and it reads its OWN one from `useUserPublicProfile(ownAddress)` — the same
 * fetch this overlay intercepts. So self is just another pinned entry here,
 * where mobile's equivalent has to write a real profile field.
 *
 * ## Giving yourself a name covers most of the job
 *
 * Almost every surface that renders a name can render YOU: your messages, a
 * reply to your own message, a mention you typed at yourself, your reactions,
 * the member sidebar, and the notification body when someone mentions you (the
 * name in that body is the mentioned person, not the sender). The everyone
 * switch exists for the remainder — a DM partner's name, a blocked user — and
 * is a coverage sweep rather than a state anybody would really be in.
 */

import React, { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { Flex, Button } from '../../components/primitives';
import { DevPage, DevPageHeader } from '../shell';
import {
  clearFakeQns,
  deriveFakeQName,
  getFakeQnsState,
  removeFakeQnsEntry,
  setFakeQnsEntry,
  setFakeQnsState,
  type FakeQnsState,
} from './fakeQnsCore';

interface ToggleProps {
  label: string;
  hint: string;
  value: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}

const Toggle: React.FC<ToggleProps> = ({
  label,
  hint,
  value,
  disabled,
  onChange,
}) => (
  <label
    className={`flex items-start gap-3 ${disabled ? 'opacity-45' : 'cursor-pointer'}`}
  >
    <input
      type="checkbox"
      checked={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
      className="mt-1 cursor-pointer"
    />
    <span>
      <span className="text-sm text-strong block">
        {label}
      </span>
      <span className="text-xs text-subtle block">
        {hint}
      </span>
    </span>
  </label>
);

export const FakeQns: React.FC = () => {
  const queryClient = useQueryClient();
  const { currentPasskeyInfo } = usePasskeysContext();
  const ownAddress = currentPasskeyInfo?.address ?? null;

  const [state, setState] = useState<FakeQnsState>(() => getFakeQnsState());
  const [address, setAddress] = useState('');
  const [name, setName] = useState('');
  const [selfName, setSelfName] = useState(() =>
    ownAddress ? (getFakeQnsState().entries[ownAddress.toLowerCase()]?.primaryUsername ?? '') : ''
  );

  /** Drop every cached public profile so the next render refetches through the
   *  overlay. Without this a toggle looks inert for up to an hour. */
  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['user-public-profile'] });
    queryClient.invalidateQueries({ queryKey: ['publicProfile'] });
  }, [queryClient]);

  const update = useCallback(
    (next: Partial<FakeQnsState>) => {
      setState(setFakeQnsState(next));
      invalidate();
    },
    [invalidate]
  );

  const handlePin = useCallback(() => {
    const addr = address.trim();
    if (!addr) return;
    setState(
      setFakeQnsEntry(addr, { primaryUsername: name.trim().replace(/\.q$/i, '') })
    );
    setAddress('');
    setName('');
    invalidate();
  }, [address, name, invalidate]);

  const handleUnpin = useCallback(
    (addr: string) => {
      setState(removeFakeQnsEntry(addr));
      invalidate();
    },
    [invalidate]
  );

  /** Your own address is just another pinned entry — desktop reads its own
   *  primary username from `useUserPublicProfile(ownAddress)`, the same fetch
   *  the overlay intercepts, so there is nothing special to do for self. */
  const handleApplySelf = useCallback(() => {
    if (!ownAddress) return;
    // Accept "name" or "name.q". The stored value is always bare and the suffix
    // is appended at render, so storing it with the suffix renders "name.q.q".
    const trimmed = selfName.trim().replace(/\.q$/i, '');
    setState(
      trimmed
        ? setFakeQnsEntry(ownAddress, { primaryUsername: trimmed })
        : removeFakeQnsEntry(ownAddress)
    );
    invalidate();
  }, [ownAddress, selfName, invalidate]);

  const handleClearSelf = useCallback(() => {
    if (!ownAddress) return;
    setSelfName('');
    setState(removeFakeQnsEntry(ownAddress));
    invalidate();
  }, [ownAddress, invalidate]);

  const handleReset = useCallback(() => {
    setSelfName('');
    setState(clearFakeQns());
    invalidate();
  }, [invalidate]);

  const entries = Object.entries(state.entries);

  return (
    <DevPage width="narrow">
        <DevPageHeader
          icon="at"
          title="Fake QNS"
          subtitle="See where a .q name renders without owning one. Dev builds only. Read-side overlay: nothing is written, signed, or published."
        />

      <div className="bg-surface-1 rounded-lg border border-default p-4">

        <Flex direction="column" className="gap-3">
          <Toggle
            label="Enable fake QNS"
            hint="Master switch. Off = identical to a production build."
            value={state.enabled}
            onChange={(v) => update({ enabled: v })}
          />
        </Flex>

        {/* Ordered by what you reach for, matching mobile's panel. Giving
            YOURSELF a name covers almost every surface on its own, because
            almost every surface can render you: your messages, a reply to your
            own message, a mention you typed at yourself, your reactions, and
            the notification body when someone mentions you (the name in that
            body is the MENTIONED person, which is you). The blanket switch
            below is for the few that render somebody else. */}
        <div className="mt-4 pt-4 border-t border-neutral-700">
          <span className="text-sm text-strong block">
            1 · Give MYSELF a .q
          </span>
          <span className="text-xs text-subtle block mb-2">
            Start here. Pins this name for your own address
            {ownAddress ? '' : ' (no address yet — sign in first)'}. Desktop
            never publishes a primary username, so unlike mobile this is a
            read-side overlay with no real profile write.
          </span>
          <Flex className="gap-2 items-center">
            <input
              className="flex-1 px-2 py-1 rounded border border-neutral-600 bg-transparent text-sm"
              placeholder="e.g. qatest"
              value={selfName}
              onChange={(e) => setSelfName(e.target.value)}
              aria-label="Fake primary QNS username for yourself"
            />
            <Button
              size="sm"
              onClick={handleApplySelf}
              disabled={!ownAddress || !selfName.trim()}
            >
              Set
            </Button>
            <Button size="sm" onClick={handleClearSelf} disabled={!ownAddress}>
              Clear
            </Button>
          </Flex>
        </div>

        <Flex direction="column" className="gap-3 mt-4 pt-4 border-t border-neutral-700">
          <Toggle
            label="2 · Give EVERYONE a .q"
            hint="Coverage sweep, not a realistic state. Only needed for surfaces that render somebody else — a DM partner's name, another person's mention pill. Never overwrites a real registration."
            value={state.giveEveryoneAName}
            disabled={!state.enabled}
            onChange={(v) => update({ giveEveryoneAName: v })}
          />
          <Toggle
            label="3 · All profiles private"
            hint="Every public-profile fetch returns nothing. For YOUR OWN profile the real public/private toggle in settings is the better test — it is end-to-end. This only simulates OTHER people being private. Overrides switch 2."
            value={state.allProfilesPrivate}
            disabled={!state.enabled}
            onChange={(v) => update({ allProfilesPrivate: v })}
          />
        </Flex>
      </div>

      {/* Pinning one address is how you build a control arm: with everyone
          named, there is nothing to compare against. Pin a member to a known
          name, or to no name at all, and the difference tells you which tier
          actually won. */}
      <div className="bg-surface-1 rounded-lg border border-default p-4">
        <h2 className="text-subtitle mb-1">Pin one address</h2>
        <span className="text-xs text-subtle block mb-3">
          Overrides the everyone rule for a single member. Leave the name empty
          to give them no .q at all — that is your control.
        </span>
        <Flex className="gap-2 items-center flex-wrap">
          <input
            className="flex-1 min-w-64 px-2 py-1 rounded border border-neutral-600 bg-transparent text-sm font-mono"
            placeholder="Qm… address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            aria-label="Address to pin"
          />
          <input
            className="w-40 px-2 py-1 rounded border border-neutral-600 bg-transparent text-sm"
            placeholder=".q name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="QNS name for the pinned address"
          />
          <Button size="sm" onClick={handlePin} disabled={!address.trim()}>
            Pin
          </Button>
        </Flex>

        {entries.length > 0 && (
          <Flex direction="column" className="gap-1 mt-3">
            {entries.map(([addr, entry]) => (
              <Flex key={addr} className="gap-2 items-center">
                <span className="text-xs font-mono flex-1 truncate">
                  {addr}
                </span>
                <span className="text-xs text-subtle">
                  {entry.private
                    ? 'private'
                    : entry.primaryUsername
                      ? `${entry.primaryUsername}.q`
                      : 'no .q (control)'}
                </span>
                <Button size="sm" onClick={() => handleUnpin(addr)}>
                  Unpin
                </Button>
              </Flex>
            ))}
          </Flex>
        )}
      </div>

      <Flex className="gap-3 items-center">
        <span className="text-xs text-subtle flex-1">
          {state.enabled
            ? state.allProfilesPrivate
              ? 'all profiles private'
              : state.giveEveryoneAName
                ? `everyone gets a .q (e.g. ${deriveFakeQName('QmExample1234')}.q)`
                : 'enabled, no blanket rule'
            : 'off'}
          {entries.length > 0 ? ` · ${entries.length} pinned` : ''}
          {ownAddress &&
          state.entries[ownAddress.toLowerCase()]?.primaryUsername
            ? ` · me: ${state.entries[ownAddress.toLowerCase()]!.primaryUsername}.q`
            : ' · me: none'}
        </span>
        <Button size="sm" onClick={handleReset}>
          Reset
        </Button>
      </Flex>

      <span className="text-xs text-subtle">
        Reopen the space after a change — an open screen holds an
        already-resolved member map. Keep these switches matched with mobile&apos;s
        panel when comparing the two clients, or you are comparing different
        inputs.
      </span>
      {/* Desktop's own limitation, stated where it will be read. It differs
          from mobile's — mobile's member list cannot show a .q at all, this one
          can but only for people who have posted. Writing mobile's caveat here
          would send someone hunting the wrong thing. */}
      <span className="text-sm text-subtle block">
        The member sidebar only shows a .q for members who have posted in the
        open channel — it cheap-merges from the message senders and never
        fetches the full roster. A silent lurker showing no .q there is expected,
        not a regression.
      </span>
    </DevPage>
  );
};
