import * as React from 'react';
import { Icon } from '../../primitives';
import { t } from '@lingui/core/macro';
import { useSpaceOwner } from '../../../hooks/queries/spaceOwner/useSpaceOwner';
import { useScrollActivePillIntoView } from '../../../hooks/ui/useScrollActivePillIntoView';

interface NavigationProps {
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  spaceId: string;
  /** True when `space.inviteUrl` is set; gates the Invites tab for non-owners. */
  hasPublicInvite: boolean;
  /** Space name shown in the sidebar header so the user knows which Space they're configuring (the modal can be opened from outside the Space). */
  spaceName?: string;
  /** Space icon URL shown next to the name in the sidebar header. */
  spaceIconUrl?: string;
}

const Navigation: React.FunctionComponent<NavigationProps> = ({
  selectedCategory,
  setSelectedCategory,
  spaceId,
  hasPublicInvite,
  spaceName,
  spaceIconUrl,
}) => {
  const { data: isSpaceOwner } = useSpaceOwner({ spaceId });
  const pillsRef = useScrollActivePillIntoView(selectedCategory);

  const headerIconStyle = spaceIconUrl
    ? { backgroundImage: `url("${spaceIconUrl}")` }
    : undefined;
  const headerFallbackChar = spaceName?.trim().charAt(0).toUpperCase() ?? '';

  const allCategories = [
    { id: 'account', icon: 'user', label: t`Account`, className: '' },
    { id: 'general', icon: 'settings', label: t`General`, className: '' },
    { id: 'channels', icon: 'hashtag', label: t`Channels`, className: '' },
    { id: 'roles', icon: 'shield', label: t`Roles`, className: '' },
    { id: 'space-tag', icon: 'tag', label: t`Space Tag`, className: '' },
    { id: 'emojis', icon: 'smile', label: t`Emojis`, className: '' },
    { id: 'stickers', icon: 'image', label: t`Stickers`, className: '' },
    { id: 'invites', icon: 'user-plus', label: t`Invites`, className: '' },
    { id: 'danger', icon: 'warning', label: t`Delete Space`, className: 'text-danger' },
  ];

  // Owners see everything. Non-owners see Account always + Invites only when
  // the owner has published a public invite link (the link is replicated to
  // every member's local Space record via the encrypted manifest, so this is
  // a real read non-owners can do — see #29 in port-from-mobile/candidates.md).
  const categories = isSpaceOwner
    ? allCategories
    : allCategories.filter(
        (cat) => cat.id === 'account' || (cat.id === 'invites' && hasPublicInvite)
      );

  return (
    <>
      {/* Desktop/Tablet Sidebar */}
      <div className="modal-complex-sidebar">
        <div className="modal-nav-title-block" title={spaceName}>
          <div
            className="modal-nav-sidebar-header-icon"
            style={headerIconStyle}
          >
            {!spaceIconUrl && headerFallbackChar}
          </div>
          <div className="modal-nav-title-text">{spaceName ?? t`Space`}</div>
        </div>
        {categories.map((category) => (
          <div
            key={category.id}
            onClick={() => setSelectedCategory(category.id)}
            className={`modal-nav-category ${category.className} ${selectedCategory === category.id ? 'active' : ''}`}
          >
            <Icon name={category.icon as any} className={`mr-2 ${category.className || 'text-accent'}`} />
            {category.label}
          </div>
        ))}
      </div>

      {/* Mobile header showing which Space is being configured. */}
      <div className="modal-nav-mobile-header" title={spaceName}>
        <div
          className="modal-nav-mobile-header-icon"
          style={headerIconStyle}
        >
          {!spaceIconUrl && headerFallbackChar}
        </div>
        <div className="modal-nav-mobile-header-text">
          {spaceName ?? t`Space`}
        </div>
      </div>

      {/* Mobile horizontal pill nav. Scrolls the active pill into view.
          The wrapper hosts the right-edge fade overlay so it never overlaps
          the pills themselves. The trailing sentinel pushes the last pill
          left of the fade region so it doesn't get covered. */}
      <div className="modal-nav-mobile-pills-wrapper">
        <div ref={pillsRef} className="modal-nav-mobile-pills">
          {categories.map((category) => {
            const isActive = selectedCategory === category.id;
            return (
              <div
                key={category.id}
                data-active={isActive ? 'true' : undefined}
                onClick={() => setSelectedCategory(category.id)}
                className={`modal-nav-category ${category.className} ${isActive ? 'active' : ''}`}
              >
                <Icon name={category.icon as any} className={category.className || 'text-accent'} />
                {category.label}
              </div>
            );
          })}
          <div aria-hidden className="modal-nav-mobile-pills-end-spacer" />
        </div>
      </div>
    </>
  );
};

export default Navigation;