import React, { useState, useMemo } from 'react';
import auditData from './audit.json';
import {
  Input,
  Select,
  Button,
  FlexRow,
  FlexColumn,
  Container,
  Text
} from '../../components/primitives';

type AuditStatus = 'todo' | 'in_progress' | 'done' | 'ready' | 'partial' | 'unknown' | 'keep' | 'extract';
type ComponentCategory = 'shared' | 'platform_specific' | 'complex_refactor' | 'unknown';

interface ComponentAudit {
  name: string;
  path: string;
  description: string;
  category: ComponentCategory;
  used: string;
  primitives: AuditStatus;
  logic_extraction: AuditStatus;
  logic_needs: AuditStatus;
  hooks: string[];
  native: AuditStatus;
  notes: string;
  updated: string;
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
    };
    by_logic_needs: {
      keep: number;
      extract: number;
      done: number;
    };
    analysis_notes: string;
    last_updated: string;
  };
  metadata: {
    audit_version: string;
    last_full_scan: string | null;
    scan_scope: string[];
  };
}

const StatusBadge: React.FC<{ status: AuditStatus; context?: 'native' | 'default' }> = ({ status, context = 'default' }) => {
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
    <Text className={`px-2 py-1 rounded text-xs font-medium ${getStatusClass()}`}>
      {getStatusLabel()}
    </Text>
  );
};

const CategoryBadge: React.FC<{ category: ComponentCategory }> = ({ category }) => {
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
    <Text className={`px-2 py-1 rounded text-xs font-medium ${getCategoryClass()}`}>
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
      default:
        return 'Unknown';
    }
  };

  return (
    <Text className={`px-2 py-1 rounded text-xs font-medium ${getUsageClass()}`}>
      {getUsageLabel()}
    </Text>
  );
};

