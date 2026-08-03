/**
 * Frontmatter as the `.agents/` convention defines it.
 *
 * These are the fields the viewer understands. They are not the only fields
 * present: agents have written ~90 one-off keys across the tree (`severity`,
 * `area`, `repos`, `spans-repos`, `verified-by`, …), which is why the index
 * signature is here and why the detail view renders whatever it does not
 * recognise instead of dropping it.
 *
 * Every field is optional on purpose. Some files predate the convention, and
 * eight currently have YAML broken enough that nothing parses at all.
 */
export interface FrontmatterData {
  /** `task` or `bug` for issues; `doc` / `report` for the other two sections. */
  type?: 'task' | 'bug' | 'doc' | 'report';
  title?: string;
  /**
   * Advisory for issues — the folder is the source of truth there, since a
   * file's status field routinely goes stale when it is moved. See
   * `issueTaxonomy.deriveState`.
   */
  status?: 'open' | 'in-progress' | 'on-hold' | 'done' | 'archived' | 'deferred';
  complexity?: 'low' | 'medium' | 'high' | 'very-high';
  /** Normalised to low/medium/high on read; `critical` folds into `high`. */
  priority?: string;
  /** Free prose, bugs mostly. Displayed, never filtered on. */
  severity?: string;
  ai_generated?: boolean;
  reviewed_by?: 'human' | 'agent' | null;
  created?: string; // YYYY-MM-DD
  updated?: string; // YYYY-MM-DD
  related_issues?: string[]; // ["#14", "#15"]
  related_docs?: string[]; // [doc-slug-1]
  related_tasks?: string[]; // [task-slug-1]
  related_bugs?: string[]; // [bug-slug-1]
  [key: string]: unknown;
}
