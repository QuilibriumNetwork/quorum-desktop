import React, { useState, useMemo } from 'react';
import auditData from './audit.json';

type AuditStatus = 'todo' | 'in_progress' | 'done' | 'ready' | 'partial' | 'unknown';
type ComponentCategory = 'shared' | 'platform_specific' | 'complex_refactor' | 'unknown';

interface ComponentAudit {
  name: string;
  path: string;
  description: string;
  category: ComponentCategory;
  primitives: AuditStatus;
  web_native: string;
  logic_extraction: AuditStatus;
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
    by_category: {
      shared: number;
      platform_specific: number;
      complex_refactor: number;
    };
    last_updated: string;
  };
  metadata: {
    audit_version: string;
    last_full_scan: string | null;
    scan_scope: string[];
  };
}

const StatusBadge: React.FC<{ status: AuditStatus }> = ({ status }) => {
  const getStatusClass = () => {
    switch (status) {
      case 'done':
      case 'ready':
        return 'bg-green-500/70 text-white';
      case 'in_progress':
        return 'bg-yellow-500/70 text-black';
      case 'todo':
        return 'bg-blue-500/70 text-white';
      case 'partial':
        return 'bg-orange-500/70 text-white';
      case 'unknown':
        return 'bg-gray-500/70 text-white';
      default:
        return 'bg-surface-2 text-muted';
    }
  };

  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusClass()}`}>
      {status}
    </span>
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
    <span className={`px-2 py-1 rounded text-xs font-medium ${getCategoryClass()}`}>
      {getCategoryLabel()}
    </span>
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
    <span className={`px-2 py-1 rounded text-xs font-medium ${getUsageClass()}`}>
      {getUsageLabel()}
    </span>
  );
};

export const ComponentAuditViewer: React.FC = () => {
  const data = auditData as AuditData;
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ComponentCategory | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<AuditStatus | 'all'>('all');
  const [usageFilter, setUsageFilter] = useState<'yes' | 'no' | 'unknown' | 'all'>('all');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const filteredComponents = useMemo(() => {
    return Object.entries(data.components).filter(([key, component]) => {
      const matchesSearch = 
        component.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        component.path.toLowerCase().includes(searchTerm.toLowerCase()) ||
        component.description.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = categoryFilter === 'all' || component.category === categoryFilter;
      
      const matchesStatus = statusFilter === 'all' || 
        component.primitives === statusFilter ||
        component.logic_extraction === statusFilter ||
        component.native === statusFilter;
      
      const matchesUsage = usageFilter === 'all' || (component as any).used === usageFilter;
      
      return matchesSearch && matchesCategory && matchesStatus && matchesUsage;
    });
  }, [data.components, searchTerm, categoryFilter, statusFilter, usageFilter]);

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
    
    if (component.primitives === 'done') progress++;
    if (component.logic_extraction === 'done') progress++;
    if (component.native === 'ready') progress++;
    
    return (progress / total) * 100;
  };

  return (
    <div className="min-h-screen bg-app overflow-y-auto">
      <div className="p-6 max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-strong">Component Audit Dashboard</h1>
      
      {/* Stats Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-surface-1 rounded-lg p-4 border border-default">
          <h3 className="text-sm font-medium text-subtle mb-2">Total Components</h3>
          <p className="text-2xl font-bold text-strong">{data.stats.total}</p>
        </div>
        
        <div className="bg-surface-1 rounded-lg p-4 border border-default">
          <h3 className="text-sm font-medium text-subtle mb-2">Primitives Migrated</h3>
          <p className="text-2xl font-bold text-strong">
            {data.stats.primitives_done}/{data.stats.total}
          </p>
          <div className="mt-2 bg-surface-3 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-accent h-full transition-all duration-300"
              style={{ width: `${(data.stats.primitives_done / data.stats.total) * 100}%` }}
            />
          </div>
        </div>
        
        <div className="bg-surface-1 rounded-lg p-4 border border-default">
          <h3 className="text-sm font-medium text-subtle mb-2">Logic Extracted</h3>
          <p className="text-2xl font-bold text-strong">
            {data.stats.logic_extraction_done}/{data.stats.total}
          </p>
          <div className="mt-2 bg-surface-3 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-success h-full transition-all duration-300"
              style={{ width: `${(data.stats.logic_extraction_done / data.stats.total) * 100}%` }}
            />
          </div>
        </div>
        
        <div className="bg-surface-1 rounded-lg p-4 border border-default">
          <h3 className="text-sm font-medium text-subtle mb-2">Native Ready</h3>
          <p className="text-2xl font-bold text-strong">
            {data.stats.native_ready}/{data.stats.total}
          </p>
          <div className="mt-2 bg-surface-3 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-info h-full transition-all duration-300"
              style={{ width: `${(data.stats.native_ready / data.stats.total) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
      </div>

      {/* Usage Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-surface-1 rounded-lg p-4 border border-default">
          <h3 className="text-sm font-medium text-subtle mb-2">Used Components</h3>
          <p className="text-xl font-bold text-success">{data.stats.by_usage?.used || 0}</p>
          <p className="text-xs text-subtle">Active in codebase</p>
        </div>
        <div className="bg-surface-1 rounded-lg p-4 border border-default">
          <h3 className="text-sm font-medium text-subtle mb-2">Unused Components</h3>
          <p className="text-xl font-bold text-danger">{data.stats.by_usage?.unused || 0}</p>
          <p className="text-xs text-subtle">Can be deleted</p>
        </div>
        <div className="bg-surface-1 rounded-lg p-4 border border-default">
          <h3 className="text-sm font-medium text-subtle mb-2">Unknown Usage</h3>
          <p className="text-xl font-bold text-warning">{data.stats.by_usage?.unknown || 0}</p>
          <p className="text-xs text-subtle">Needs analysis</p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-4">
        <input
          type="text"
          placeholder="Search components..."
          className="px-4 py-2 rounded-lg bg-surface-1 border border-default text-main focus:outline-none focus:border-accent"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        
        <select
          className="px-4 py-2 rounded-lg bg-surface-1 border border-default text-main focus:outline-none focus:border-accent"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as ComponentCategory | 'all')}
        >
          <option value="all">All Categories</option>
          <option value="shared">Shared</option>
          <option value="platform_specific">Platform Specific</option>
          <option value="complex_refactor">Complex Refactor</option>
        </select>
        
        <select
          className="px-4 py-2 rounded-lg bg-surface-1 border border-default text-main focus:outline-none focus:border-accent"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as AuditStatus | 'all')}
        >
          <option value="all">All Statuses</option>
          <option value="todo">Todo</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
          <option value="ready">Ready</option>
        </select>
        
        <select
          className="px-4 py-2 rounded-lg bg-surface-1 border border-default text-main focus:outline-none focus:border-accent"
          value={usageFilter}
          onChange={(e) => setUsageFilter(e.target.value as 'yes' | 'no' | 'unknown' | 'all')}
        >
          <option value="all">All Usage</option>
          <option value="yes">Used</option>
          <option value="no">Unused</option>
          <option value="unknown">Unknown</option>
        </select>
      </div>

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
                    <UsageBadge used={(component as any).used || 'unknown'} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={component.primitives} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={component.logic_extraction} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={component.native} />
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
                    <button
                      onClick={() => toggleRowExpansion(key)}
                      className="text-accent hover:text-accent-600 text-sm font-medium"
                    >
                      {expandedRows.has(key) ? 'Hide' : 'Details'}
                    </button>
                  </td>
                </tr>
                
                {expandedRows.has(key) && (
                  <tr className="bg-surface-2/30">
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
        <div className="mt-6 text-xs text-subtle">
          <p>Audit Version: {data.metadata.audit_version}</p>
          <p>Last Updated: {data.stats.last_updated}</p>
          <p>Scan Scope: {data.metadata.scan_scope.join(', ')}</p>
        </div>

        {/* Back to Top Link */}
        <div className="mt-8 flex justify-center">
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
        </div>
      </div>
    </div>
  );
};