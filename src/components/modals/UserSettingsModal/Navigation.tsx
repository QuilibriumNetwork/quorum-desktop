import * as React from 'react';
import { Icon } from '../../primitives';
import { t } from '@lingui/core/macro';
import { useScrollActivePillIntoView } from '../../../hooks/ui/useScrollActivePillIntoView';

interface NavigationProps {
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
}

const Navigation: React.FunctionComponent<NavigationProps> = ({
  selectedCategory,
  setSelectedCategory,
}) => {
  const pillsRef = useScrollActivePillIntoView(selectedCategory);

  const categories = [
    { id: 'general', icon: 'user', label: t`General`, className: '' },
    { id: 'privacy', icon: 'eye', label: t`Privacy`, className: '' },
    { id: 'security', icon: 'shield', label: t`Security`, className: '' },
    { id: 'notifications', icon: 'bell', label: t`Notifications`, className: '' },
    { id: 'appearance', icon: 'palette', label: t`Appearance`, className: '' },
    { id: 'help', icon: 'support', label: t`Help`, className: '' },
    { id: 'danger', icon: 'warning', label: t`Danger Zone`, className: 'text-danger' },
  ];

  return (
    <>
      {/* Desktop/Tablet Sidebar */}
      <div className="modal-complex-sidebar">
        <div className="modal-nav-title">{t`Account Settings`}</div>
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

      {/* Mobile header */}
      <div className="modal-nav-mobile-header">
        <div className="modal-nav-mobile-header-text">{t`Account Settings`}</div>
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