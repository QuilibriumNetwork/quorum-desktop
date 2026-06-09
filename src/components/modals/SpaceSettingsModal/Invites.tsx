import * as React from 'react';
import { Button, Input, Icon, Tooltip, Spacer, Callout } from '../../primitives';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { ClickToCopyContent } from '../../ui';
import { UserAvatar } from '../../user/UserAvatar';
import { DefaultImages } from '../../../utils';
import { useCopyToClipboard } from '../../../hooks/business/ui/useCopyToClipboard';

type InviteMode = 'one-time' | 'public';

interface InvitesProps {
  space: any;
  selectedUser: any;
  setSelectedUser: (user: any) => void;
  manualAddress: string;
  setManualAddress: (address: string) => void;
  resolvedUser: any;
  getUserOptions: () => any[];
  sendingInvite: boolean;
  invite: (
    address: string,
    mode?: 'one-time' | 'public' | 'reuse',
    presetLink?: string
  ) => void;
  success: boolean;
  membershipWarning: string | undefined;
  generating: boolean;
  generationSuccess: boolean;
  refreshSuccess: boolean;
  errorMessage: string;
  setShowGenerateModal: (show: boolean) => void;
  refreshInviteLink: () => Promise<void>;
  // One-time "Copy a link" support — mint + clipboard write under the hood.
  // The UI never displays a persistent link, so `generatedOneTimeLink` from
  // the hook isn't exposed here; same for `generatingOneTimeLink` (button
  // drives its own spinner state).
  generateOneTimeLink: () => Promise<string | null>;
  clearGeneratedOneTimeLink: () => void;
  generateOneTimeLinkError: string | undefined;
  poolExhausted: boolean;
  isSpaceOwner: boolean;
}

interface SearchableConversationSelectProps {
  value: string;
  options: any[];
  onChange: (value: string) => void;
  placeholder?: string;
}

