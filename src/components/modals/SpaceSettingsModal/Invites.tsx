import * as React from 'react';
import { Button, Select, Input, Icon, Tooltip, Spacer, Callout } from '../../primitives';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { ClickToCopyContent } from '../../ui';
import { UserAvatar } from '../../user/UserAvatar';
import { DefaultImages } from '../../../utils';

interface InvitesProps {
  space: any;
  selectedUser: any;
  setSelectedUser: (user: any) => void;
  manualAddress: string;
  setManualAddress: (address: string) => void;
  resolvedUser: any;
  getUserOptions: () => any[];
  sendingInvite: boolean;
  invite: (address: string) => void;
  success: boolean;
  membershipWarning: string | undefined;
  generating: boolean;
  generationSuccess: boolean;
  errorMessage: string;
  setShowGenerateModal: (show: boolean) => void;
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

  // Filter options based on search
  const filteredOptions = React.useMemo(() => {
    if (!searchInput.trim()) return options;
    const term = searchInput.toLowerCase();
    return options.filter(option =>
      option.label?.toLowerCase().includes(term) ||
      option.value?.toLowerCase().includes(term) ||
      option.subtitle?.toLowerCase().includes(term)
    );
  }, [options, searchInput]);

  // Find selected option for display
  const selectedOption = options.find(opt => opt.value === value);

  // Close dropdown when clicking outside
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
      {/* Select trigger button */}
      <button
        type="button"
        className="w-full px-3 py-2 bg-[var(--color-field-bg)] border border-transparent rounded-lg text-left flex items-center justify-between hover:bg-[var(--color-field-bg-focus)] transition-colors"
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

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 w-full z-[10200] mt-1 bg-[var(--color-field-options-bg)] border-0 rounded-lg shadow-md max-h-60 overflow-hidden"
        >
          {/* Search input */}
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

          {/* Options list */}
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
                      {/* Avatar */}
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

                      {/* Text content */}
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

                    {/* Selected indicator */}
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
  errorMessage,
  setShowGenerateModal,
}) => {
  // State for showing/hiding manual address field
  const [showManualAddress, setShowManualAddress] = React.useState<boolean>(false);

  return (
    <>
      <div className="modal-content-header">
        <div className="modal-text-section">
          <div className="text-title">
            <Trans>Invites</Trans>
          </div>
          <div className="pt-2 text-body">
            <Trans>
              Manage Inivte links and send invites to people you've previously had
              conversations with.
            </Trans>
          </div>
        </div>
      </div>
      <div className="modal-content-section">
        <div className="flex"></div>
        <div className=""></div>
        <div className="modal-content-info">
          <div className="input-style-label">
            <Trans>Existing Conversations</Trans>
          </div>
          <SearchableConversationSelect
            value={selectedUser?.address || ''}
            options={getUserOptions()}
            onChange={(address: string) => {
              // Find conversation and set selected user
              const allConversations = getUserOptions();
              const conversation = allConversations.find(
                (c) => c.value === address
              );
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
          <Spacer size="md"></Spacer>

          {/* Manual Address Toggle */}
          <div>
            <Button
              type="unstyled"
              onClick={() => setShowManualAddress(!showManualAddress)}
              className="flex items-center gap-2 p-0"
            >
              <span><Trans>Enter Address Manually</Trans></span>
              <Icon
                name={showManualAddress ? "chevron-down" : "chevron-right"}
                size="sm"
              />
            </Button>
          </div>

          {/* Manual Address Input - Collapsible */}
          {showManualAddress && (
            <div className="mt-2 mb-6">
              <Input
                className="w-full placeholder:text-sm"
                value={manualAddress}
                placeholder="Type the address of the user you want to send to"
                onChange={setManualAddress}
              />
            </div>
          )}

          {/* Send Invite Button - Moved here */}
          <div className="flex gap-2 mt-4">
            <Button
              type="primary"
              disabled={
                sendingInvite || (!selectedUser && !resolvedUser)
              }
              onClick={() => {
                if (selectedUser) {
                  invite(selectedUser.address);
                } else if (resolvedUser) {
                  invite(resolvedUser.user_address);
                }
              }}
            >
              <Trans>Send Invite</Trans>
            </Button>
          </div>
          {success && (
            <>
              <Spacer size="sm"/>
              <Callout variant="success" layout="minimal" size="sm" autoClose={3}>
                <Trans>
                  Successfully sent invite to{' '}
                  {selectedUser?.displayName}
                </Trans>
              </Callout>
            </>
          )}
          {membershipWarning && (
            <>
              <Spacer size="sm"/>
              <Callout variant="warning" layout="minimal" size="sm" autoClose={5}>
                {membershipWarning}
              </Callout>
            </>
          )}
          <Spacer
            spaceBefore="lg"
            spaceAfter="md"
            border={true}
            direction="vertical"
          />
          <div>
            <div className="text-subtitle-2">
              <Trans>Public Invite Links</Trans>
            </div>

            {/* Callouts for operations */}
            {generating && (
              <Callout variant="warning" size="sm" className="mb-4 mt-4">
                <div className="flex items-center gap-2">
                  <Icon name="spinner" className="text-warning icon-spin" />
                  <span>Generating public invite link...</span>
                </div>
              </Callout>
            )}

            {generationSuccess && (
              <Callout variant="success" size="sm" className="mb-4 mt-4" autoClose={3}>
                <span>Public invite link generated successfully.</span>
              </Callout>
            )}

            {errorMessage && (
              <Callout variant="error" size="sm" className="mb-4 mt-4">
                <span>{errorMessage}</span>
              </Callout>
            )}

            {!space?.inviteUrl && !generating ? (
              // STATE 1: No link exists and not generating - Show generate button
              <div className="mt-4">
                <div className="text-label mb-4 max-w-[500px]">
                  <Trans>
                    Public invite links allow anyone with access to the link to join your Space.
                    Consider who you share the link with and where you post it.
                  </Trans>
                </div>
                <div className="flex">
                  <Button
                    type="secondary"
                    onClick={() => setShowGenerateModal(true)}
                    disabled={generating}
                  >
                    <Trans>Generate Public Invite Link</Trans>
                  </Button>
                </div>
              </div>
            ) : !space?.inviteUrl && generating ? (
              // STATE 1b: Generating first link - Only show callout
              null
            ) : space?.inviteUrl && generating ? (
              // STATE 2b: Regenerating link - Only show callout
              null
            ) : (
              // STATE 2: Link exists and not generating - Show link + action buttons
              <div className="mt-4">
                <div className="flex pt-2 pb-1 items-center">
                  <div className="input-style-label">
                    <Trans>Current Invite Link</Trans>
                  </div>
                  <Tooltip
                    id="current-invite-link-tooltip"
                    content={t`This link will not expire, but you can generate a new one at any time, which will invalidate the old link.`}
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
                  text={space?.inviteUrl || ''}
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

                <div className="flex gap-2 mt-4">
                  <Button
                    type="secondary"
                    onClick={() => setShowGenerateModal(true)}
                    disabled={generating}
                  >
                    <Trans>Generate New Link</Trans>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Invites;