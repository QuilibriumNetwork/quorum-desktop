/**
 * Fake QNS — the resident panel.
 *
 * Makes every QNS surface reachable on an account that owns no registered `.q`
 * name. See `fakeQnsCore.ts` for why this exists, why the injection point is the
 * API client rather than the hooks, and what a green run does and does not
 * prove.
 *
 * Nothing here writes to the network. Desktop has no "set my own primary
 * username" control at all — it reads `primary_username` from other people's
 * profiles and never publishes one (see `PublicProfileService.ts`) — so unlike
 * mobile's version of this panel, every switch below is a read-side overlay
 * with no real-state half.
 */

import React, { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Text, Flex, Button } from '../../components/primitives';
import { DevNavMenu } from '../DevNavMenu';
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
      <Text variant="strong" size="sm" className="block">
        {label}
      </Text>
      <Text variant="subtle" size="xs" className="block">
        {hint}
      </Text>
    </span>
  </label>
);

export const FakeQns: React.FC = () => {
  const queryClient = useQueryClient();
  const [state, setState] = useState<FakeQnsState>(() => getFakeQnsState());
  const [address, setAddress] = useState('');
  const [name, setName] = useState('');

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

  const handleReset = useCallback(() => {
    setState(clearFakeQns());
    invalidate();
  }, [invalidate]);

  const entries = Object.entries(state.entries);

  return (
    <Flex direction="column" className="h-full overflow-auto p-6 gap-4">
      <DevNavMenu />

      <div className="border border-dashed border-yellow-500 rounded-lg p-4">
        <Text variant="strong" size="lg" className="block text-yellow-500">
          {'</>'} Fake QNS (dev builds only)
        </Text>
        <Text variant="subtle" size="xs" className="block mb-4">
          See where a .q name renders without owning one. Read-side overlay
          only: nothing is written, signed, or published.
        </Text>

        <Flex direction="column" className="gap-3">
          <Toggle
            label="Enable fake QNS"
            hint="Master switch. Off = identical to a production build."
            value={state.enabled}
            onChange={(v) => update({ enabled: v })}
          />
          <Toggle
            label="Give everyone a .q"
            hint="Stable qXXXX name per address. The fast way to find every surface that renders a name. Never overwrites a real registration."
            value={state.giveEveryoneAName}
            disabled={!state.enabled}
            onChange={(v) => update({ giveEveryoneAName: v })}
          />
          <Toggle
            label="All profiles private"
            hint="Every public-profile fetch returns nothing — what others see when a profile is not public. Overrides the switch above."
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
      <div className="border border-dashed border-yellow-500 rounded-lg p-4">
        <Text variant="strong" size="sm" className="block text-yellow-500">
          Pin one address
        </Text>
        <Text variant="subtle" size="xs" className="block mb-3">
          Overrides the everyone rule for a single member. Leave the name empty
          to give them no .q at all — that is your control.
        </Text>
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
                <Text size="xs" className="font-mono flex-1 truncate">
                  {addr}
                </Text>
                <Text size="xs" variant="subtle">
                  {entry.private
                    ? 'private'
                    : entry.primaryUsername
                      ? `${entry.primaryUsername}.q`
                      : 'no .q (control)'}
                </Text>
                <Button size="sm" onClick={() => handleUnpin(addr)}>
                  Unpin
                </Button>
              </Flex>
            ))}
          </Flex>
        )}
      </div>

      <Flex className="gap-3 items-center">
        <Text size="xs" variant="subtle" className="flex-1">
          {state.enabled
            ? state.allProfilesPrivate
              ? 'all profiles private'
              : state.giveEveryoneAName
                ? `everyone gets a .q (e.g. ${deriveFakeQName('QmExample1234')}.q)`
                : 'enabled, no blanket rule'
            : 'off'}
          {entries.length > 0 ? ` · ${entries.length} pinned` : ''}
        </Text>
        <Button size="sm" onClick={handleReset}>
          Reset
        </Button>
      </Flex>

      <Text size="xs" variant="subtle">
        Reopen the space after a change — an open screen holds an
        already-resolved member map. Keep these switches matched with mobile&apos;s
        panel when comparing the two clients, or you are comparing different
        inputs.
      </Text>
    </Flex>
  );
};
