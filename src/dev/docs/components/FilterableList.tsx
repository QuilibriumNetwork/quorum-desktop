import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Input, Flex, Icon } from '../../../components/primitives';
import { type MarkdownFile, type MarkdownSection } from '../hooks/useMarkdownFiles';
import type { IconName } from '../../../components/primitives';
import {
  ISSUE_PRIORITY_ORDER,
  ISSUE_STATE_LABELS,
  ISSUE_STATE_ORDER,
  ISSUE_TYPE_ORDER,
} from '../utils/issueTaxonomy';

/**
 * Filtered, grouped list of markdown files.
 *
 * Issues get three filters — type, state, priority — because `.agents/issues/`
 * merged what used to be two separate pages: the bug-or-task distinction became
 * a field, so it has to become a filter. Docs and reports keep the single
 * status filter they always had.
 *
 * Chip counts are computed against the *other* active filters, so "Bug (22)"
 * next to an active "Open" chip means twenty-two open bugs, not twenty-two bugs
 * in the tree. A count that ignored the rest of the filters would promise
 * results that clicking it does not deliver.
 */

interface FilterOption {
  label: string;
  value: string;
  count: number;
}

/** Sentinel for "this file has no value for this field at all". */
const NONE = '__none__';

function getStatusIcon(status: string): IconName {
  switch (status) {
    case 'done':
      return 'check-circle';
    case 'in-progress':
      return 'clock';
    case 'on-hold':
      return 'warning';
    case 'open':
      return 'circle';
    case 'deferred':
      return 'clock';
    case 'blocked':
      return 'ban';
    case 'design':
      return 'pencil';
    case 'backlog':
      return 'clipboard-list';
    case 'archived':
      return 'history';
    default:
      return 'circle';
  }
}

function getPriorityIcon(priority: string): IconName {
  switch (priority) {
    case 'low':
      return 'arrow-down';
    case 'medium':
      return 'minus';
    case 'high':
      return 'arrow-up';
    default:
      return 'minus';
  }
}

function getTypeIcon(type: string): IconName {
  return type === 'bug' ? 'bug' : 'check-square';
}

interface FilterableListProps {
  files: MarkdownFile[];
  section: MarkdownSection;
  basePath: string;
}

/** One filter dimension: how to read it off a file, and how to order its chips. */
interface FilterSpec {
  key: string;
  label: string;
  /** The file's value, or `NONE` when it has none. */
  read: (file: MarkdownFile) => string;
  /** Chip order; values outside it are appended alphabetically. */
  order: string[];
  labels?: Record<string, string>;
  /** Whether to offer a "None" chip for files missing the field. */
  offerNone?: boolean;
  icon?: (value: string) => IconName;
}

const capitalize = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);

const ISSUE_FILTERS: FilterSpec[] = [
  {
    key: 'type',
    label: 'Type',
    read: (f) => f.issueType ?? NONE,
    order: [...ISSUE_TYPE_ORDER],
    labels: { bug: 'Bug', task: 'Task' },
    offerNone: true,
    icon: getTypeIcon,
  },
  {
    key: 'status',
    label: 'State',
    read: (f) => f.status ?? NONE,
    order: [...ISSUE_STATE_ORDER],
    labels: ISSUE_STATE_LABELS,
    icon: getStatusIcon,
  },
  {
    key: 'priority',
    label: 'Priority',
    read: (f) => f.priority ?? NONE,
    order: [...ISSUE_PRIORITY_ORDER],
    offerNone: true,
    icon: getPriorityIcon,
  },
  // No complexity filter: the field is abandoned. It was on 94% of issues
  // filed in Dec 2025 and 0% of those filed in July and August 2026 — agents
  // simply stopped writing it. Filtering on it would sort the backlog by when
  // it was written rather than by anything about the work. It still renders in
  // the detail view for the 116 older issues that carry one.
];

const SIMPLE_FILTERS: FilterSpec[] = [
  {
    key: 'status',
    label: 'Status',
    read: (f) => f.status ?? NONE,
    order: ['active', ...ISSUE_STATE_ORDER],
    labels: ISSUE_STATE_LABELS,
    icon: getStatusIcon,
  },
];

