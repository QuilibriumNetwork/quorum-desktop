import React from 'react';
import { Link, useLocation } from 'react-router';
import { Flex, Icon, type IconName } from '../components/primitives';

interface DevNavItem {
  name: string;
  icon: IconName;
  path: string;
}

const devNavItems: DevNavItem[] = [
  {
    name: 'Home',
    icon: 'home',
    path: '/dev',
  },
  {
    name: 'Docs',
    icon: 'book',
    path: '/dev/docs',
  },
  {
    name: 'Issues',
    icon: 'clipboard-list',
    path: '/dev/issues',
  },
  {
    name: 'Reports',
    icon: 'clipboard',
    path: '/dev/reports',
  },
  {
    name: 'Playground',
    icon: 'flask',
    path: '/playground',
  },
  {
    name: 'Audit',
    icon: 'chart-line',
    path: '/dev/audit',
  },
  {
    name: 'DB Inspector',
    icon: 'database',
    path: '/dev/db-inspector',
  },
  {
    name: 'DM Doctor',
    icon: 'bug',
    path: '/dev/dm-doctor',
  },
  {
    name: 'Identity Coverage',
    icon: 'id-badge',
    path: '/dev/identity-coverage',
  },
  {
    name: 'Fake QNS',
    icon: 'at',
    path: '/dev/fake-qns',
  },
  {
    name: 'Error States',
    icon: 'skull',
    path: '/dev/error-states',
  },
];

interface DevNavMenuProps {
  /** Defaults to the live route. Pages should not pass this — the default is
   *  what keeps the highlight correct without every page remembering to. */
  currentPath?: string;
  sticky?: boolean;
}

export const DevNavMenu: React.FC<DevNavMenuProps> = ({
  currentPath,
  sticky = false,
}) => {
  const { pathname } = useLocation();
  const activePath = currentPath ?? pathname;

  return (
    <div
      className={`bg-surface-00 border-b border-default ${sticky ? 'sticky top-0 z-20' : ''}`}
    >
      <div className="p-2 mx-auto max-w-screen-2xl">
        <Flex gap="md" className="items-center justify-center">
          {devNavItems.map((item) => {
            const isActive = activePath === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2 px-2 py-1 rounded text-sm transition-colors ${
                  isActive
                    ? 'text-accent font-medium'
                    : 'text-subtle hover:text-main'
                }`}
              >
                <Icon name={item.icon} size="sm" variant="outline" />
                {item.name}
              </Link>
            );
          })}
        </Flex>
      </div>
    </div>
  );
};
