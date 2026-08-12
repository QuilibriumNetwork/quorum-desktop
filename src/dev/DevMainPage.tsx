import React from 'react';
import { Link } from 'react-router';
import { Icon, type IconName } from '../components/primitives';
import { DevPage, DevPageHeader } from './shell';

export const DevMainPage: React.FC = () => {
  const devTools: Array<{
    name: string;
    icon: IconName;
    description: string;
    path: string;
  }> = [
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
      path: '/dev/playground',
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
    {
      name: 'Error States',
      icon: 'skull',
      description:
        'What a user sees when a view fails to load. Real error boundaries wrapping children that really throw, so retry and recovery behave as they do in the app',
      path: '/dev/error-states',
    },
  ];

  return (
    <DevPage>
        <DevPageHeader
          icon="tools"
          title="Development Tools"
          subtitle="Instruments and browsers for working on Quorum. Development builds only."
        />

        {/* A single column of ten cards ran to 1597px, so the last three were
            always below the fold. `h-full` keeps a long description from making
            one card taller than its row neighbours. */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {devTools.map((tool, index) => (
            <Link
              key={index}
              to={tool.path}
              className="block h-full no-underline bg-surface-1 hover:bg-surface-2 rounded-lg p-5 border border-default hover:border-accent-rgb/50 hover:shadow-lg transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon name={tool.icon} size="lg" className="text-accent" />
                <span className="text-xl font-bold text-strong">
                  {tool.name}
                </span>
              </div>
              {/* Explicit colour: the card is an <a>, so anything without one
                  inherits the link blue and the description reads as accent. */}
              <p className="text-label text-subtle">{tool.description}</p>
            </Link>
          ))}
        </div>
    </DevPage>
  );
};
