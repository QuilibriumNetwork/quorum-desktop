import React from 'react';
import { Container, Flex, Icon } from '../components/primitives';

interface DevNavItem {
  name: string;
  icon: string;
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
    name: 'Tasks',
    icon: 'clipboard-list',
    path: '/dev/tasks',
  },
  {
    name: 'Bugs',
    icon: 'bug',
    path: '/dev/bugs',
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
];

interface DevNavMenuProps {
  currentPath?: string;
  sticky?: boolean;
}

export const DevNavMenu: React.FC<DevNavMenuProps> = ({
  currentPath,
  sticky = false,
}) => {
  return (
    <div
      className={`bg-surface-00 border-b border-default ${sticky ? 'sticky top-0 z-20' : ''}`}
    >
      <Container padding="sm" className="mx-auto max-w-screen-2xl">
        <Flex gap="md" className="items-center justify-center">
          {devNavItems.map((item) => {
            const isActive = currentPath === item.path;
            return (
              <a
                key={item.path}
                href={item.path}
                className={`flex items-center gap-2 px-2 py-1 rounded text-sm transition-colors ${
                  isActive
                    ? 'text-accent font-medium'
                    : 'text-subtle hover:text-main'
                }`}
              >
                <Icon name={item.icon} size="sm" variant="outline" />
                {item.name}
              </a>
            );
          })}
        </Flex>
      </Container>
    </div>
  );
};
