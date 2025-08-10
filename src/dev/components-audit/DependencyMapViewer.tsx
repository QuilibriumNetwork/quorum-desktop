import React, { useState, useMemo } from 'react';
import dependencyData from './dependency-map.json';
import {
  Input,
  Select,
  Button,
  FlexRow,
  FlexColumn,
  Container,
  Text,
  Icon,
} from '../../components/primitives';
import { DevNavMenu } from '../DevNavMenu';

interface ComponentDependency {
  name: string;
  dependencies?: string[];
  status: 'shared' | 'needs_native' | 'web_only' | 'electron_only' | 'disabled' | 'deleted';
  mobile_ready?: boolean;
  notes: string;
}

interface DependencyLevel {
  description: string;
  count: number;
  components: (ComponentDependency | string)[];
  mobile_status?: string;
  priority: string;
}

interface DependencyData {
  metadata: {
    created: string;
    description: string;
    purpose: string;
    analysis_basis: string;
  };
  dependency_levels: Record<string, DependencyLevel>;
  mobile_development_strategy: {
    [key: string]: {
      description: string;
      components_count: number;
      estimated_effort: string;
      status: string;
      priority_order?: string[];
      next_action?: string;
      notes?: string;
    };
  };
  immediate_next_steps: {
    current_phase: string;
    ready_to_build: {
      name: string;
      reason: string;
      effort: string;
      notes: string;
    }[];
  };
}

const PriorityBadge: React.FC<{ priority: string }> = ({ priority }) => {
  const getPriorityClass = () => {
    switch (priority.toLowerCase()) {
      case 'highest':
        return 'bg-red-500/70 text-white';
      case 'high':
        return 'bg-orange-500/70 text-white';
      case 'medium-high':
        return 'bg-yellow-500/70 text-black';
      case 'medium':
        return 'bg-blue-500/70 text-white';
      case 'low-medium':
        return 'bg-indigo-500/70 text-white';
      case 'lowest':
        return 'bg-gray-500/70 text-white';
      default:
        return 'bg-gray-400/70 text-white';
    }
  };

  return (
    <Text
      className={`px-2 py-1 rounded text-xs font-medium ${getPriorityClass()}`}
    >
      {priority}
    </Text>
  );
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const getStatusClass = () => {
    if (status.includes('COMPLETE')) {
      return 'bg-green-500/70 text-white';
    }
    if (status.includes('IN PROGRESS')) {
      return 'bg-yellow-500/70 text-black';
    }
    if (status.includes('PARTIAL')) {
      return 'bg-blue-500/70 text-white';
    }
    if (status.includes('NOT STARTED')) {
      return 'bg-red-500/70 text-white';
    }
    return 'bg-gray-500/70 text-white';
  };

  return (
    <Text
      className={`px-2 py-1 rounded text-xs font-medium ${getStatusClass()}`}
    >
      {status}
    </Text>
  );
};

const MobileReadyBadge: React.FC<{ ready?: boolean }> = ({ ready }) => {
  if (ready === undefined) return null;

  return (
    <FlexRow
      gap="xs"
      className={`px-2 py-1 rounded text-xs font-medium inline-flex items-center ${
        ready
          ? 'bg-green-500/70 text-white'
          : 'bg-orange-500/70 text-white'
      }`}
    >
      <Icon name={ready ? "mobile" : "sync"} size="xs" />
      <Text className="text-xs font-medium">
        {ready ? 'Mobile Ready' : 'Needs Mobile'}
      </Text>
    </FlexRow>
  );
};

