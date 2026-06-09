import * as React from 'react';
import { Icon } from '../../primitives';
import { t } from '@lingui/core/macro';
import { useSpaceOwner } from '../../../hooks/queries/spaceOwner/useSpaceOwner';

interface NavigationProps {
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  spaceId: string;
  /** True when `space.inviteUrl` is set; gates the Invites tab for non-owners. */
  hasPublicInvite: boolean;
}

const Navigation: React.FunctionComponent<NavigationProps> = ({
  selectedCategory,
  setSelectedCategory,
  spaceId,
  hasPublicInvite,
}) => {
  const { data: isSpaceOwner } = useSpaceOwner({ spaceId });

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
        <div className="modal-nav-title">{t`Space Settings`}</div>
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

      {/* Mobile 2-Column Menu */}
      <div className="modal-nav-mobile-2col">
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
    </>
  );
};

export default Navigation;