import React from 'react';
import { Container, Text, FlexRow, FlexColumn, Button, Spacer, Icon } from '../components/primitives';
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
      name: 'Tasks',
      icon: 'clipboard-list',
      description: 'View development tasks and implementation plans',
      path: '/dev/tasks',
    },
    {
      name: 'Bug Reports',
      icon: 'bug',
      description: 'Browse bug reports and known issues',
      path: '/dev/bugs',
    },
    {
      name: 'Primitives Playground',
      icon: 'flask',
      description: 'Test and preview all primitive components with color palette',
      path: '/playground',
    },
    {
      name: 'Component Audit',
      icon: 'chart-line',
      description: 'Detailed status of all components migration',
      path: '/dev/audit',
    },
  ];

  const handleNavigate = (path: string) => {
    window.location.href = path;
  };


  return (
    <Container className="min-h-screen bg-app">
      <DevNavMenu currentPath="/dev" />
      <Container padding="lg" className="mx-auto max-w-2xl">
        <div className="text-center my-12">
          <FlexRow justify="center" gap="sm" className="mb-4">
            <Icon name="tools" size="2xl" className="text-strong" />
            <Text
              as="h1"
              variant="strong"
              size="3xl"
              weight="bold"
            >
              Development Tools
            </Text>
          </FlexRow>
        </div>

        {/* Development Tools List */}
        <div className="space-y-4 mb-8">
          {devTools.map((tool, index) => (
            <div
              key={index}
              onClick={() => handleNavigate(tool.path)}
              className="bg-surface-1 hover:bg-surface-2 rounded-lg p-6 border border-default hover:border-accent/50 hover:shadow-lg transition-all cursor-pointer"
            >
              <FlexRow gap="sm" align="center" className="mb-2">
                <Icon name={tool.icon} size="md" className="text-accent" />
                <Text variant="strong" size="lg">
                  {tool.name}
                </Text>
              </FlexRow>
              <Text variant="main" size="sm">
                {tool.description}
              </Text>
            </div>
          ))}
        </div>
      </Container>
    </Container>
  );
};
