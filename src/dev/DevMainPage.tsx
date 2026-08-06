import React from 'react';
import {
  Text,
  Flex,
  Button,
  Spacer,
  Icon,
} from '../components/primitives';
import { DevNavMenu } from './DevNavMenu';

export const DevMainPage: React.FC = () => {
  const devTools = [
    {
      name: 'Documentation',
      icon: 'book',
      description: 'Browse project documentation and guides',
      path: '/dev/docs',
    },
    {
      name: 'Issues',
      icon: 'clipboard-list',
      description:
        'Bugs and tasks, filterable by type, state, priority and complexity',
      path: '/dev/issues',
    },
    {
      name: 'Reports & Audits',
      icon: 'clipboard',
      description: 'Security audits, research and analysis reports',
      path: '/dev/reports',
    },
    {
      name: 'Primitives Playground',
      icon: 'flask',
      description:
        'Test and preview all primitive components with color palette',
      path: '/playground',
    },
    {
      name: 'Component Audit',
      icon: 'chart-line',
      description: 'Detailed status of all components migration',
      path: '/dev/audit',
    },
    {
      name: 'DB Inspector',
      icon: 'database',
      description: 'Browse IndexedDB with redacted sensitive data',
      path: '/dev/db-inspector',
    },
    {
      name: 'DM Doctor',
      icon: 'bug',
      description:
        'Numbered-burst sequence scan, receive-path warning counters, and ghost-conversation detection for the DM-loss investigation',
      path: '/dev/dm-doctor',
    },
    {
      name: 'Identity Coverage',
      icon: 'id-badge',
      description:
        'How many space members and DM partners carry no identity from any source, and therefore render as a truncated address. Take one snapshot before a change and one after',
      path: '/dev/identity-coverage',
    },
    {
      name: 'Fake QNS',
      icon: 'at',
      description:
        'Synthesize QNS .q names so every surface that renders one is reachable without owning a registered name. Read-side overlay: nothing is published',
      path: '/dev/fake-qns',
    },
  ];

  const handleNavigate = (path: string) => {
    window.location.href = path;
  };

  return (
    <div className="min-h-screen bg-app">
      <DevNavMenu currentPath="/dev" />
      <div className="p-6 mx-auto max-w-2xl">
        <div className="text-center my-12">
          <Flex justify="center" gap="sm" className="mb-4">
            <Icon name="tools" size="2xl" className="text-strong" />
            <Text as="h1" variant="strong" size="3xl" weight="bold">
              Development Tools
            </Text>
          </Flex>
        </div>

        {/* Development Tools List */}
        <div className="space-y-4 mb-8">
          {devTools.map((tool, index) => (
            <div
              key={index}
              onClick={() => handleNavigate(tool.path)}
              className="bg-surface-1 hover:bg-surface-2 rounded-lg p-6 border border-default hover:border-accent/50 hover:shadow-lg transition-all cursor-pointer"
            >
              <Flex gap="sm" align="center" className="mb-2">
                <Icon name={tool.icon} size="md" className="text-accent" />
                <Text variant="strong" size="lg">
                  {tool.name}
                </Text>
              </Flex>
              <Text variant="main" size="sm">
                {tool.description}
              </Text>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
