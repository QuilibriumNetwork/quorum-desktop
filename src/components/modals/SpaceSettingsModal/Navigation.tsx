import * as React from 'react';
import { Icon } from '../../primitives';
import { t } from '@lingui/core/macro';

interface NavigationProps {
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
}

const Navigation: React.FunctionComponent<NavigationProps> = ({
  selectedCategory,
  setSelectedCategory,
}) => {
  const categories = [
    { id: 'general', icon: 'cog', label: t`General`, className: '' },
    { id: 'roles', icon: 'users', label: t`Roles`, className: '' },
    { id: 'emojis', icon: 'smile', label: t`Emojis`, className: '' },
    { id: 'stickers', icon: 'image', label: t`Stickers`, className: '' },
    { id: 'invites', icon: 'user-plus', label: t`Invites`, className: '' },
    { id: 'danger', icon: 'exclamation-triangle', label: t`Delete Space`, className: 'text-danger' },
  ];

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