export const FilterableList: React.FC<FilterableListProps> = ({
  files,
  section,
  basePath,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selected, setSelected] = useState<Record<string, string>>({});

  const isIssues = section === 'issues';
  const specs = isIssues ? ISSUE_FILTERS : SIMPLE_FILTERS;
  const noun = isIssues ? 'issues' : section;

  const matchesSearch = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return () => true;
    return (file: MarkdownFile) =>
      file.title.toLowerCase().includes(term) ||
      file.path.toLowerCase().includes(term);
  }, [searchTerm]);

  const matchesSpec = (file: MarkdownFile, spec: FilterSpec) => {
    const active = selected[spec.key];
    return !active || active === 'all' || spec.read(file) === active;
  };

  const filteredFiles = useMemo(
    () =>
      files.filter(
        (file) =>
          matchesSearch(file) && specs.every((spec) => matchesSpec(file, spec))
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [files, matchesSearch, selected, specs]
  );

  /**
   * Options per filter, counted against every other active filter. Each
   * dimension is counted on the set that excludes only itself, so its own chips
   * stay clickable instead of collapsing to the one already selected.
   */
  const filterOptions = useMemo(() => {
    return specs.map((spec) => {
      const pool = files.filter(
        (file) =>
          matchesSearch(file) &&
          specs.every((other) => other.key === spec.key || matchesSpec(file, other))
      );

      const counts = new Map<string, number>();
      pool.forEach((file) => {
        const value = spec.read(file);
        counts.set(value, (counts.get(value) ?? 0) + 1);
      });

      const known = spec.order.filter((value) => (counts.get(value) ?? 0) > 0);
      const extra = [...counts.keys()]
        .filter((value) => value !== NONE && !spec.order.includes(value))
        .sort();

      const options: FilterOption[] = [
        { label: 'All', value: 'all', count: pool.length },
        ...[...known, ...extra].map((value) => ({
          label: spec.labels?.[value] ?? capitalize(value),
          value,
          count: counts.get(value) ?? 0,
        })),
      ];

      if (spec.offerNone && (counts.get(NONE) ?? 0) > 0) {
        options.push({
          label: 'None',
          value: NONE,
          count: counts.get(NONE) ?? 0,
        });
      }

      return { spec, options };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, matchesSearch, selected, specs]);

  const activeCount = specs.filter(
    (spec) => selected[spec.key] && selected[spec.key] !== 'all'
  ).length;

  return (
    <div>
      {/* Filters Section */}
      <div className="bg-surface-1 rounded-lg border border-default p-4 mb-6">
        <Flex direction="column" gap="md">
          {/* Search */}
          <div>
            <span className="text-sm font-medium text-subtle mb-2">
              Search
            </span>
            <Input
              type="text"
              placeholder={`Search ${noun}...`}
              variant="bordered"
              value={searchTerm}
              onChange={(value: string) => setSearchTerm(value)}
            />
          </div>

          {filterOptions.map(({ spec, options }) =>
            options.length > 1 ? (
              <div key={spec.key}>
                <span className="text-sm font-medium text-subtle mb-2">
                  {spec.label}
                </span>
                <Flex gap="xs" className="flex-wrap">
                  {options.map((option) => {
                    const isActive =
                      (selected[spec.key] ?? 'all') === option.value;
                    return (
                      <button
                        key={option.value}
                        onClick={() =>
                          setSelected((prev) => ({
                            ...prev,
                            [spec.key]: option.value,
                          }))
                        }
                        className={`px-3 py-1.5 rounded-md text-sm transition-colors flex items-center gap-1.5 cursor-pointer ${
                          isActive
                            ? 'bg-accent text-white'
                            : 'bg-surface-2 text-main hover:bg-surface-3'
                        }`}
                      >
                        {option.value !== 'all' &&
                          option.value !== NONE &&
                          spec.icon && (
                            <Icon name={spec.icon(option.value)} size="sm" />
                          )}
                        {option.label} ({option.count})
                      </button>
                    );
                  })}
                </Flex>
              </div>
            ) : null
          )}

          {/* Results count */}
          <div className="pt-2 border-t border-default">
            <Flex gap="sm" align="center" className="flex-wrap">
              <span className="text-sm text-subtle">
                Showing {filteredFiles.length} of {files.length} {noun}
              </span>
              {(activeCount > 0 || searchTerm) && (
                <button
                  onClick={() => {
                    setSelected({});
                    setSearchTerm('');
                  }}
                  className="text-sm text-accent hover:underline cursor-pointer"
                >
                  Clear filters
                </button>
              )}
            </Flex>
          </div>
        </Flex>
      </div>

      {/* List Section */}
      <div className="bg-surface-1 rounded-lg border border-default overflow-hidden">
        <div className="p-6">
          {filteredFiles.length > 0 ? (
            isIssues ? (
              <IssueGroups files={filteredFiles} basePath={basePath} />
            ) : (
              <FolderTree files={filteredFiles} basePath={basePath} />
            )
          ) : (
            <div className="text-center py-12">
              <Icon
                name="search"
                size="2xl"
                className="text-muted mx-auto mb-4"
              />
              <span className="text-lg text-subtle">
                No {noun} found
              </span>
              <span className="text-sm text-muted">
                Try adjusting your filters
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/** Newest first, then alphabetical. Undated files sort to the bottom. */
const byDateThenTitle = (a: MarkdownFile, b: MarkdownFile) => {
  const dateA = a.sortDate || '';
  const dateB = b.sortDate || '';
  if (dateA !== dateB) return dateB.localeCompare(dateA);
  return a.title.localeCompare(b.title);
};

const FileRow: React.FC<{ file: MarkdownFile; basePath: string }> = ({
  file,
  basePath,
}) => (
  <li>
    <Link
      to={`${basePath}/${file.slug}`}
      className="block hover:text-accent transition-colors"
    >
      <Flex gap="sm" align="center" className="flex-wrap">
        <span className="text-base text-main">
          • {file.title}
        </span>
        {file.issueType && (
          <span
            className={`px-2 py-0.5 rounded text-xs flex items-center gap-1 ${getTypeStyle(
              file.issueType
            )}`}
          >
            <Icon name={getTypeIcon(file.issueType)} size="xs" />
            {file.issueType}
          </span>
        )}
        {file.status && (
          <span
            className={`px-2 py-0.5 rounded text-xs flex items-center gap-1 ${getStatusStyle(
              file.status
            )}`}
          >
            <Icon name={getStatusIcon(file.status)} size="xs" />
            {file.status}
          </span>
        )}
        {file.priority && (
          <span
            className={`px-2 py-0.5 rounded text-xs flex items-center gap-1 ${getPriorityStyle(
              file.priority
            )}`}
          >
            <Icon name={getPriorityIcon(file.priority)} size="xs" />
            {file.priority}
          </span>
        )}
        {file.parseError && (
          <span className="px-2 py-0.5 rounded text-xs flex items-center gap-1 bg-danger/20 text-danger border border-danger/30">
            <Icon name="warning" size="xs" />
            invalid frontmatter
          </span>
        )}
      </Flex>
    </Link>
  </li>
);

/**
 * Issues grouped by epic.
 *
 * Only the epic is a heading. The status folders (`.done/`, `.archived/`, and
 * an epic's own nested ones) are deliberately flattened away: state is a filter
 * now, so rendering it as a second level of headings would split every epic
 * into piles that the chips already separate on demand.
 */
const IssueGroups: React.FC<{ files: MarkdownFile[]; basePath: string }> = ({
  files,
  basePath,
}) => {
  const { ungrouped, epics } = useMemo(() => {
    const loose: MarkdownFile[] = [];
    const grouped = new Map<string, MarkdownFile[]>();

    files.forEach((file) => {
      if (file.epic) {
        const bucket = grouped.get(file.epic) ?? [];
        bucket.push(file);
        grouped.set(file.epic, bucket);
      } else {
        loose.push(file);
      }
    });

    loose.sort(byDateThenTitle);
    grouped.forEach((bucket) => bucket.sort(byDateThenTitle));

    return {
      ungrouped: loose,
      epics: [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0])),
    };
  }, [files]);

  return (
    <div className="space-y-4">
      {ungrouped.length > 0 && (
        <ul className="space-y-2">
          {ungrouped.map((file) => (
            <FileRow key={file.path} file={file} basePath={basePath} />
          ))}
        </ul>
      )}

      {epics.map(([epic, epicFiles]) => (
        <div key={epic} className="space-y-3">
          <div className="mb-2">
            <Flex gap="xs" align="center">
              <Icon name="folder" size="md" className="text-accent" />
              <span className="text-lg font-semibold text-main text-accent">
                {capitalize(epic)}
              </span>
              <span className="text-sm text-subtle">
                ({epicFiles.length})
              </span>
            </Flex>
            <div className="h-px bg-surface-5 mt-1" />
          </div>
          <ul className="space-y-2 mb-4">
            {epicFiles.map((file) => (
              <FileRow key={file.path} file={file} basePath={basePath} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

interface FolderNode {
  name: string;
  path: string;
  files: MarkdownFile[];
  subfolders: FolderNode[];
}

/** Docs and reports keep the nested folder tree — their folders are subject
 *  matter (features/, debugging/), not status. */
const FolderTree: React.FC<{ files: MarkdownFile[]; basePath: string }> = ({
  files,
  basePath,
}) => {
  const root = useMemo(() => {
    const tree: FolderNode = { name: 'root', path: '', files: [], subfolders: [] };

    files.forEach((file) => {
      const folder = file.folder || 'root';

      if (folder === 'root') {
        tree.files.push(file);
        return;
      }

      const folderParts = folder.split('/');

      // A root-level dot folder (.archived, .done) is status, not subject
      // matter, so its files render at the top level.
      if (folderParts.length === 1 && folderParts[0].startsWith('.')) {
        tree.files.push(file);
        return;
      }

      let currentNode = tree;
      let currentPath = '';

      folderParts.forEach((part) => {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        let subfolder = currentNode.subfolders.find((sf) => sf.name === part);
        if (!subfolder) {
          subfolder = { name: part, path: currentPath, files: [], subfolders: [] };
          currentNode.subfolders.push(subfolder);
        }
        currentNode = subfolder;
      });

      currentNode.files.push(file);
    });

    const sortNode = (node: FolderNode) => {
      node.files.sort((a, b) => a.title.localeCompare(b.title));
      node.subfolders.sort((a, b) => a.name.localeCompare(b.name));
      node.subfolders.forEach(sortNode);
    };

    sortNode(tree);
    return tree;
  }, [files]);

  return (
    <div className="space-y-4">
      {root.files.length > 0 && (
        <ul className="space-y-2">
          {root.files.map((file) => (
            <FileRow key={file.path} file={file} basePath={basePath} />
          ))}
        </ul>
      )}
      {root.subfolders.map((folder) => (
        <FolderView
          key={folder.path}
          folder={folder}
          basePath={basePath}
          level={0}
        />
      ))}
    </div>
  );
};

const FolderView: React.FC<{
  folder: FolderNode;
  basePath: string;
  level: number;
}> = ({ folder, basePath, level }) => (
  <div style={{ marginLeft: `${level * 20}px` }} className="space-y-3">
    <div className="mb-2">
      <Flex gap="xs" align="center">
        <Icon name="folder" size="md" className="text-accent" />
        <span className="text-lg font-semibold text-main text-accent">
          {capitalize(folder.name)}
        </span>
      </Flex>
      <div className="h-px bg-surface-5 mt-1" />
    </div>

    {folder.files.length > 0 && (
      <ul className="space-y-2 mb-4">
        {folder.files.map((file) => (
          <FileRow key={file.path} file={file} basePath={basePath} />
        ))}
      </ul>
    )}

    {folder.subfolders.map((subfolder) => (
      <FolderView
        key={subfolder.path}
        folder={subfolder}
        basePath={basePath}
        level={level + 1}
      />
    ))}
  </div>
);

// Helper functions for styling
function getStatusStyle(status: string): string {
  switch (status) {
    case 'done':
      return 'bg-success/20 text-success border border-success/30';
    case 'in-progress':
      return 'bg-accent-rgb/20 text-accent border border-accent-rgb/30';
    case 'on-hold':
      return 'bg-warning/20 text-warning border border-warning/30';
    case 'open':
      return 'bg-surface-2 text-subtle border border-default';
    case 'deferred':
      return 'bg-info/20 text-info border border-info/30';
    case 'archived':
      return 'bg-surface-3 text-muted border border-subtle';
    default:
      return 'bg-surface-2 text-subtle border border-default';
  }
}

function getTypeStyle(type: string): string {
  return type === 'bug'
    ? 'bg-danger/20 text-danger border border-danger/30'
    : 'bg-accent-rgb/10 text-accent border border-accent-rgb/20';
}

function getPriorityStyle(priority: string): string {
  switch (priority) {
    case 'low':
      return 'bg-success/20 text-success border border-success/30';
    case 'medium':
      return 'bg-accent-rgb/20 text-accent border border-accent-rgb/30';
    case 'high':
      return 'bg-danger/20 text-danger border border-danger/30';
    default:
      return 'bg-surface-2 text-subtle border border-default';
  }
}
