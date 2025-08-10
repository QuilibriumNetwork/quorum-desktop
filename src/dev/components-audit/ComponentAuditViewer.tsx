import React, { useState, useMemo } from 'react';
import auditData from './audit.json';
import {
  Input,
  Select,
  Button,
  FlexRow,
  FlexColumn,
  Container,
  Text,
} from '../../components/primitives';
import { DevNavMenu } from '../DevNavMenu';

type AuditStatus =
  | 'todo'
  | 'in_progress'
  | 'done'
  | 'ready'
  | 'partial'
  | 'unknown'
  | 'keep'
  | 'extract'
  | 'not_needed';
  
type ComponentCategory =
  | 'shared'
  | 'platform_specific'
  | 'complex_refactor'
  | 'unknown';

type ComplexityCategory =
  | 'basic'
  | 'simple'
  | 'medium'
  | 'complex';

interface ComponentAudit {
  name: string;
  path: string;
  description: string;
  category: ComponentCategory;
  used: string;
  primitives: AuditStatus;
  logic_extraction: AuditStatus;
  hooks: string[];
  native: AuditStatus;
  notes: string;
  updated: string;
  // New dependency fields
  dependencies?: string[];
  dependency_level?: number;
  complexity_category?: ComplexityCategory;
}

interface AuditData {
  components: Record<string, ComponentAudit>;
  stats: {
    total: number;
    primitives_done: number;
    logic_extraction_done: number;
    native_ready: number;
    native_done: number;
    by_category: {
      shared: number;
      platform_specific: number;
      complex_refactor: number;
    };
    by_usage: {
      yes: number;
      no: number;
      unknown: number;
      suspended?: number;
    };
    analysis_notes: string;
    last_updated: string;
  };
  metadata: {
    audit_version: string;
    last_full_scan: string | null;
    scan_scope: string[];
    unified_version?: string;
    migration_date?: string;
    includes_dependencies?: boolean;
  };
  dependency_hierarchy?: {
    basic: { count: number; components: string[] };
    simple: { count: number; components: string[] };
    medium: { count: number; components: string[] };
    complex: { count: number; components: string[] };
  };
  mobile_strategy?: {
    current_phase: string;
    ready_to_build: Array<{
      name: string;
      reason: string;
      effort: string;
      notes: string;
    }>;
    phases_summary: {
      primitives_complete: string;
      simple_components_complete: string;
      moderate_components_current: string;
      next_priority: string;
    };
  };
}

const StatusBadge: React.FC<{
  status: AuditStatus;
  context?: 'native' | 'default';
}> = ({ status, context = 'default' }) => {
  const getStatusClass = () => {
    // Special colors for native category
    if (context === 'native') {
      switch (status) {
        case 'done':
          return 'bg-blue-500/70 text-white';
        case 'ready':
          return 'bg-green-500/70 text-white';
        case 'todo':
          return 'bg-red-500/70 text-white';
        case 'not_needed':
          return 'bg-gray-500/70 text-white';
        default:
          return 'bg-surface-2 text-muted';
      }
    }

    // Default colors for primitives and logic
    switch (status) {
      case 'done':
        return 'bg-green-500/70 text-white';
      case 'keep':
        return 'bg-green-500/70 text-white';
      case 'in_progress':
        return 'bg-yellow-500/70 text-black';
      case 'todo':
        return 'bg-red-500/70 text-white';
      case 'partial':
        return 'bg-green-500/70 text-white';
      case 'extract':
        return 'bg-red-500/70 text-white';
      case 'unknown':
        return 'bg-gray-500/70 text-white';
      default:
        return 'bg-surface-2 text-muted';
    }
  };

  const getStatusLabel = () => {
    if (status === 'partial' && context === 'default') {
      return 'done (partial)';
    }
    return status;
  };

  return (
    <Text
      className={`px-2 py-1 rounded text-xs font-medium ${getStatusClass()}`}
    >
      {getStatusLabel()}
    </Text>
  );
};

const CategoryBadge: React.FC<{ category: ComponentCategory }> = ({
  category,
}) => {
  const getCategoryClass = () => {
    switch (category) {
      case 'shared':
        return 'bg-purple-500/70 text-white';
      case 'platform_specific':
        return 'bg-yellow-600/70 text-white';
      case 'complex_refactor':
        return 'bg-red-500/70 text-white';
      default:
        return 'bg-gray-400/70 text-white';
    }
  };

  const getCategoryLabel = () => {
    switch (category) {
      case 'shared':
        return 'Shared';
      case 'platform_specific':
        return 'Platform Specific';
      case 'complex_refactor':
        return 'Complex Refactor';
      default:
        return 'Unknown';
    }
  };

  return (
    <Text
      className={`px-2 py-1 rounded text-xs font-medium ${getCategoryClass()}`}
    >
      {getCategoryLabel()}
    </Text>
  );
};