const SearchableConversationSelect: React.FunctionComponent<SearchableConversationSelectProps> = ({
  value,
  options,
  onChange,
  placeholder = t`Select conversation`,
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchInput, setSearchInput] = React.useState('');
  const selectRef = React.useRef<HTMLDivElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const filteredOptions = React.useMemo(() => {
    if (!searchInput.trim()) return options;
    const term = searchInput.toLowerCase();
    return options.filter(option =>
      option.label?.toLowerCase().includes(term) ||
      option.value?.toLowerCase().includes(term) ||
      option.subtitle?.toLowerCase().includes(term)
    );
  }, [options, searchInput]);

  const selectedOption = options.find(opt => opt.value === value);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isInsideComponent = selectRef.current && selectRef.current.contains(target);
      const isInsideDropdown = dropdownRef.current && dropdownRef.current.contains(target);

      if (!isInsideComponent && !isInsideDropdown) {
        setIsOpen(false);
        setSearchInput('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchInput('');
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchInput('');
    } else if (e.key === 'Enter' && filteredOptions.length > 0) {
      handleSelect(filteredOptions[0].value);
    }
  };

  return (
    <div ref={selectRef} className="relative w-full">
      <button
        type="button"
        className="w-full px-3 py-2 bg-[var(--color-field-bg)] border border-transparent rounded-lg text-left flex items-center justify-between hover:bg-[var(--color-field-bg-focus)] transition-colors cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="flex items-center gap-2 flex-1">
          {selectedOption ? (
            <>
              {selectedOption.avatar && (
                <UserAvatar
                  userIcon={selectedOption.avatar}
                  displayName={selectedOption.displayName || selectedOption.label}
                  address={selectedOption.value}
                  size={24}
                />
              )}
              <span className="text-[var(--color-field-text)]">{selectedOption.label}</span>
            </>
          ) : (
            <span className="text-[var(--color-text-subtle)]">{placeholder}</span>
          )}
        </span>
        <Icon
          name="chevron-down"
          size="xs"
          className={`text-[var(--color-text-subtle)] transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 w-full z-[10200] mt-1 bg-[var(--color-field-options-bg)] border-0 rounded-lg shadow-md max-h-60 overflow-hidden"
        >
          <div className="p-2 border-b border-[var(--color-field-border)]">
            <div className="flex items-center gap-2 ml-1">
              <Icon name="search" size="sm" className="text-subtle" />
              <Input
                value={searchInput}
                onChange={setSearchInput}
                placeholder={t`Search username or address`}
                variant="minimal"
                type="search"
                className="flex-1 border-0 bg-transparent text-sm placeholder:text-sm"
                onKeyDown={handleInputKeyDown}
                autoFocus
              />
            </div>
          </div>

          <div className="max-h-48 overflow-y-auto overflow-x-hidden">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-subtle text-sm">
                <Trans>No conversations found</Trans>
              </div>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = option.value === value;
                const hasValidAvatar = option.avatar && !option.avatar.includes(DefaultImages.UNKNOWN_USER);

                return (
                  <div
                    key={option.value}
                    className={`flex items-center justify-between p-2 cursor-pointer transition-colors hover:bg-[var(--color-field-option-hover)] min-w-0 ${
                      isSelected ? 'bg-[var(--color-field-option-selected)] text-[var(--color-accent)]' : ''
                    }`}
                    onClick={() => handleSelect(option.value)}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {hasValidAvatar ? (
                        <div
                          className="w-8 h-8 rounded-full bg-cover bg-center flex-shrink-0"
                          style={{ backgroundImage: `url(${option.avatar})` }}
                        />
                      ) : option.displayName ? (
                        <UserAvatar
                          displayName={option.displayName}
                          address={option.value}
                          size={32}
                          className="flex-shrink-0"
                        />
                      ) : null}

                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {option.label}
                        </div>
                        {option.subtitle && (
                          <div className="text-xs text-[var(--color-text-subtle)] truncate">
                            {option.subtitle}
                          </div>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <Icon
                        name="check"
                        size="sm"
                        className="text-[var(--color-accent)] flex-shrink-0 ml-2"
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface ModeToggleProps {
  mode: InviteMode;
  setMode: (m: InviteMode) => void;
  publicDisabled: boolean;
}

const ModeToggle: React.FunctionComponent<ModeToggleProps> = ({ mode, setMode, publicDisabled }) => {
  // Underline-style tabs.
  // Matches the pattern used on the Discover page.
  const base =
    'flex items-center gap-2 px-1 py-2 text-sm font-semibold bg-transparent border-0 border-b-2 transition-colors cursor-pointer';
  const inactive =
    'text-[var(--color-text-subtle)] border-transparent hover:text-[rgb(var(--color-text-main))]';
  const active = 'text-[var(--color-text-strong)] border-[var(--accent)]';

  return (
    <div className="flex gap-6 border-b border-[var(--color-border-default)]">
      <button
        type="button"
        className={`${base} ${mode === 'one-time' ? active : inactive}`}
        onClick={() => setMode('one-time')}
      >
        <Icon name="user" size="sm" />
        <Trans>One-Time</Trans>
      </button>
      <button
        type="button"
        disabled={publicDisabled}
        className={`${base} ${mode === 'public' ? active : inactive} ${
          publicDisabled
            ? 'opacity-50 !cursor-not-allowed hover:!text-[var(--color-text-subtle)]'
            : ''
        }`}
        onClick={() => !publicDisabled && setMode('public')}
      >
        <Icon name="globe" size="sm" />
        <Trans>Public Link</Trans>
      </button>
    </div>
  );
};

interface DmPickerProps {
  selectedUser: any;
  setSelectedUser: (user: any) => void;
  manualAddress: string;
  setManualAddress: (address: string) => void;
  getUserOptions: () => any[];
  showManualAddress: boolean;
  setShowManualAddress: (show: boolean) => void;
}

const DmPicker: React.FunctionComponent<DmPickerProps> = ({
  selectedUser,
  setSelectedUser,
  manualAddress,
  setManualAddress,
  getUserOptions,
  showManualAddress,
  setShowManualAddress,
}) => (
  <>
    <div className="input-style-label">
      <Trans>Existing Conversations</Trans>
    </div>
    <SearchableConversationSelect
      value={selectedUser?.address || ''}
      options={getUserOptions()}
      onChange={(address: string) => {
        const allConversations = getUserOptions();
        const conversation = allConversations.find((c) => c.value === address);
        if (conversation) {
          setSelectedUser({
            address: conversation.value,
            displayName: conversation.label,
            icon: conversation.avatar,
          } as any);
          setManualAddress('');
        }
      }}
      placeholder={t`Select conversation`}
    />
    <Spacer size="sm" />
    <div>
      <Button
        type="unstyled"
        onClick={() => setShowManualAddress(!showManualAddress)}
        className="flex items-center gap-2 p-0"
      >
        <span>
          <Trans>Enter Address Manually</Trans>
        </span>
        <Icon
          name={showManualAddress ? 'chevron-down' : 'chevron-right'}
          size="sm"
        />
      </Button>
    </div>
    {showManualAddress && (
      <div className="mt-2">
        <Input
          className="w-full placeholder:text-sm"
          value={manualAddress}
          placeholder={t`Type the address of the user you want to send to`}
          onChange={setManualAddress}
        />
      </div>
    )}
  </>
);

const Invites: React.FunctionComponent<InvitesProps> = ({
  space,
  selectedUser,
  setSelectedUser,
  manualAddress,
  setManualAddress,
  resolvedUser,
  getUserOptions,
  sendingInvite,
  invite,
  success,
  membershipWarning,
  generating,
  generationSuccess,
  refreshSuccess,
  errorMessage,
  setShowGenerateModal,
  refreshInviteLink,
  generateOneTimeLink,
  clearGeneratedOneTimeLink,
  generateOneTimeLinkError,
  poolExhausted,
  isSpaceOwner,
}) => {
  // Default to public mode if a public link already exists (likely intent on
  // re-open). Non-owners are stuck on one-time.
  const [mode, setMode] = React.useState<InviteMode>(
    isSpaceOwner && space?.inviteUrl ? 'public' : 'one-time'
  );
  const [showManualAddress, setShowManualAddress] = React.useState<boolean>(false);
  // Both modes hide the DM picker behind a "Send via DM" toggle.
  const [showPublicDmPicker, setShowPublicDmPicker] = React.useState<boolean>(false);
  const [showOneTimeDmPicker, setShowOneTimeDmPicker] = React.useState<boolean>(false);
  // "Link copied" callout. Persists until dismissed.
  const [oneTimeLinkCopied, setOneTimeLinkCopied] = React.useState<boolean>(false);
  // Mirrors the hook's transient `success` so the "Invite sent" callout
  // persists until the user dismisses it or fires another send.
  const [oneTimeSentVisible, setOneTimeSentVisible] = React.useState<boolean>(false);
  // Drives the Copy button's in-button spinner. We use a local flag because
  // the underlying mint is near-instant (no network); without a minimum
  // window the spinner just flickers and the user can't tell anything happened.
  const [oneTimeCopying, setOneTimeCopying] = React.useState<boolean>(false);

  const { copyToClipboard } = useCopyToClipboard();

  const publicDisabled = !isSpaceOwner;

  // Force one-time mode if owner status flips false mid-modal.
  React.useEffect(() => {
    if (publicDisabled && mode === 'public') setMode('one-time');
  }, [publicDisabled, mode]);

  // Reset the picker expansions and the persistent one-time callouts when
  // the user switches modes.
  React.useEffect(() => {
    setShowPublicDmPicker(false);
    setShowOneTimeDmPicker(false);
    setOneTimeLinkCopied(false);
    setOneTimeSentVisible(false);
  }, [mode]);

  // After a successful one-time DM send: clear the picked contact (so the
  // user can immediately pick another) and surface the "Invite sent" callout.
  React.useEffect(() => {
    if (mode !== 'one-time') return;
    if (success) {
      setSelectedUser(undefined);
      setManualAddress('');
      setOneTimeSentVisible(true);
    }
  }, [success, mode, setSelectedUser, setManualAddress]);

  const sendArgs: { mode: 'one-time' | 'public' } = { mode };

  const canSend =
    !sendingInvite && !poolExhausted && (selectedUser || resolvedUser);

  const onSend = () => {
    const address = selectedUser?.address ?? resolvedUser?.user_address;
    if (!address) return;
    // Hide any leftover "Invite sent" callout so the user sees a fresh one
    // for this send.
    setOneTimeSentVisible(false);
    invite(address, sendArgs.mode);
  };

  // Non-owners see a stripped-down read-only view: the public invite URL
  // (replicated to every member's local Space record via the encrypted
  // manifest) + Copy + Send via DM. The Send path uses mode='public' which
  // forwards space.inviteUrl as-is without consuming the eval pool. See
  // #29 in port-from-mobile/candidates.md for the capability investigation.
  if (!isSpaceOwner) {
    const sendDisabled =
      sendingInvite || !(selectedUser || resolvedUser);

    const onSendPublic = () => {
      const address = selectedUser?.address ?? resolvedUser?.user_address;
      if (!address) return;
      invite(address, 'public');
    };

    return (
      <>
        <div className="modal-content-header">
          <div className="modal-text-section">
            <div className="text-title flex items-center gap-2">
              <Icon name="user-plus" size="lg" />
              <Trans>Invites</Trans>
            </div>
            <div className="pt-2 text-body">
              <Trans>
                Share this Space's public invite link. Anyone with the link
                can join.
              </Trans>
            </div>
          </div>
        </div>

        <div className="modal-content-section">
          <div className="modal-content-info">
            <div className="flex pb-1 items-center">
              <div className="input-style-label">
                <Trans>Current Invite Link</Trans>
              </div>
              <Tooltip
                id="non-owner-invite-link-tooltip"
                content={t`This link was generated by a Space owner. It does not expire.`}
                place="bottom"
                className="!w-[400px]"
                maxWidth={400}
              >
                <Icon
                  name="info-circle"
                  className="text-main hover:text-strong cursor-pointer ml-2 -mt-1"
                  size="sm"
                />
              </Tooltip>
            </div>

            <ClickToCopyContent
              text={space?.inviteUrl ?? ''}
              tooltipText={t`Copy invite link to clipboard`}
              className="bg-field border-0 rounded-md px-3 py-1.5 text-sm w-full max-w-full overflow-hidden whitespace-nowrap cursor-pointer"
              iconClassName="text-muted hover:text-main"
              copyOnContentClick
            >
              <div className="flex items-center gap-2 w-full">
                <div className="truncate flex-1 text-subtle">
                  {space?.inviteUrl}
                </div>
              </div>
            </ClickToCopyContent>

            <div className="flex gap-2 mt-4 items-center">
              <Button
                type="secondary"
                onClick={() => setShowPublicDmPicker((v) => !v)}
              >
                <Trans>Send via DM</Trans>
                <Icon
                  name={showPublicDmPicker ? 'chevron-down' : 'chevron-right'}
                  size="sm"
                  className="ml-1"
                />
              </Button>
            </div>

            {showPublicDmPicker && (
              <div className="mt-4">
                {success && (
                  <Callout
                    variant="success"
                    size="sm"
                    className="mb-4"
                    dismissible
                  >
                    <Trans>
                      Invite sent. Pick another contact to send another.
                    </Trans>
                  </Callout>
                )}
                {membershipWarning && (
                  <Callout variant="warning" size="sm" className="mb-4">
                    {membershipWarning}
                  </Callout>
                )}

                <DmPicker
                  selectedUser={selectedUser}
                  setSelectedUser={setSelectedUser}
                  manualAddress={manualAddress}
                  setManualAddress={setManualAddress}
                  getUserOptions={getUserOptions}
                  showManualAddress={showManualAddress}
                  setShowManualAddress={setShowManualAddress}
                />
                <div className="flex gap-2 mt-4">
                  <Button
                    type="primary"
                    disabled={sendDisabled}
                    onClick={onSendPublic}
                  >
                    <Trans>Send Link</Trans>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="modal-content-header">
        <div className="modal-text-section">
          <div className="text-title flex items-center gap-2">
            <Icon name="user-plus" size="lg" />
            <Trans>Invites</Trans>
          </div>
        </div>
      </div>

      <div className="modal-content-section">
        <div className="modal-content-info">
          {/* Mode toggle */}
          <ModeToggle
            mode={mode}
            setMode={setMode}
            publicDisabled={publicDisabled}
          />

          <Spacer size="md" />

          {/* Mode-specific intro copy. Public mode hides it once a link is
              displayed (the link box is self-explanatory); one-time mode
              always shows it (there's never a persistent link on screen). */}
          {(mode === 'one-time' || !space?.inviteUrl) && (
            <div className="text-label mb-4 max-w-[500px]">
              {mode === 'one-time' ? (
                <Trans>
                  Send a one-time invite directly to someone. Each link can only
                  be used once.
                </Trans>
              ) : (
                <Trans>
                  A reusable link anyone can use to join. Share it on social
                  media or your website.
                </Trans>
              )}
            </div>
          )}

          {poolExhausted && (
            <Callout variant="warning" size="sm" className="mb-4">
              <div className="text-sm">
                {space?.inviteUrl && mode === 'one-time' ? (
                  <Trans>
                    New one-time invites can't be issued from this device for
                    this Space. The public invite link still works — switch
                    to <b>Public Link</b> above to copy it or send it via DM.
                  </Trans>
                ) : space?.inviteUrl && mode === 'public' ? (
                  <Trans>
                    New invites can't be issued from this device, but the
                    existing public invite link still works — copy it or
                    send it via DM below.
                  </Trans>
                ) : (
                  <Trans>
                    New invites can't be issued from this device for this
                    Space. Existing invite links keep working. This
                    typically affects spaces created on the desktop app
                    before June 2026.
                  </Trans>
                )}
              </div>
            </Callout>
          )}

          {/* One-time mode: two parallel actions, no displayed link.
              - Send via DM: expands inline picker. Each Send mints a fresh
                URL invisibly and DMs it. Multiple sends in a row each
                generate independent links — no "same URL to many" footgun.
              - Copy a link: mints + clipboard, shows a callout. Never
                rendered on screen. */}
          {mode === 'one-time' && (
            <>
              {generateOneTimeLinkError && (
                <Callout variant="error" size="sm" className="mb-4">
                  <span>{generateOneTimeLinkError}</span>
                </Callout>
              )}

              {oneTimeLinkCopied && (
                <Callout
                  variant="success"
                  size="sm"
                  className="mb-4"
                  dismissible
                  onClose={() => setOneTimeLinkCopied(false)}
                >
                  <Trans>
                    Link copied. Paste it where you want to share it.
                  </Trans>
                </Callout>
              )}

              <div className="flex gap-2 items-center">
                <Button
                  type="secondary"
                  onClick={() => {
                    // Toggle Send via DM. When opening it, dismiss any
                    // leftover "Link copied" from a prior Copy a link.
                    // When closing it, also clear the Invite-sent callout
                    // so the next reopen is clean.
                    setShowOneTimeDmPicker((v) => {
                      const opening = !v;
                      if (opening) {
                        setOneTimeLinkCopied(false);
                      } else {
                        setOneTimeSentVisible(false);
                      }
                      return opening;
                    });
                  }}
                >
                  <Trans>Send via DM</Trans>
                  <Icon
                    name={
                      showOneTimeDmPicker ? 'chevron-down' : 'chevron-right'
                    }
                    size="sm"
                    className="ml-1"
                  />
                </Button>
                <Tooltip
                  id="copy-one-time-link-tooltip"
                  content={t`Generate a fresh one-time invite link and copy it to your clipboard. Each click creates a new link. Paste it wherever you want (email, WhatsApp, etc.).`}
                  place="bottom"
                  className="!w-[400px]"
                  maxWidth={400}
                >
                  <Button
                    type="subtle-outline"
                    disabled={poolExhausted || oneTimeCopying}
                    onClick={async () => {
                      // Collapse the DM picker and clear any leftover
                      // Invite-sent state so the Copy callout is the only
                      // thing on screen after this action.
                      setShowOneTimeDmPicker(false);
                      setOneTimeSentVisible(false);
                      // 1.2s minimum so the in-button spinner is perceivable.
                      setOneTimeCopying(true);
                      setOneTimeLinkCopied(false);
                      try {
                        const [link] = await Promise.all([
                          generateOneTimeLink(),
                          new Promise<void>((r) => window.setTimeout(r, 1200)),
                        ]);
                        if (link) {
                          await copyToClipboard(link);
                          clearGeneratedOneTimeLink();
                          setOneTimeLinkCopied(true);
                        }
                      } finally {
                        setOneTimeCopying(false);
                      }
                    }}
                  >
                    {oneTimeCopying ? (
                      <div className="flex items-center gap-2">
                        <Icon name="spinner" size="sm" className="icon-spin" />
                        <Trans>Generating…</Trans>
                      </div>
                    ) : (
                      <Trans>Copy a link</Trans>
                    )}
                  </Button>
                </Tooltip>
              </div>

              {showOneTimeDmPicker && (
                <div className="mt-4">
                  {oneTimeSentVisible && (
                    <Callout
                      variant="success"
                      size="sm"
                      className="mb-4"
                      dismissible
                      onClose={() => setOneTimeSentVisible(false)}
                    >
                      <Trans>Invite sent. Pick another contact to send another.</Trans>
                    </Callout>
                  )}
                  {membershipWarning && (
                    <Callout
                      variant="warning"
                      size="sm"
                      className="mb-4"
                    >
                      {membershipWarning}
                    </Callout>
                  )}

                  <DmPicker
                    selectedUser={selectedUser}
                    setSelectedUser={setSelectedUser}
                    manualAddress={manualAddress}
                    setManualAddress={setManualAddress}
                    getUserOptions={getUserOptions}
                    showManualAddress={showManualAddress}
                    setShowManualAddress={setShowManualAddress}
                  />
                  <div className="flex gap-2 mt-4">
                    <Button type="primary" disabled={!canSend} onClick={onSend}>
                      <Trans>Send Invite</Trans>
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Public mode: link box + Send via DM + Republish, or the
              first-time generate button if no link exists. */}
          {mode === 'public' && (
            <>
              {generating && (
                <Callout variant="warning" size="sm" className="mb-4">
                  <div className="flex items-center gap-2">
                    <Icon name="spinner" className="text-warning icon-spin" />
                    <span>
                      <Trans>Generating public invite link...</Trans>
                    </span>
                  </div>
                </Callout>
              )}

              {generationSuccess && (
                <Callout
                  variant="success"
                  size="sm"
                  className="mb-4"
                  autoClose={3}
                >
                  <span>
                    <Trans>Public invite link generated successfully.</Trans>
                  </span>
                </Callout>
              )}

              {refreshSuccess && (
                <Callout
                  variant="success"
                  size="sm"
                  className="mb-4"
                  autoClose={3}
                >
                  <span>
                    <Trans>Join preview updated.</Trans>
                  </span>
                </Callout>
              )}

              {errorMessage && (
                <Callout variant="error" size="sm" className="mb-4">
                  <span>{errorMessage}</span>
                </Callout>
              )}

              {space?.inviteUrl && !generating ? (
                <>
                  <div className="flex pb-1 items-center">
                    <div className="input-style-label">
                      <Trans>Current Invite Link</Trans>
                    </div>
                    <Tooltip
                      id="current-invite-link-tooltip"
                      content={t`This link does not expire. Anyone with it can join your Space.`}
                      place="bottom"
                      className="!w-[400px]"
                      maxWidth={400}
                    >
                      <Icon
                        name="info-circle"
                        className="text-main hover:text-strong cursor-pointer ml-2 -mt-1"
                        size="sm"
                      />
                    </Tooltip>
                  </div>

                  <ClickToCopyContent
                    text={space.inviteUrl}
                    tooltipText={t`Copy invite link to clipboard`}
                    className="bg-field border-0 rounded-md px-3 py-1.5 text-sm w-full max-w-full overflow-hidden whitespace-nowrap cursor-pointer"
                    iconClassName="text-muted hover:text-main"
                    copyOnContentClick
                  >
                    <div className="flex items-center gap-2 w-full">
                      <div className="truncate flex-1 text-subtle">
                        {space.inviteUrl}
                      </div>
                    </div>
                  </ClickToCopyContent>

                  <div className="flex gap-2 mt-4 items-center">
                    <Button
                      type="secondary"
                      onClick={() => setShowPublicDmPicker((v) => !v)}
                    >
                      <Trans>Send via DM</Trans>
                      <Icon
                        name={
                          showPublicDmPicker ? 'chevron-down' : 'chevron-right'
                        }
                        size="sm"
                        className="ml-1"
                      />
                    </Button>
                    <Tooltip
                      id="republish-invite-tooltip"
                      content={t`If users report that this invite link isn't working, click to republish it. The link URL stays the same.`}
                      place="bottom"
                      className="!w-[400px]"
                      maxWidth={400}
                    >
                      <Button
                        type="subtle-outline"
                        onClick={() => { void refreshInviteLink(); }}
                        disabled={generating || poolExhausted}
                      >
                        <Trans>Republish</Trans>
                      </Button>
                    </Tooltip>
                  </div>

                  {showPublicDmPicker && (
                    <div className="mt-4">
                      {success && (
                        <Callout
                          variant="success"
                          size="sm"
                          className="mb-4"
                          dismissible
                        >
                          <Trans>Invite sent. Pick another contact to send another.</Trans>
                        </Callout>
                      )}
                      {membershipWarning && (
                        <Callout
                          variant="warning"
                          size="sm"
                          className="mb-4"
                        >
                          {membershipWarning}
                        </Callout>
                      )}

                      <DmPicker
                        selectedUser={selectedUser}
                        setSelectedUser={setSelectedUser}
                        manualAddress={manualAddress}
                        setManualAddress={setManualAddress}
                        getUserOptions={getUserOptions}
                        showManualAddress={showManualAddress}
                        setShowManualAddress={setShowManualAddress}
                      />
                      <div className="flex gap-2 mt-4">
                        <Button
                          type="primary"
                          disabled={!canSend}
                          onClick={onSend}
                        >
                          <Trans>Send Link</Trans>
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : !space?.inviteUrl && !generating ? (
                <div className="flex">
                  <Button
                    type="primary"
                    onClick={() => setShowGenerateModal(true)}
                    disabled={generating || poolExhausted}
                  >
                    <Trans>Generate Public Invite Link</Trans>
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default Invites;
