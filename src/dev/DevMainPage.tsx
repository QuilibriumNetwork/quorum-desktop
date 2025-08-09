import React from 'react';
import { Container, Text, FlexRow, FlexColumn, Button, Spacer, Icon } from '../components/primitives';
import { DevNavMenu } from './DevNavMenu';

export const DevMainPage: React.FC = () => {
  const devTools = [
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
    {
      name: 'Dependency Map',
      icon: 'map',
      description: 'Visual roadmap for mobile component development',
      path: '/dev/dependencies',
    }
  ];

  const handleNavigate = (path: string) => {
    window.location.href = path;
  };


  return (
    <Container className="min-h-screen bg-app">
      <DevNavMenu currentPath="/dev" />
      <Container padding="lg" className="mx-auto max-w-4xl">
        <div className="text-center mb-8">
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
          <Text variant="main" size="lg" className="mb-2">
            Cross-Platform Component Development Suite
          </Text>
          <Text variant="subtle">
            Tools for building and managing web + mobile components
          </Text>
        </div>

        {/* Development Tools List */}
        <div className="space-y-4 mb-8">
          {devTools.map((tool, index) => (
            <div
              key={index}
              className="bg-surface-1 rounded-lg p-6 border border-default hover:border-accent/50 hover:shadow-lg transition-all"
            >
              <FlexRow justify="between" align="center" className="w-full">
                <FlexColumn align="start" className="flex-1">
                  <FlexRow gap="sm" align="center" className="mb-2">
                    <Icon name={tool.icon} size="md" className="text-accent" />
                    <Text variant="strong" size="lg">
                      {tool.name}
                    </Text>
                  </FlexRow>
                  <Text variant="main" size="sm">
                    {tool.description}
                  </Text>
                </FlexColumn>
                <Button
                  type="primary"
                  size="small"
                  onClick={() => handleNavigate(tool.path)}
                >
                  Open Tool
                </Button>
              </FlexRow>
            </div>
          ))}
        </div>
      </Container>
    </Container>
  );
};
