export interface FrontmatterData {
  type?: 'task' | 'bug' | 'doc' | 'report';
  title?: string;
  status?: 'open' | 'in-progress' | 'on-hold' | 'done' | 'archived';
  complexity?: 'low' | 'medium' | 'high' | 'very-high'; // tasks only
  priority?: 'low' | 'medium' | 'high' | 'critical'; // bugs only
  ai_generated?: boolean;
  reviewed_by?: 'human' | 'agent' | null;
  created?: string; // YYYY-MM-DD
  updated?: string; // YYYY-MM-DD
  related_issues?: string[]; // ["#14", "#15"]
  related_docs?: string[]; // [doc-slug-1]
  related_tasks?: string[]; // [task-slug-1]
  related_bugs?: string[]; // [bug-slug-1]
}