const UsageBadge: React.FC<{ used: string }> = ({ used }) => {
  const getUsageClass = () => {
    switch (used) {
      case 'yes':
        return 'bg-green-500/70 text-white';
      case 'no':
        return 'bg-red-500/70 text-white';
      case 'unknown':
        return 'bg-amber-500/70 text-white';
      case 'suspended':
        return 'bg-purple-500/70 text-white';
      default:
        return 'bg-gray-400/70 text-white';
    }
  };

  const getUsageLabel = () => {
    switch (used) {
      case 'yes':
        return 'Used';
      case 'no':
        return 'Unused';
      case 'unknown':
        return 'Unknown';
      case 'suspended':
        return 'Suspended';
      default:
        return 'Unknown';
    }
  };

  return (
    <Text
      className={`px-2 py-1 rounded text-xs font-medium ${getUsageClass()}`}
    >
      {getUsageLabel()}
    </Text>
  );
};

const ComplexityBadge: React.FC<{ complexity: ComplexityCategory | undefined }> = ({
  complexity,
}) => {
  if (!complexity) return null;

  const getComplexityClass = () => {
    switch (complexity) {
      case 'basic':
        return 'bg-green-600/70 text-white';
      case 'simple':
        return 'bg-blue-500/70 text-white';
      case 'medium':
        return 'bg-yellow-500/70 text-black';
      case 'complex':
        return 'bg-red-500/70 text-white';
      default:
        return 'bg-gray-400/70 text-white';
    }
  };

  const getComplexityLabel = () => {
    switch (complexity) {
      case 'basic':
        return 'Basic';
      case 'simple':
        return 'Simple';
      case 'medium':
        return 'Medium';
      case 'complex':
        return 'Complex';
      default:
        return 'Unknown';
    }
  };

  return (
    <Text
      className={`px-2 py-1 rounded text-xs font-medium ${getComplexityClass()}`}
    >
      {getComplexityLabel()}
    </Text>
  );
};