const ComponentCard: React.FC<{
  component: ComponentDependency | string;
  level: number;
}> = ({ component, level }) => {
  const isString = typeof component === 'string';
  const comp = isString ? { name: component, notes: '', status: 'platform_specific' as const } : component;

  return (
    <div className="bg-surface-1 rounded-lg p-3 border border-default hover:border-accent/50 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <Text variant="strong" size="sm" weight="medium">
          {comp.name}
        </Text>
        <div className="flex gap-1">
          {!isString && <MobileReadyBadge ready={comp.mobile_ready} />}
          <Text
            className={`px-2 py-1 rounded text-xs font-medium ${
              comp.status === 'shared' ? 'bg-purple-500/70 text-white' :
              comp.status === 'needs_native' ? 'bg-orange-500/70 text-white' :
              comp.status === 'web_only' ? 'bg-blue-500/70 text-white' :
              comp.status === 'electron_only' ? 'bg-gray-500/70 text-white' :
              comp.status === 'disabled' ? 'bg-yellow-500/70 text-black' :
              comp.status === 'deleted' ? 'bg-red-500/70 text-white' :
              'bg-yellow-600/70 text-white'
            }`}
          >
            {comp.status === 'shared' ? 'Shared' : 
             comp.status === 'needs_native' ? 'Needs Native' :
             comp.status === 'web_only' ? 'Web Only' :
             comp.status === 'electron_only' ? 'Electron Only' :
             comp.status === 'disabled' ? 'Disabled' :
             comp.status === 'deleted' ? 'Deleted' : 'Platform'}
          </Text>
        </div>
      </div>
      
      {!isString && comp.dependencies && comp.dependencies.length > 0 && (
        <div className="mb-2">
          <Text variant="subtle" size="xs" className="mb-1">
            Dependencies:
          </Text>
          <div className="flex flex-wrap gap-1">
            {comp.dependencies.slice(0, 3).map((dep, idx) => (
              <Text
                key={idx}
                className="px-1.5 py-0.5 bg-accent/10 text-accent-600 dark:text-accent-400 rounded text-xs"
              >
                {dep}
              </Text>
            ))}
            {comp.dependencies.length > 3 && (
              <Text className="px-1.5 py-0.5 bg-surface-2 text-subtle rounded text-xs">
                +{comp.dependencies.length - 3}
              </Text>
            )}
          </div>
        </div>
      )}
      
      <Text variant="subtle" size="xs" className="line-clamp-2">
        {comp.notes}
      </Text>
    </div>
  );
};

