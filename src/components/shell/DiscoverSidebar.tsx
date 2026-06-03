import * as React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { t } from '@lingui/core/macro';
import type { IconName } from '@quilibrium/quorum-shared';
import { Icon, Tooltip } from '../primitives';
import { useShellState } from './useShellState';
import './DiscoverSidebar.scss';

type DiscoverSectionId = 'spaces' | 'people';

interface SectionConfig {
  id: DiscoverSectionId;
  icon: IconName;
  label: string;
  route: string;
}

const buildSections = (): SectionConfig[] => [
  {
    id: 'spaces',
    icon: 'users-group',
    label: t`Public spaces`,
    route: '/discover/spaces',
  },
  {
    id: 'people',
    icon: 'users',
    label: t`People`,
    route: '/discover/people',
  },
];

interface DiscoverSidebarProps {
  forceExpanded?: boolean;
}

/**
 * Discover sidebar — two-section navigation (Public Spaces, People).
 * Mirrors the visual language of the Spaces sidebar: shared `sidebar-header`
 * for the title row, `sidebar-row-chrome` for hover + accent-bar feedback.
 *
 * Collapsed mode reuses the same `__strip-row` pattern Spaces uses (centered
 * icon tile, tooltip on the right).
 */
export const DiscoverSidebar: React.FC<DiscoverSidebarProps> = ({ forceExpanded }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { sidebarCollapsed } = useShellState();
  const renderCollapsed = sidebarCollapsed && !forceExpanded;
  const sections = buildSections();

  const activeId: DiscoverSectionId = location.pathname.startsWith('/discover/people')
    ? 'people'
    : 'spaces';

  if (renderCollapsed) {
    return (
      <div className="discover-sidebar discover-sidebar--collapsed list-bottom-fade">
        <div className="discover-sidebar__header discover-sidebar__header--collapsed" />
        <div className="discover-sidebar__list list-fade-content">
          {sections.map((section) => {
            const active = activeId === section.id;
            return (
              <Tooltip
                key={section.id}
                id={`discover-sidebar-${section.id}`}
                content={section.label}
                place="right"
                showOnTouch={false}
              >
                <button
                  type="button"
                  className={[
                    'discover-sidebar__strip-row',
                    'sidebar-row-chrome',
                    active && 'discover-sidebar__strip-row--active',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => navigate(section.route)}
                  aria-label={section.label}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon name={section.icon} size="xl" />
                </button>
              </Tooltip>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="discover-sidebar list-bottom-fade">
      <div className="sidebar-header">
        <span className="sidebar-header__title">{t`Discover`}</span>
      </div>
      <div className="discover-sidebar__list list-fade-content">
        {sections.map((section) => {
          const active = activeId === section.id;
          return (
            <button
              key={section.id}
              type="button"
              className={[
                'discover-sidebar__row',
                'sidebar-row-chrome',
                active && 'discover-sidebar__row--active',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => navigate(section.route)}
              aria-current={active ? 'page' : undefined}
            >
              <Icon name={section.icon} size="lg" />
              <span className="discover-sidebar__row-label">{section.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default DiscoverSidebar;
