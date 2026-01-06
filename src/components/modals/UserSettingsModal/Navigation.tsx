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
    { id: 'general', icon: 'user', label: t`General`, className: '' },
    { id: 'privacy', icon: 'shield', label: t`Privacy/Security`, className: '' },
    { id: 'notifications', icon: 'bell', label: t`Notifications`, className: '' },
    { id: 'appearance', icon: 'palette', label: t`Appearance`, className: '' },
    { id: 'help', icon: 'support', label: t`Help`, className: '' },
  ];

  return (
    <>
      {/* Desktop/Tablet Sidebar */}
      <div className="modal-complex-sidebar">
        <div className="modal-nav-title">{t`Settings`}</div>
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