export const ComponentAuditViewer: React.FC = () => {
  const data = auditData as AuditData;
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<
    ComponentCategory | 'all'
  >('all');
  const [primitivesFilter, setPrimitivesFilter] = useState<AuditStatus | 'all'>(
    'all'
  );
  const [logicFilter, setLogicFilter] = useState<AuditStatus | 'all'>('all');
  const [nativeFilter, setNativeFilter] = useState<AuditStatus | 'all'>('all');
  const [usageFilter, setUsageFilter] = useState<
    'yes' | 'no' | 'unknown' | 'suspended' | 'all'
  >('all');
  const [complexityFilter, setComplexityFilter] = useState<
    ComplexityCategory | 'all'
  >('all');
  const [viewMode, setViewMode] = useState<'table' | 'hierarchy'>('table');
  const [sortOrder, setSortOrder] = useState<'alphabetical' | 'reverse' | 'dependency'>(
    'alphabetical'
  );
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const clearAllFilters = () => {
    setSearchTerm('');
    setCategoryFilter('all');
    setPrimitivesFilter('all');
    setLogicFilter('all');
    setNativeFilter('all');
    setUsageFilter('all');
    setComplexityFilter('all');
    setSortOrder('alphabetical');
  };

  const filteredComponents = useMemo(() => {
    const filtered = Object.entries(data.components).filter(
      ([key, component]) => {
        const matchesSearch =
          component.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          component.path.toLowerCase().includes(searchTerm.toLowerCase()) ||
          component.description
            .toLowerCase()
            .includes(searchTerm.toLowerCase());

        const matchesCategory =
          categoryFilter === 'all' || component.category === categoryFilter;

        const matchesPrimitives =
          primitivesFilter === 'all' ||
          component.primitives === primitivesFilter;
        const matchesLogic =
          logicFilter === 'all' || component.logic_extraction === logicFilter;
        const matchesNative =
          nativeFilter === 'all' || component.native === nativeFilter;

        const matchesUsage =
          usageFilter === 'all' || component.used === usageFilter;

        const matchesComplexity =
          complexityFilter === 'all' || component.complexity_category === complexityFilter;

        return (
          matchesSearch &&
          matchesCategory &&
          matchesPrimitives &&
          matchesLogic &&
          matchesNative &&
          matchesUsage &&
          matchesComplexity
        );
      }
    );

    // Apply sorting
    if (sortOrder === 'alphabetical') {
      return filtered.sort(([, a], [, b]) => a.name.localeCompare(b.name));
    } else if (sortOrder === 'reverse') {
      return filtered.sort(([, a], [, b]) => b.name.localeCompare(a.name));
    } else if (sortOrder === 'dependency') {
      return filtered.sort(([, a], [, b]) => {
        const aLevel = a.dependency_level ?? 0;
        const bLevel = b.dependency_level ?? 0;
        if (aLevel === bLevel) {
          return a.name.localeCompare(b.name);
        }
        return aLevel - bLevel;
      });
    }
    return filtered;
  }, [
    data.components,
    searchTerm,
    categoryFilter,
    primitivesFilter,
    logicFilter,
    nativeFilter,
    usageFilter,
    complexityFilter,
    sortOrder,
  ]);

  const toggleRowExpansion = (componentKey: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(componentKey)) {
      newExpanded.delete(componentKey);
    } else {
      newExpanded.add(componentKey);
    }
    setExpandedRows(newExpanded);
  };

  const calculateProgress = (component: ComponentAudit): number => {
    let progress = 0;
    const total = 3;

    if (component.primitives === 'done' || component.primitives === 'partial')
      progress++;
    // Count logic extraction as complete if 'done' or 'keep'
    if (
      component.logic_extraction === 'done' ||
      component.logic_extraction === 'keep'
    )
      progress++;
    if (component.native === 'ready') progress++;

    return (progress / total) * 100;
  };

  return (
    <Container className="min-h-screen bg-app overflow-y-auto">
      <DevNavMenu currentPath={window.location.pathname} />
      <Container padding="lg" className="w-full">
        <Text
          as="h1"
          variant="strong"
          size="3xl"
          weight="bold"
          className="my-6"
        >
          Component Audit Dashboard
        </Text>

        {/* Stats Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
          <div className="bg-surface-1 rounded-lg p-4 border border-default">
            <Text
              as="h3"
              variant="subtle"
              size="sm"
              weight="medium"
              className="mb-2"
            >
              Total Components
            </Text>
            <Text variant="strong" size="2xl" weight="bold">
              {data.stats.total}
            </Text>
          </div>

          <div className="bg-surface-1 rounded-lg p-4 border border-default">
            <Text
              as="h3"
              variant="subtle"
              size="sm"
              weight="medium"
              className="mb-2"
            >
              Primitives Migrated
            </Text>
            <Text variant="strong" size="2xl" weight="bold">
              {data.stats.primitives_done}/{data.stats.total}
            </Text>
            <div className="mt-2 bg-surface-3 rounded-full h-2 overflow-hidden">
              <div
                className="bg-accent h-full transition-all duration-300"
                style={{
                  width: `${(data.stats.primitives_done / data.stats.total) * 100}%`,
                }}
              />
            </div>
          </div>

          <div className="bg-surface-1 rounded-lg p-4 border border-default">
            <Text
              as="h3"
              variant="subtle"
              size="sm"
              weight="medium"
              className="mb-2"
            >
              Logic Extracted
            </Text>
            <Text variant="strong" size="2xl" weight="bold">
              {data.stats.logic_extraction_done}/{data.stats.total}
            </Text>
            <div className="mt-2 bg-surface-3 rounded-full h-2 overflow-hidden">
              <div
                className="bg-success h-full transition-all duration-300"
                style={{
                  width: `${(data.stats.logic_extraction_done / data.stats.total) * 100}%`,
                }}
              />
            </div>
          </div>

          <div className="bg-surface-1 rounded-lg p-4 border border-default">
            <Text
              as="h3"
              variant="subtle"
              size="sm"
              weight="medium"
              className="mb-2"
            >
              Native Done
            </Text>
            <Text variant="strong" size="2xl" weight="bold">
              {data.stats.native_done}/{data.stats.total}
            </Text>
            <div className="mt-2 bg-surface-3 rounded-full h-2 overflow-hidden">
              <div
                className="bg-success h-full transition-all duration-300"
                style={{
                  width: `${(data.stats.native_done / data.stats.total) * 100}%`,
                }}
              />
            </div>
          </div>

          <div className="bg-surface-1 rounded-lg p-4 border border-default">
            <Text
              as="h3"
              variant="subtle"
              size="sm"
              weight="medium"
              className="mb-2"
            >
              Native Ready (Tested)
            </Text>
            <Text variant="strong" size="2xl" weight="bold">
              {data.stats.native_ready}/{data.stats.total}
            </Text>
            <div className="mt-2 bg-surface-3 rounded-full h-2 overflow-hidden">
              <div
                className="bg-info h-full transition-all duration-300"
                style={{
                  width: `${(data.stats.native_ready / data.stats.total) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Category & Usage Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-3 2xl:grid-cols-6 gap-4 mb-8">
          <div className="bg-surface-1 rounded-lg p-4 border border-default">
            <h3 className="text-sm font-medium text-subtle mb-2">
              Shared Components
            </h3>
            <p className="text-xl font-bold text-strong">
              {data.stats.by_category.shared}
            </p>
          </div>
          <div className="bg-surface-1 rounded-lg p-4 border border-default">
            <h3 className="text-sm font-medium text-subtle mb-2">
              Platform Specific
            </h3>
            <p className="text-xl font-bold text-strong">
              {data.stats.by_category.platform_specific}
            </p>
          </div>
          <div className="bg-surface-1 rounded-lg p-4 border border-default">
            <h3 className="text-sm font-medium text-subtle mb-2">
              Complex Refactor
            </h3>
            <p className="text-xl font-bold text-strong">
              {data.stats.by_category.complex_refactor}
            </p>
          </div>
          <div className="bg-surface-1 rounded-lg p-4 border border-default">
            <h3 className="text-sm font-medium text-subtle mb-2">
              Used Components
            </h3>
            <p className="text-xl font-bold text-success">
              {data.stats.by_usage?.yes || 0}
            </p>
            <p className="text-xs text-subtle">Active in codebase</p>
          </div>
          <div className="bg-surface-1 rounded-lg p-4 border border-default">
            <h3 className="text-sm font-medium text-subtle mb-2">
              Unused Components
            </h3>
            <p className="text-xl font-bold text-danger">
              {data.stats.by_usage?.no || 0}
            </p>
            <p className="text-xs text-subtle">Can be deleted</p>
          </div>
          <div className="bg-surface-1 rounded-lg p-4 border border-default">
            <h3 className="text-sm font-medium text-subtle mb-2">
              Unknown Usage
            </h3>
            <p className="text-xl font-bold text-warning">
              {data.stats.by_usage?.unknown || 0}
            </p>
            <p className="text-xs text-subtle">Needs analysis</p>
          </div>
        </div>

        {/* Complexity Breakdown */}
        {data.dependency_hierarchy && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-surface-1 rounded-lg p-4 border border-default">
              <h3 className="text-sm font-medium text-subtle mb-2">
                Basic Components
              </h3>
              <p className="text-xl font-bold text-success">
                {data.dependency_hierarchy.basic.count}
              </p>
              <p className="text-xs text-subtle">Base components</p>
            </div>
            <div className="bg-surface-1 rounded-lg p-4 border border-default">
              <h3 className="text-sm font-medium text-subtle mb-2">
                Simple Components
              </h3>
              <p className="text-xl font-bold text-info">
                {data.dependency_hierarchy.simple.count}
              </p>
              <p className="text-xs text-subtle">1-3 dependencies</p>
            </div>
            <div className="bg-surface-1 rounded-lg p-4 border border-default">
              <h3 className="text-sm font-medium text-subtle mb-2">
                Medium Components
              </h3>
              <p className="text-xl font-bold text-warning">
                {data.dependency_hierarchy.medium.count}
              </p>
              <p className="text-xs text-subtle">4-6 dependencies</p>
            </div>
            <div className="bg-surface-1 rounded-lg p-4 border border-default">
              <h3 className="text-sm font-medium text-subtle mb-2">
                Complex Components
              </h3>
              <p className="text-xl font-bold text-danger">
                {data.dependency_hierarchy.complex.count}
              </p>
              <p className="text-xs text-subtle">7+ dependencies</p>
            </div>
          </div>
        )}

        {/* Ready to Build Panel */}
        {data.mobile_strategy && (
          <div className="bg-accent/10 rounded-lg p-4 border border-accent/30 mb-6">
            <FlexRow gap="sm" className="mb-3 items-center">
              <Text variant="strong" size="md" className="text-accent-700 dark:text-accent-300">
                🚀 Ready to Build Now - {data.mobile_strategy.current_phase}
              </Text>
            </FlexRow>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {data.mobile_strategy.ready_to_build.map((item, idx) => (
                <div key={idx} className="bg-white/50 dark:bg-black/20 rounded p-3">
                  <Text variant="strong" size="sm" className="mb-1">{item.name}</Text>
                  <FlexRow gap="xs" className="mb-1 items-center">
                    <Text variant="subtle" size="xs">{item.effort}</Text>
                  </FlexRow>
                  <Text variant="main" size="xs">{item.reason}</Text>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* View Mode Toggle */}
        <FlexRow gap="md" wrap className="mb-6">
          <FlexColumn className="min-w-[200px]">
            <Text variant="subtle" size="xs" className="mb-1">View Mode</Text>
            <Select
              variant="bordered"
              value={viewMode}
              onChange={(value: string) => setViewMode(value as 'table' | 'hierarchy')}
              options={[
                { value: 'table', label: 'Table View' },
                { value: 'hierarchy', label: 'Native Roadmap' },
              ]}
            />
          </FlexColumn>
        </FlexRow>

        {/* Filters */}
        <FlexRow gap="md" wrap className="mb-6">
          <FlexColumn className="w-[250px] flex-shrink-0">
            <Text variant="subtle" size="xs" className="mb-1">
              Search
            </Text>
            <Input
              type="text"
              placeholder="Search components..."
              variant="bordered"
              value={searchTerm}
              onChange={(value: string) => setSearchTerm(value)}
            />
          </FlexColumn>

          <FlexColumn className="min-w-[160px]">
            <Text variant="subtle" size="xs" className="mb-1">
              Categories
            </Text>
            <Select
              variant="bordered"
              value={categoryFilter}
              onChange={(value: string) =>
                setCategoryFilter(value as ComponentCategory | 'all')
              }
              options={[
                { value: 'all', label: 'All' },
                { value: 'shared', label: 'Shared' },
                { value: 'platform_specific', label: 'Platform Specific' },
                { value: 'complex_refactor', label: 'Complex Refactor' },
              ]}
            />
          </FlexColumn>

          <FlexColumn className="min-w-[140px]">
            <Text variant="subtle" size="xs" className="mb-1">
              Primitives
            </Text>
            <Select
              variant="bordered"
              value={primitivesFilter}
              onChange={(value: string) =>
                setPrimitivesFilter(value as AuditStatus | 'all')
              }
              options={[
                { value: 'all', label: 'All' },
                { value: 'todo', label: 'Todo' },
                { value: 'partial', label: 'Done (partial)' },
                { value: 'done', label: 'Done' },
              ]}
            />
          </FlexColumn>

          <FlexColumn className="min-w-[120px]">
            <Text variant="subtle" size="xs" className="mb-1">
              Logic
            </Text>
            <Select
              variant="bordered"
              value={logicFilter}
              onChange={(value: string) =>
                setLogicFilter(value as AuditStatus | 'all')
              }
              options={[
                { value: 'all', label: 'All' },
                { value: 'todo', label: 'Todo' },
                { value: 'in_progress', label: 'In Progress' },
                { value: 'done', label: 'Done' },
                { value: 'keep', label: 'Keep' },
              ]}
            />
          </FlexColumn>

          <FlexColumn className="min-w-[120px]">
            <Text variant="subtle" size="xs" className="mb-1">
              Native
            </Text>
            <Select
              variant="bordered"
              value={nativeFilter}
              onChange={(value: string) =>
                setNativeFilter(value as AuditStatus | 'all')
              }
              options={[
                { value: 'all', label: 'All' },
                { value: 'todo', label: 'Todo' },
                { value: 'in_progress', label: 'In Progress' },
                { value: 'done', label: 'Done' },
                { value: 'ready', label: 'Ready' },
                { value: 'not_needed', label: 'Not Needed' },
              ]}
            />
          </FlexColumn>

          <FlexColumn className="min-w-[120px]">
            <Text variant="subtle" size="xs" className="mb-1">
              Usage
            </Text>
            <Select
              variant="bordered"
              value={usageFilter}
              onChange={(value: string) =>
                setUsageFilter(value as 'yes' | 'no' | 'unknown' | 'suspended' | 'all')
              }
              options={[
                { value: 'all', label: 'All' },
                { value: 'yes', label: 'Used' },
                { value: 'no', label: 'Unused' },
                { value: 'unknown', label: 'Unknown' },
                { value: 'suspended', label: 'Suspended' },
              ]}
            />
          </FlexColumn>

          <FlexColumn className="min-w-[140px]">
            <Text variant="subtle" size="xs" className="mb-1">
              Sort Order
            </Text>
            <Select
              variant="bordered"
              value={sortOrder}
              onChange={(value: string) =>
                setSortOrder(value as 'alphabetical' | 'reverse' | 'dependency')
              }
              options={[
                { value: 'alphabetical', label: 'A → Z' },
                { value: 'reverse', label: 'Z → A' },
                { value: 'dependency', label: 'Dependency Level' },
              ]}
            />
          </FlexColumn>

          <FlexColumn className="min-w-[140px]">
            <Text variant="subtle" size="xs" className="mb-1">
              Complexity
            </Text>
            <Select
              variant="bordered"
              value={complexityFilter}
              onChange={(value: string) =>
                setComplexityFilter(value as ComplexityCategory | 'all')
              }
              options={[
                { value: 'all', label: 'All' },
                { value: 'basic', label: 'Basic' },
                { value: 'simple', label: 'Simple' },
                { value: 'medium', label: 'Medium' },
                { value: 'complex', label: 'Complex' },
              ]}
            />
          </FlexColumn>

          <FlexColumn className="min-w-[120px]">
            <Text variant="subtle" size="xs" className="mb-1">
              &nbsp;
            </Text>
            <Button
              type="subtle"
              onClick={clearAllFilters}
              className="h-[38px]"
            >
              Reset
            </Button>
          </FlexColumn>
        </FlexRow>

        {/* Component Views */}
        {viewMode === 'table' ? (
          /* Component Table */
          <div className="bg-surface-1 rounded-lg border border-default overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="bg-surface-2 border-b border-default">
                  <th className="px-4 py-3 text-left text-sm font-medium text-subtle">
                    Component
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-subtle">
                    Category
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-subtle">
                    Used
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-subtle">
                    Primitives
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-subtle">
                    Logic
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-subtle">
                    Native
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-subtle">
                    Complexity
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-subtle">
                    Dependencies
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-subtle">
                    Progress
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-subtle">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredComponents.map(([key, component]) => (
                  <React.Fragment key={key}>
                    <tr className="border-b border-default hover:bg-surface-2/50 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-strong">
                            {component.name}
                          </p>
                          <p className="text-xs text-subtle">
                            {component.description}
                          </p>
                          <p className="text-xs text-muted">{component.path}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <CategoryBadge category={component.category} />
                      </td>
                      <td className="px-4 py-3">
                        <UsageBadge used={component.used || 'unknown'} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={component.primitives} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={component.logic_extraction} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          status={component.native}
                          context="native"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <ComplexityBadge complexity={component.complexity_category} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="max-w-[120px]">
                          {component.dependencies && component.dependencies.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {component.dependencies.slice(0, 3).map((dep, idx) => (
                                <Text
                                  key={idx}
                                  className="px-1.5 py-0.5 bg-accent/10 text-accent-600 dark:text-accent-400 rounded text-xs"
                                  title={dep}
                                >
                                  {dep.length > 10 ? dep.substring(0, 10) + '...' : dep}
                                </Text>
                              ))}
                              {component.dependencies.length > 3 && (
                                <Text className="px-1.5 py-0.5 bg-surface-2 text-subtle rounded text-xs">
                                  +{component.dependencies.length - 3}
                                </Text>
                              )}
                            </div>
                          ) : (
                            <Text className="text-xs text-muted">None</Text>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="w-24">
                          <div className="bg-surface-3 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-accent h-full transition-all duration-300"
                              style={{
                                width: `${calculateProgress(component)}%`,
                              }}
                            />
                          </div>
                          <p className="text-xs text-subtle mt-1">
                            {calculateProgress(component).toFixed(0)}%
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          type="subtle"
                          size="small"
                          onClick={() => toggleRowExpansion(key)}
                          className="text-sm"
                        >
                          {expandedRows.has(key) ? 'Hide' : 'Details'}
                        </Button>
                      </td>
                    </tr>

                    {expandedRows.has(key) && (
                      <tr className="bg-surface-2/30 border-b border-default">
                        <td colSpan={10} className="px-4 py-4">
                          <div className="space-y-3">
                            <div>
                              <h4 className="text-sm font-medium text-strong mb-1">
                                Notes
                              </h4>
                              <p className="text-sm text-main bg-surface-1 rounded p-3">
                                {component.notes}
                              </p>
                            </div>

                            {component.hooks.length > 0 && (
                              <div>
                                <h4 className="text-sm font-medium text-strong mb-1">
                                  Identified Hooks
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                  {component.hooks.map((hook, index) => (
                                    <span
                                      key={index}
                                      className="px-2 py-1 bg-accent/10 text-accent-600 dark:text-accent-400 rounded text-xs"
                                    >
                                      {hook}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {component.dependencies && component.dependencies.length > 0 && (
                              <div>
                                <h4 className="text-sm font-medium text-strong mb-1">
                                  Dependencies ({component.dependencies.length})
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                  {component.dependencies.map((dep, index) => (
                                    <span
                                      key={index}
                                      className="px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded text-xs border border-blue-200 dark:border-blue-800"
                                    >
                                      {dep}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {component.dependency_level !== undefined && (
                              <div>
                                <h4 className="text-sm font-medium text-strong mb-1">
                                  Build Information
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                                  <div>
                                    <span className="text-subtle">Dependency Level:</span>{' '}
                                    <span className="font-medium">{component.dependency_level}</span>
                                  </div>
                                  <div>
                                    <span className="text-subtle">Complexity:</span>{' '}
                                    <span className="font-medium capitalize">{component.complexity_category}</span>
                                  </div>
                                  <div>
                                    <span className="text-subtle">Dependencies:</span>{' '}
                                    <span className="font-medium">{component.dependencies?.length || 0}</span>
                                  </div>
                                </div>
                              </div>
                            )}

                            <div className="text-xs text-subtle">
                              Last updated: {component.updated}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
                {filteredComponents.length === 0 && (
                  <tr>
                    <td colSpan={10} className="text-center py-8 text-subtle">
                      No components match your filters
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        ) : (
          /* Native Development Roadmap */
          <div className="space-y-8">
            {/* Development Phase Overview */}
            <div className="bg-surface-1 rounded-lg p-6 border border-default">
              <Text size="lg" weight="semibold" className="mb-4">🎯 Native Development Roadmap</Text>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-500">
                    {filteredComponents.filter(([, c]) => c.complexity_category === 'basic' && c.primitives === 'done' && c.native === 'todo').length}
                  </div>
                  <div className="text-xs text-subtle">Ready Now</div>
                  <div className="text-xs text-green-600">Start Here</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-500">
                    {filteredComponents.filter(([, c]) => c.complexity_category === 'simple' && c.primitives === 'done' && ['todo', 'in_progress'].includes(c.native)).length}
                  </div>
                  <div className="text-xs text-subtle">Next Phase</div>
                  <div className="text-xs text-blue-600">1-3 deps</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-500">
                    {filteredComponents.filter(([, c]) => c.complexity_category === 'medium' && ['todo', 'in_progress'].includes(c.native)).length}
                  </div>
                  <div className="text-xs text-subtle">Medium Term</div>
                  <div className="text-xs text-orange-600">4-6 deps</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-500">
                    {filteredComponents.filter(([, c]) => c.complexity_category === 'complex' && ['todo', 'in_progress'].includes(c.native)).length}
                  </div>
                  <div className="text-xs text-subtle">Complex</div>
                  <div className="text-xs text-red-600">7+ deps</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-accent">
                    {filteredComponents.filter(([, c]) => ['done', 'ready'].includes(c.native)).length}
                  </div>
                  <div className="text-xs text-subtle">Done</div>
                  <div className="text-xs text-accent">Complete</div>
                </div>
              </div>
            </div>

            {/* Priority Phases */}
            {(() => {
              const roadmapPhases = [
                {
                  id: 'ready_now',
                  title: '🚀 Ready to Build Now',
                  subtitle: 'Basic components with no dependencies - Start here!',
                  filter: (comp: ComponentAudit) => 
                    comp.complexity_category === 'basic' && 
                    comp.primitives === 'done' && 
                    comp.native === 'todo',
                  color: 'bg-green-500/10 border-green-500/30',
                  urgency: 'high'
                },
                {
                  id: 'next_phase',
                  title: '⚡ Next Phase - Simple Components',
                  subtitle: 'Components with 1-3 dependencies - Build after basics',
                  filter: (comp: ComponentAudit) => 
                    comp.complexity_category === 'simple' &&
                    comp.primitives === 'done' &&
                    ['todo', 'in_progress'].includes(comp.native),
                  color: 'bg-blue-500/10 border-blue-500/30',
                  urgency: 'medium'
                },
                {
                  id: 'medium_complexity',
                  title: '🔧 Medium Complexity',
                  subtitle: 'Components with 4-6 dependencies - Plan carefully',
                  filter: (comp: ComponentAudit) => 
                    comp.complexity_category === 'medium' &&
                    ['todo', 'in_progress'].includes(comp.native),
                  color: 'bg-orange-500/10 border-orange-500/30',
                  urgency: 'low'
                },
                {
                  id: 'complex_components',
                  title: '🎯 Complex Components',
                  subtitle: 'Components with 7+ dependencies - Tackle last',
                  filter: (comp: ComponentAudit) => 
                    comp.complexity_category === 'complex' &&
                    ['todo', 'in_progress'].includes(comp.native),
                  color: 'bg-red-500/10 border-red-500/30',
                  urgency: 'low'
                },
                {
                  id: 'completed',
                  title: '✅ Completed & Ready',
                  subtitle: 'Native implementation complete',
                  filter: (comp: ComponentAudit) => 
                    ['done', 'ready'].includes(comp.native),
                  color: 'bg-accent/10 border-accent/30',
                  urgency: 'done'
                }
              ];

              return roadmapPhases.map(phase => {
                const components = filteredComponents.filter(([, comp]) => phase.filter(comp));
                
                if (components.length === 0) return null;

                return (
                  <div key={phase.id} className={`rounded-lg border-2 ${phase.color} overflow-hidden`}>
                    <div className="p-6">
                      <div className="flex justify-between items-start mb-6">
                        <div className="flex-1 pr-4">
                          <Text size="xl" weight="semibold" className="block mb-2">{phase.title}</Text>
                          <Text size="sm" className="text-subtle block">{phase.subtitle}</Text>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-accent">{components.length}</div>
                          <div className="text-xs text-subtle">components</div>
                        </div>
                      </div>

                      {/* Action Items List */}
                      <div className="space-y-3">
                        {components.slice(0, 8).map(([key, component]) => (
                          <div key={key} className="flex items-center justify-between p-4 bg-surface-0 rounded-lg border border-default hover:bg-surface-1/50 transition-colors">
                            <div className="flex-1">
                              <div className="flex items-center gap-4 mb-2">
                                <Text size="sm" weight="medium">{component.name}</Text>
                                
                                {/* Status indicators */}
                                <div className="flex gap-2">
                                  <StatusBadge status={component.native} context="native" />
                                  {component.dependencies && component.dependencies.length > 0 && (
                                    <span className="text-xs bg-accent/10 text-accent px-2 py-1 rounded">
                                      {component.dependencies.length} deps
                                    </span>
                                  )}
                                </div>
                              </div>
                              
                              <Text size="xs" className="text-subtle line-clamp-1 mb-2">
                                {component.description}
                              </Text>

                              {/* Dependencies preview */}
                              {component.dependencies && component.dependencies.length > 0 && (
                                <div className="flex gap-1 flex-wrap">
                                  <span className="text-xs text-subtle">Needs:</span>
                                  {component.dependencies.slice(0, 3).map(dep => (
                                    <span key={dep} className="text-xs bg-surface-2 px-1.5 py-0.5 rounded">
                                      {dep}
                                    </span>
                                  ))}
                                  {component.dependencies.length > 3 && (
                                    <span className="text-xs text-subtle">+{component.dependencies.length - 3}</span>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-3 ml-4">
                              {/* Progress dots */}
                              <div className="flex gap-1" title="Primitives • Logic • Native">
                                <div className={`w-2 h-2 rounded-full ${
                                  component.primitives === 'done' ? 'bg-green-500' : 'bg-gray-300'
                                }`} />
                                <div className={`w-2 h-2 rounded-full ${
                                  component.logic_extraction === 'done' ? 'bg-green-500' : 'bg-gray-300'
                                }`} />
                                <div className={`w-2 h-2 rounded-full ${
                                  ['done', 'ready'].includes(component.native) ? 'bg-green-500' : 'bg-gray-300'
                                }`} />
                              </div>
                              
                              <Text size="xs" className="text-subtle w-8 text-right">
                                L{component.dependency_level || 0}
                              </Text>

                              {phase.urgency === 'high' && (
                                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-medium">
                                  BUILD
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                        
                        {components.length > 8 && (
                          <div className="text-center py-3">
                            <Text size="sm" className="text-subtle">
                              +{components.length - 8} more components in this phase
                            </Text>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              });
            })()}

            {/* Build Strategy Summary */}
            <div className="bg-surface-1 rounded-lg p-6 border border-default">
              <Text size="lg" weight="semibold" className="mb-4">💡 Build Strategy</Text>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Text size="sm" weight="medium" className="mb-2 text-green-600 block">Phase 1: Foundations</Text>
                  <Text size="xs" className="text-subtle block">
                    Start with basic components (no dependencies). These are building blocks for everything else.
                  </Text>
                </div>
                <div>
                  <Text size="sm" weight="medium" className="mb-2 text-blue-600 block">Phase 2: Simple Components</Text>
                  <Text size="xs" className="text-subtle block">
                    Build components with 1-3 dependencies once their prerequisites are complete.
                  </Text>
                </div>
                <div>
                  <Text size="sm" weight="medium" className="mb-2 text-orange-600 block">Phase 3: Medium Complexity</Text>
                  <Text size="xs" className="text-subtle block">
                    Tackle components with 4-6 dependencies. Plan refactoring and testing carefully.
                  </Text>
                </div>
                <div>
                  <Text size="sm" weight="medium" className="mb-2 text-red-600 block">Phase 4: Complex Systems</Text>
                  <Text size="xs" className="text-subtle block">
                    Handle complex components (7+ deps) last. Consider breaking them down further.
                  </Text>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Metadata Footer */}
        <Container className="mt-6 text-xs text-subtle">
          <p>Audit Version: {data.metadata.audit_version}</p>
          <p>Last Updated: {data.stats.last_updated}</p>
          <p>Scan Scope: {data.metadata.scan_scope.join(', ')}</p>
        </Container>

        {/* Back to Top Link */}
        <FlexRow justify="center" className="mt-8">
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="text-accent hover:text-accent-600 underline"
          >
            Back to Top
          </a>
        </FlexRow>
      </Container>
    </Container>
  );
};