export const ComponentAuditViewer: React.FC = () => {
  const data = auditData as AuditData;
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ComponentCategory | 'all'>('all');
  const [primitivesFilter, setPrimitivesFilter] = useState<AuditStatus | 'all'>('all');
  const [logicFilter, setLogicFilter] = useState<AuditStatus | 'all'>('all');
  const [nativeFilter, setNativeFilter] = useState<AuditStatus | 'all'>('all');
  const [usageFilter, setUsageFilter] = useState<'yes' | 'no' | 'unknown' | 'all'>('all');
  const [sortOrder, setSortOrder] = useState<'alphabetical' | 'reverse'>('alphabetical');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const clearAllFilters = () => {
    setSearchTerm('');
    setCategoryFilter('all');
    setPrimitivesFilter('all');
    setLogicFilter('all');
    setNativeFilter('all');
    setUsageFilter('all');
    setSortOrder('alphabetical');
  };

  const filteredComponents = useMemo(() => {
    const filtered = Object.entries(data.components).filter(([key, component]) => {
      const matchesSearch = 
        component.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        component.path.toLowerCase().includes(searchTerm.toLowerCase()) ||
        component.description.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = categoryFilter === 'all' || component.category === categoryFilter;
      
      const matchesPrimitives = primitivesFilter === 'all' || component.primitives === primitivesFilter;
      const matchesLogic = logicFilter === 'all' || component.logic_extraction === logicFilter;
      const matchesNative = nativeFilter === 'all' || component.native === nativeFilter;
      
      const matchesUsage = usageFilter === 'all' || component.used === usageFilter;
      
      return matchesSearch && matchesCategory && matchesPrimitives && matchesLogic && matchesNative && matchesUsage;
    });

    // Apply sorting
    if (sortOrder === 'alphabetical') {
      return filtered.sort(([, a], [, b]) => a.name.localeCompare(b.name));
    } else {
      return filtered.sort(([, a], [, b]) => b.name.localeCompare(a.name));
    }
  }, [data.components, searchTerm, categoryFilter, primitivesFilter, logicFilter, nativeFilter, usageFilter, sortOrder]);

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
    
    if (component.primitives === 'done' || component.primitives === 'partial') progress++;
    // Count logic extraction as complete if 'done' OR if logic_needs is 'keep'
    if (component.logic_extraction === 'done' || component.logic_needs === 'keep') progress++;
    if (component.native === 'ready') progress++;
    
    return (progress / total) * 100;
  };

  return (
    <Container className="min-h-screen bg-app overflow-y-auto">
      <Container padding="lg" className="mx-auto max-w-screen-2xl">
        <Text as="h1" variant="strong" size="3xl" weight="bold" className="my-6">Component Audit Dashboard</Text>
      
      {/* Stats Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
        <div className="bg-surface-1 rounded-lg p-4 border border-default">
          <Text as="h3" variant="subtle" size="sm" weight="medium" className="mb-2">Total Components</Text>
          <Text variant="strong" size="2xl" weight="bold">{data.stats.total}</Text>
        </div>
        
        <div className="bg-surface-1 rounded-lg p-4 border border-default">
          <Text as="h3" variant="subtle" size="sm" weight="medium" className="mb-2">Primitives Migrated</Text>
          <Text variant="strong" size="2xl" weight="bold">
            {data.stats.primitives_done}/{data.stats.total}
          </Text>
          <div className="mt-2 bg-surface-3 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-accent h-full transition-all duration-300"
              style={{ width: `${(data.stats.primitives_done / data.stats.total) * 100}%` }}
            />
          </div>
        </div>
        
        <div className="bg-surface-1 rounded-lg p-4 border border-default">
          <Text as="h3" variant="subtle" size="sm" weight="medium" className="mb-2">Logic Extracted</Text>
          <Text variant="strong" size="2xl" weight="bold">
            {data.stats.logic_extraction_done}/{data.stats.total}
          </Text>
          <div className="mt-2 bg-surface-3 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-success h-full transition-all duration-300"
              style={{ width: `${(data.stats.logic_extraction_done / data.stats.total) * 100}%` }}
            />
          </div>
        </div>
        
        <div className="bg-surface-1 rounded-lg p-4 border border-default">
          <Text as="h3" variant="subtle" size="sm" weight="medium" className="mb-2">Native Done</Text>
          <Text variant="strong" size="2xl" weight="bold">
            {data.stats.native_done}/{data.stats.total}
          </Text>
          <div className="mt-2 bg-surface-3 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-success h-full transition-all duration-300"
              style={{ width: `${(data.stats.native_done / data.stats.total) * 100}%` }}
            />
          </div>
        </div>
        
        <div className="bg-surface-1 rounded-lg p-4 border border-default">
          <Text as="h3" variant="subtle" size="sm" weight="medium" className="mb-2">Native Ready (Tested)</Text>
          <Text variant="strong" size="2xl" weight="bold">
            {data.stats.native_ready}/{data.stats.total}
          </Text>
          <div className="mt-2 bg-surface-3 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-info h-full transition-all duration-300"
              style={{ width: `${(data.stats.native_ready / data.stats.total) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Category & Usage Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 2xl:grid-cols-6 gap-4 mb-8">
        <div className="bg-surface-1 rounded-lg p-4 border border-default">
          <h3 className="text-sm font-medium text-subtle mb-2">Shared Components</h3>
          <p className="text-xl font-bold text-strong">{data.stats.by_category.shared}</p>
        </div>
        <div className="bg-surface-1 rounded-lg p-4 border border-default">
          <h3 className="text-sm font-medium text-subtle mb-2">Platform Specific</h3>
          <p className="text-xl font-bold text-strong">{data.stats.by_category.platform_specific}</p>
        </div>
        <div className="bg-surface-1 rounded-lg p-4 border border-default">
          <h3 className="text-sm font-medium text-subtle mb-2">Complex Refactor</h3>
          <p className="text-xl font-bold text-strong">{data.stats.by_category.complex_refactor}</p>
        </div>
        <div className="bg-surface-1 rounded-lg p-4 border border-default">
          <h3 className="text-sm font-medium text-subtle mb-2">Used Components</h3>
          <p className="text-xl font-bold text-success">{data.stats.by_usage?.yes || 0}</p>
          <p className="text-xs text-subtle">Active in codebase</p>
        </div>
        <div className="bg-surface-1 rounded-lg p-4 border border-default">
          <h3 className="text-sm font-medium text-subtle mb-2">Unused Components</h3>
          <p className="text-xl font-bold text-danger">{data.stats.by_usage?.no || 0}</p>
          <p className="text-xs text-subtle">Can be deleted</p>
        </div>
        <div className="bg-surface-1 rounded-lg p-4 border border-default">
          <h3 className="text-sm font-medium text-subtle mb-2">Unknown Usage</h3>
          <p className="text-xl font-bold text-warning">{data.stats.by_usage?.unknown || 0}</p>
          <p className="text-xs text-subtle">Needs analysis</p>
        </div>
      </div>

      {/* Filters */}
      <FlexRow gap="md" wrap className="mb-6">
        <FlexColumn className="w-[250px] flex-shrink-0">
          <Text variant="subtle" size="xs" className="mb-1">Search</Text>
          <Input
            type="text"
            placeholder="Search components..."
            variant="bordered"
            value={searchTerm}
            onChange={(value: string) => setSearchTerm(value)}
          />
        </FlexColumn>
        
        <FlexColumn className="min-w-[160px]">
          <Text variant="subtle" size="xs" className="mb-1">Categories</Text>
          <Select
            variant="bordered"
            value={categoryFilter}
            onChange={(value: string) => setCategoryFilter(value as ComponentCategory | 'all')}
            options={[
              { value: 'all', label: 'All' },
              { value: 'shared', label: 'Shared' },
              { value: 'platform_specific', label: 'Platform Specific' },
              { value: 'complex_refactor', label: 'Complex Refactor' }
            ]}
          />
        </FlexColumn>
        
        <FlexColumn className="min-w-[140px]">
          <Text variant="subtle" size="xs" className="mb-1">Primitives</Text>
          <Select
            variant="bordered"
            value={primitivesFilter}
            onChange={(value: string) => setPrimitivesFilter(value as AuditStatus | 'all')}
            options={[
              { value: 'all', label: 'All' },
              { value: 'todo', label: 'Todo' },
              { value: 'partial', label: 'Done (partial)' },
              { value: 'done', label: 'Done' }
            ]}
          />
        </FlexColumn>
        
        <FlexColumn className="min-w-[120px]">
          <Text variant="subtle" size="xs" className="mb-1">Logic</Text>
          <Select
            variant="bordered"
            value={logicFilter}
            onChange={(value: string) => setLogicFilter(value as AuditStatus | 'all')}
            options={[
              { value: 'all', label: 'All' },
              { value: 'todo', label: 'Todo' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'done', label: 'Done' },
              { value: 'keep', label: 'Keep' }
            ]}
          />
        </FlexColumn>
        
        <FlexColumn className="min-w-[120px]">
          <Text variant="subtle" size="xs" className="mb-1">Native</Text>
          <Select
            variant="bordered"
            value={nativeFilter}
            onChange={(value: string) => setNativeFilter(value as AuditStatus | 'all')}
            options={[
              { value: 'all', label: 'All' },
              { value: 'todo', label: 'Todo' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'done', label: 'Done' },
              { value: 'ready', label: 'Ready' }
            ]}
          />
        </FlexColumn>
        
        <FlexColumn className="min-w-[120px]">
          <Text variant="subtle" size="xs" className="mb-1">Usage</Text>
          <Select
            variant="bordered"
            value={usageFilter}
            onChange={(value: string) => setUsageFilter(value as 'yes' | 'no' | 'unknown' | 'all')}
            options={[
              { value: 'all', label: 'All' },
              { value: 'yes', label: 'Used' },
              { value: 'no', label: 'Unused' },
              { value: 'unknown', label: 'Unknown' }
            ]}
          />
        </FlexColumn>
        
        <FlexColumn className="min-w-[140px]">
          <Text variant="subtle" size="xs" className="mb-1">Sort Order</Text>
          <Select
            variant="bordered"
            value={sortOrder}
            onChange={(value: string) => setSortOrder(value as 'alphabetical' | 'reverse')}
            options={[
              { value: 'alphabetical', label: 'A → Z' },
              { value: 'reverse', label: 'Z → A' }
            ]}
          />
        </FlexColumn>
        
        <FlexColumn className="min-w-[120px]">
          <Text variant="subtle" size="xs" className="mb-1">&nbsp;</Text>
          <Button
            type="subtle"
            onClick={clearAllFilters}
            className="h-[38px]"
          >
            Reset
          </Button>
        </FlexColumn>
      </FlexRow>

      {/* Component Table */}
      <div className="bg-surface-1 rounded-lg border border-default overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
          <thead>
            <tr className="bg-surface-2 border-b border-default">
              <th className="px-4 py-3 text-left text-sm font-medium text-subtle">Component</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-subtle">Category</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-subtle">Used</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-subtle">Primitives</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-subtle">Logic</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-subtle">Native</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-subtle">Progress</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-subtle">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredComponents.map(([key, component]) => (
              <React.Fragment key={key}>
                <tr className="border-b border-default hover:bg-surface-2/50 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-strong">{component.name}</p>
                      <p className="text-xs text-subtle">{component.description}</p>
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
                    <StatusBadge status={component.native} context="native" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="w-24">
                      <div className="bg-surface-3 rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-accent h-full transition-all duration-300"
                          style={{ width: `${calculateProgress(component)}%` }}
                        />
                      </div>
                      <p className="text-xs text-subtle mt-1">{calculateProgress(component).toFixed(0)}%</p>
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
                    <td colSpan={8} className="px-4 py-4">
                      <div className="space-y-3">
                        <div>
                          <h4 className="text-sm font-medium text-strong mb-1">Notes</h4>
                          <p className="text-sm text-main bg-surface-1 rounded p-3">{component.notes}</p>
                        </div>
                        
                        {component.hooks.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium text-strong mb-1">Identified Hooks</h4>
                            <div className="flex flex-wrap gap-2">
                              {component.hooks.map((hook, index) => (
                                <span key={index} className="px-2 py-1 bg-accent/10 text-accent-600 dark:text-accent-400 rounded text-xs">
                                  {hook}
                                </span>
                              ))}
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
                <td colSpan={8} className="text-center py-8 text-subtle">
                  No components match your filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

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