const DependencyLevelSection: React.FC<{
  level: string;
  data: DependencyLevel;
  expanded: boolean;
  onToggle: () => void;
}> = ({ level, data, expanded, onToggle }) => {
  const levelNumber = level.replace('level_', '').replace('_', ' ');
  
  return (
    <div className="bg-surface-1 rounded-lg border border-default overflow-hidden">
      <div 
        className="px-4 py-3 cursor-pointer hover:bg-surface-2/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Text variant="strong" size="lg" weight="medium">
              {levelNumber.charAt(0).toUpperCase() + levelNumber.slice(1)}
            </Text>
            <PriorityBadge priority={data.priority} />
            <Text
              className="px-2 py-1 rounded text-xs font-medium bg-surface-2 text-strong"
            >
              {data.count} components
            </Text>
          </div>
          <Text variant="subtle" size="sm">
            {expanded ? '▼' : '▶'}
          </Text>
        </div>
        <Text variant="subtle" size="sm" className="mt-1">
          {data.description}
        </Text>
        {data.mobile_status && (
          <Text variant="muted" size="xs" className="mt-1">
            {data.mobile_status}
          </Text>
        )}
      </div>
      
      {expanded && (
        <div className="px-4 pb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {data.components.map((component, idx) => (
              <ComponentCard
                key={idx}
                component={component}
                level={parseInt(level.match(/\d+/)?.[0] || '0')}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const PhaseCard: React.FC<{
  phase: string;
  data: {
    description: string;
    components_count: number;
    estimated_effort: string;
    status: string;
    priority_order?: string[];
    next_action?: string;
    notes?: string;
  };
}> = ({ phase, data }) => {
  return (
    <div className="bg-surface-1 rounded-lg p-4 border border-default">
      <div className="flex items-start justify-between mb-3">
        <Text variant="strong" size="md" weight="medium">
          {phase.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
        </Text>
        <StatusBadge status={data.status} />
      </div>
      
      <Text variant="main" size="sm" className="mb-3">
        {data.description}
      </Text>
      
      <div className="space-y-2 mb-3">
        <div className="flex justify-between">
          <Text variant="subtle" size="xs">Components:</Text>
          <Text variant="strong" size="xs">{data.components_count}</Text>
        </div>
        <div className="flex justify-between">
          <Text variant="subtle" size="xs">Estimated Effort:</Text>
          <Text variant="strong" size="xs">{data.estimated_effort}</Text>
        </div>
      </div>
      
      {data.next_action && (
        <div className="mb-3">
          <Text variant="subtle" size="xs" className="mb-1">Next Action:</Text>
          <Text variant="main" size="xs" className="bg-accent/10 p-2 rounded">
            {data.next_action}
          </Text>
        </div>
      )}
      
      {data.priority_order && data.priority_order.length > 0 && (
        <div>
          <Text variant="subtle" size="xs" className="mb-1">Priority Order:</Text>
          <div className="space-y-1">
            {data.priority_order.slice(0, 3).map((item, idx) => (
              <Text key={idx} variant="main" size="xs" className="block">
                {idx + 1}. {item}
              </Text>
            ))}
            {data.priority_order.length > 3 && (
              <Text variant="subtle" size="xs">
                +{data.priority_order.length - 3} more...
              </Text>
            )}
          </div>
        </div>
      )}
      
      {data.notes && (
        <div className="mt-3 pt-3 border-t border-default">
          <Text variant="subtle" size="xs">{data.notes}</Text>
        </div>
      )}
    </div>
  );
};

export const DependencyMapViewer: React.FC = () => {
  const data = dependencyData as DependencyData;
  const [expandedLevels, setExpandedLevels] = useState<Set<string>>(new Set());
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const toggleLevel = (level: string) => {
    const newExpanded = new Set(expandedLevels);
    if (newExpanded.has(level)) {
      newExpanded.delete(level);
    } else {
      newExpanded.add(level);
    }
    setExpandedLevels(newExpanded);
  };

  const expandAll = () => {
    setExpandedLevels(new Set(Object.keys(data.dependency_levels)));
  };

  const collapseAll = () => {
    setExpandedLevels(new Set());
  };

  const filteredLevels = useMemo(() => {
    return Object.entries(data.dependency_levels).filter(([key, level]) => {
      const matchesFilter = filterLevel === 'all' || key.includes(filterLevel);
      const matchesSearch = searchTerm === '' || 
        level.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        level.components.some(comp => 
          (typeof comp === 'string' ? comp : comp.name)
            .toLowerCase()
            .includes(searchTerm.toLowerCase())
        );
      return matchesFilter && matchesSearch;
    });
  }, [data.dependency_levels, filterLevel, searchTerm]);

  return (
    <Container className="min-h-screen bg-app overflow-y-auto">
      <DevNavMenu currentPath="/dev/dependencies" />
      <Container padding="lg" className="mx-auto max-w-screen-2xl">
        <Text
          as="h1"
          variant="strong"
          size="3xl"
          weight="bold"
          className="my-6"
        >
          Component Dependency Map
        </Text>

        <div className="bg-surface-1 rounded-lg p-4 border border-default mb-6">
          <FlexRow gap="sm" className="mb-2 items-center">
            <Icon name="chart-line" size="md" className="text-accent" />
            <Text variant="strong" size="md">
              Analysis Overview
            </Text>
          </FlexRow>
          <Text variant="main" size="sm" className="mb-2">
            {data.metadata.description}
          </Text>
          <Text variant="subtle" size="xs">
            Based on: {data.metadata.analysis_basis} • Generated: {data.metadata.created}
          </Text>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          {Object.entries(data.dependency_levels).map(([key, level]) => (
            <div key={key} className="bg-surface-1 rounded-lg p-3 border border-default text-center">
              <Text variant="strong" size="lg">{level.count}</Text>
              <Text variant="subtle" size="xs" className="block">
                {key.replace('level_', '').replace('_', ' ')}
              </Text>
              <PriorityBadge priority={level.priority} />
            </div>
          ))}
        </div>

        {/* Immediate Next Steps */}
        <div className="bg-accent/10 rounded-lg p-4 border border-accent/30 mb-6">
          <FlexRow gap="sm" className="mb-3 items-center">
            <Icon name="rocket" size="md" className="text-accent-700 dark:text-accent-300" />
            <Text variant="strong" size="md" className="text-accent-700 dark:text-accent-300">
              Ready to Build Now
            </Text>
          </FlexRow>
          <Text variant="subtle" size="sm" className="mb-3">
            Current Phase: {data.immediate_next_steps.current_phase}
          </Text>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.immediate_next_steps.ready_to_build.map((item, idx) => (
              <div key={idx} className="bg-white/50 dark:bg-black/20 rounded p-3">
                <Text variant="strong" size="sm" className="mb-1">{item.name}</Text>
                <FlexRow gap="xs" className="mb-1 items-center">
                  <Icon name="clock" size="xs" className="text-subtle" />
                  <Text variant="subtle" size="xs">{item.effort}</Text>
                </FlexRow>
                <Text variant="main" size="xs">{item.reason}</Text>
              </div>
            ))}
          </div>
        </div>

        {/* Filters & Controls */}
        <FlexRow gap="md" className="mb-6" wrap>
          <FlexColumn className="min-w-[200px]">
            <Text variant="subtle" size="xs" className="mb-1">Search</Text>
            <Input
              type="text"
              placeholder="Search levels or components..."
              variant="bordered"
              value={searchTerm}
              onChange={(value: string) => setSearchTerm(value)}
            />
          </FlexColumn>
          
          <FlexColumn className="min-w-[150px]">
            <Text variant="subtle" size="xs" className="mb-1">Filter Level</Text>
            <Select
              variant="bordered"
              value={filterLevel}
              onChange={(value: string) => setFilterLevel(value)}
              options={[
                { value: 'all', label: 'All Levels' },
                { value: '0', label: 'Level 0 (Primitives)' },
                { value: '1', label: 'Level 1 (Simple)' },
                { value: '2', label: 'Level 2 (Moderate)' },
                { value: '3', label: 'Level 3 (Complex)' },
                { value: '4', label: 'Level 4 (Very Complex)' },
                { value: '5', label: 'Level 5 (Super Complex)' },
              ]}
            />
          </FlexColumn>
          
          <FlexRow gap="sm" className="items-end">
            <Button type="subtle" size="small" onClick={expandAll}>
              Expand All
            </Button>
            <Button type="subtle" size="small" onClick={collapseAll}>
              Collapse All
            </Button>
          </FlexRow>
        </FlexRow>

        {/* Dependency Levels */}
        <div className="space-y-4 mb-8">
          {filteredLevels.map(([key, level]) => (
            <DependencyLevelSection
              key={key}
              level={key}
              data={level}
              expanded={expandedLevels.has(key)}
              onToggle={() => toggleLevel(key)}
            />
          ))}
        </div>

        {/* Development Strategy */}
        <div className="mb-8">
          <FlexRow gap="sm" className="mb-4 items-center">
            <Icon name="map" size="lg" className="text-strong" />
            <Text
              as="h2"
              variant="strong"
              size="2xl"
              weight="bold"
            >
              Mobile Development Strategy
            </Text>
          </FlexRow>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(data.mobile_development_strategy).map(([key, phase]) => (
              <PhaseCard key={key} phase={key} data={phase} />
            ))}
          </div>
        </div>

        {/* Navigation */}
        <FlexRow justify="center" className="mt-8 gap-4">
          <a
            href="/dev/audit"
            className="text-accent hover:text-accent-600 underline"
          >
            View Component Audit →
          </a>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="text-accent hover:text-accent-600 underline"
          >
            ↑ Back to Top
          </a>
        </FlexRow>
      </Container>
    </Container>
  );
};