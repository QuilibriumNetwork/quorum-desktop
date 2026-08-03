#!/usr/bin/env python3
"""
Documentation Index Update Script for .agents directory

This script performs documentation index synchronization by:
1. Scanning all markdown files in .agents directory
2. Extracting titles from files
3. Organizing files by folder structure (docs -> issues -> reports)
   Supports both the current merged issues/ layout (bug-vs-task carried in
   `type:` frontmatter) and the legacy bugs/ + tasks/ layout.
4. Maintaining proper subfolder groupings
5. Updating the "Last Updated" timestamp in INDEX.md

Usage: python3 update-index.py

Cross-platform compatible: Works on Windows, macOS, and Linux.
"""

import os
import re
import sys
from datetime import datetime

# Configure stdout for UTF-8 on Windows to support emoji/unicode output
if sys.platform == 'win32':
    try:
        # Try to set UTF-8 mode for stdout
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass  # Fall back to default encoding if reconfigure fails

# Cross-platform symbols (use ASCII fallbacks on Windows if needed)
def get_symbols():
    """Return symbols appropriate for the current platform/encoding."""
    try:
        # Test if we can print unicode
        test = '\u2714'  # checkmark
        test.encode(sys.stdout.encoding or 'utf-8')
        return {
            'check': '\u2714',      # ✔
            'cross': '\u2718',      # ✘
            'warning': '!',         # ! (warning emoji often fails even with UTF-8)
            'success': '[OK]',
            'error': '[ERROR]',
            'partial': '[PARTIAL]'
        }
    except (UnicodeEncodeError, LookupError):
        return {
            'check': '[OK]',
            'cross': '[X]',
            'warning': '[!]',
            'success': '[OK]',
            'error': '[ERROR]',
            'partial': '[PARTIAL]'
        }

SYMBOLS = get_symbols()

def extract_title(file_path):
    """Extract the first # title from a markdown file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Look for first # heading
        match = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
        if match:
            return match.group(1).strip()

        # Fallback to filename without extension, formatted nicely
        return os.path.splitext(os.path.basename(file_path))[0].replace('-', ' ').replace('_', ' ').title()
    except Exception as e:
        print(f'Error reading {file_path}: {e}')
        return os.path.splitext(os.path.basename(file_path))[0]

def extract_type(file_path):
    """Extract the `type:` value from a file's YAML frontmatter.

    Returns the lowercase type (e.g. 'bug', 'task') or None when the file has
    no frontmatter or no type field. Only the head of the file is read.
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            head = f.read(2048)

        if not head.startswith('---'):
            return None

        end = head.find('\n---', 3)
        frontmatter = head[3:end] if end != -1 else head[3:]

        match = re.search(r'^type:\s*["\']?([A-Za-z0-9_-]+)', frontmatter, re.MULTILINE)
        return match.group(1).strip().lower() if match else None
    except Exception:
        return None


# Inline markers so bugs and tasks stay distinguishable inside a merged issues/ list.
TYPE_MARKERS = {'bug': '\U0001F41B', 'task': '\U0001F4CB'}
TYPE_ORDER = {'bug': 0, 'task': 1}


def render_entry(file_info):
    """Render one INDEX.md list item, prefixed with its type marker when known."""
    marker = TYPE_MARKERS.get(file_info.get('type') or '')
    prefix = f'{marker} ' if marker else ''
    return f'- {prefix}[{file_info["title"]}]({file_info["path"]})'


def get_file_sort_key(file_info):
    """
    Generate sorting key for files considering numeric prefixes.
    Files with numeric prefixes (01-file.md, 02-file.md) are sorted by number.
    Files without numbers are sorted alphabetically after numbered files.
    """
    filename = file_info['filename']

    # Check for numeric prefix (e.g., 01-filename.md, 1-filename.md, 001-filename.md)
    match = re.match(r'^(\d+)-', filename)
    if match:
        # Return tuple: (0, number) for numbered files (0 ensures they come first)
        number = int(match.group(1))
        return (0, number, filename.lower())
    else:
        # Return tuple: (1, title) for non-numbered files (1 ensures they come after numbered)
        return (1, 0, file_info['title'].lower())

def sort_files_smart(file_list):
    """Sort files with numeric prefixes first (by number), then alphabetically by title"""
    return sorted(file_list, key=get_file_sort_key)


def sort_issues(file_list):
    """Sort merged issues: bugs first, then tasks, then untyped; smart-sorted within each group."""
    return sorted(file_list, key=lambda fi: (TYPE_ORDER.get(fi.get('type') or '', 2),) + get_file_sort_key(fi))


# Status subfolders under issues/. Anything else is an "epic" folder: a big issue
# broken into sub-issues, which may itself contain status subfolders.
ISSUE_STATUS_DIRS = {
    '.open': 'open',
    '.deferred': 'deferred',
    '.done': 'done',
    '.archived': 'archived',
}


def format_epic_title(epic):
    """Turn an epic path into a heading: 'auth-rework/.done' -> 'Auth Rework / Done'."""
    parts = [p.lstrip('.').replace('-', ' ').replace('_', ' ').title() for p in epic.split('/')]
    return ' / '.join(p for p in parts if p)


def new_issue_group():
    """A status bucket: loose files at its root, plus epic subfolders keyed by relative path."""
    return {'root': [], 'epics': {}}


def render_issue_group(lines, group, status_level):
    """Append a status bucket's files to INDEX lines, epics grouped under their own headings.

    status_level is the heading prefix for epic headings (one level below the
    status heading that precedes this call).
    """
    for file_info in group['root']:
        lines.append(render_entry(file_info))
    if group['root']:
        lines.append('')

    for epic in sorted(group['epics'].keys()):
        lines.append(f'{status_level} {format_epic_title(epic)}')
        lines.append('')
        for file_info in group['epics'][epic]:
            lines.append(render_entry(file_info))
        lines.append('')


def find_agents_directory():
    """Find the .agents directory for the project being worked on.

    Resolution order (most specific to least):
      1. Explicit path passed as argv[1] (a project dir or its .agents dir).
      2. The current working directory's .agents — this is the project you're in.
      3. The parent of the cwd's .agents.
      4. ONLY as a last resort, the skill-relative .agents (script ../../../).

    The skill-relative path is checked LAST on purpose. The skill lives in a
    shared/global config dir (e.g. ~/.config/.claude/skills/...), and going up
    three levels from there lands on the GLOBAL agents vault (~/.config/.agents),
    which exists. Checking that first made the script silently update the wrong
    project's INDEX. The cwd (the project you ran the script from) must win.
    """
    # 1. Explicit path argument (accepts either the project dir or its .agents).
    if len(sys.argv) > 1 and sys.argv[1].strip():
        arg = os.path.abspath(sys.argv[1])
        candidate = arg if os.path.basename(arg) == '.agents' else os.path.join(arg, '.agents')
        if os.path.exists(candidate):
            return candidate

    # 2. Current working directory (the project you're in).
    agents_from_cwd = os.path.join(os.getcwd(), '.agents')
    if os.path.exists(agents_from_cwd):
        return agents_from_cwd

    # 3. Parent of the cwd.
    parent_dir = os.path.dirname(os.getcwd())
    agents_from_parent = os.path.join(parent_dir, '.agents')
    if os.path.exists(agents_from_parent):
        return agents_from_parent

    # 4. Last resort: skill-relative (only when not run from a project).
    script_dir = os.path.dirname(os.path.abspath(__file__))
    agents_from_skill = os.path.abspath(os.path.join(script_dir, '..', '..', '..', '.agents'))
    if os.path.exists(agents_from_skill):
        return agents_from_skill

    return None


def scan_agents_directory():
    """Scan .agents directory and build file structure"""
    agents_root = find_agents_directory()

    if not agents_root:
        raise FileNotFoundError(
            ".agents directory not found. Please run this script from your project root "
            "or ensure the .agents folder exists."
        )

    print(f'[INFO] Found .agents directory at: {agents_root}')

    # Organize by structure - DOCS FIRST, BUGS SECOND, TASKS THIRD, REPORTS FOURTH
    docs_root = []
    docs_subfolders = {}  # e.g., 'features' -> [files], 'features/primitives' -> [files]

    # Merged issues/ layout (current). Bugs and tasks share one tree; the
    # bug-vs-task distinction lives in each file's `type:` frontmatter.
    # The first path segment sets the status; anything deeper is an epic folder
    # (a big issue split into sub-issues) and stays grouped under its epic.
    issues = {
        'active': new_issue_group(),    # issues/*.md       -> in progress
        'open': new_issue_group(),      # issues/.open/     -> not started / unfixed
        'deferred': new_issue_group(),  # issues/.deferred/ -> consciously postponed
        'done': new_issue_group(),      # issues/.done/     -> fixed or completed
        'archived': new_issue_group(),  # issues/.archived/ -> obsolete / won't fix
    }

    # Legacy bugs/ + tasks/ layout, kept so un-migrated repos keep indexing.
    bugs_active = []
    bugs_solved = []  # Will be populated from .solved folder
    bugs_subfolders = {}

    tasks_pending = []  # Tasks directly in tasks/ folder
    tasks_subfolders = {}  # Subfolders in tasks/ (except .done)
    tasks_done = []  # Tasks in tasks/.done/
    tasks_done_subfolders = {}  # Subfolders in tasks/.done/

    reports_active = []  # Reports directly in reports/ folder
    reports_subfolders = {}  # Subfolders in reports/ (except .done)
    reports_done = []  # Reports in reports/.done/
    reports_done_subfolders = {}  # Subfolders in reports/.done/

    for root, _, files in os.walk(agents_root):
        for file in files:
            if file.endswith('.md') and file != 'INDEX.md':
                file_path = os.path.join(root, file)
                relative_path = os.path.relpath(file_path, agents_root)
                # Normalize path separators for cross-platform compatibility
                relative_path_normalized = relative_path.replace('\\', '/')

                # Extract title and create file info
                title = extract_title(file_path)
                file_info = {
                    'title': title,
                    'path': relative_path_normalized,
                    'filename': file,
                    'type': extract_type(file_path)
                }

                # Categorize files based on their path (use normalized path)
                if relative_path_normalized.startswith('docs/'):
                    path_parts = relative_path_normalized.split('/')
                    if len(path_parts) == 2:  # docs/file.md
                        docs_root.append(file_info)
                    else:  # docs/subfolder/... files
                        subfolder = '/'.join(path_parts[1:-1])  # Get subfolder path
                        if subfolder not in docs_subfolders:
                            docs_subfolders[subfolder] = []
                        docs_subfolders[subfolder].append(file_info)

                elif relative_path_normalized.startswith('issues/'):
                    # Directories between issues/ and the file itself.
                    inner = relative_path_normalized.split('/')[1:-1]

                    # A leading status folder sets the status; without one the
                    # issue sits at the root of issues/, meaning in progress.
                    status = 'active'
                    if inner and inner[0] in ISSUE_STATUS_DIRS:
                        status = ISSUE_STATUS_DIRS[inner[0]]
                        inner = inner[1:]

                    # Whatever remains is the epic path (empty for loose issues).
                    epic = '/'.join(inner)
                    group = issues[status]
                    if epic:
                        group['epics'].setdefault(epic, []).append(file_info)
                    else:
                        group['root'].append(file_info)

                elif relative_path_normalized.startswith('bugs/'):
                    path_parts = relative_path_normalized.split('/')

                    # Check if file is in .solved folder
                    if relative_path_normalized.startswith('bugs/.solved/'):
                        if len(path_parts) == 3:  # bugs/.solved/file.md
                            bugs_solved.append(file_info)
                        else:  # bugs/.solved/subfolder/... files
                            subfolder = '/'.join(path_parts[2:-1])
                            if subfolder not in bugs_subfolders:
                                bugs_subfolders[subfolder] = []
                            bugs_subfolders[subfolder].append(file_info)
                    elif len(path_parts) == 2:  # bugs/file.md (active bugs)
                        bugs_active.append(file_info)
                    else:  # bugs/subfolder/... files (not .solved)
                        subfolder = '/'.join(path_parts[1:-1])
                        if subfolder not in bugs_subfolders:
                            bugs_subfolders[subfolder] = []
                        bugs_subfolders[subfolder].append(file_info)

                elif relative_path_normalized.startswith('tasks/'):
                    path_parts = relative_path_normalized.split('/')

                    # Check if file is in .done folder
                    if relative_path_normalized.startswith('tasks/.done/'):
                        if len(path_parts) == 3:  # tasks/.done/file.md
                            tasks_done.append(file_info)
                        else:  # tasks/.done/subfolder/... files
                            subfolder = '/'.join(path_parts[2:-1])
                            if subfolder not in tasks_done_subfolders:
                                tasks_done_subfolders[subfolder] = []
                            tasks_done_subfolders[subfolder].append(file_info)

                    elif len(path_parts) == 2:  # tasks/file.md (pending tasks)
                        tasks_pending.append(file_info)
                    else:  # tasks/subfolder/... files (not .done)
                        subfolder = '/'.join(path_parts[1:-1])
                        # Skip .done folder itself
                        if not subfolder.startswith('.done'):
                            if subfolder not in tasks_subfolders:
                                tasks_subfolders[subfolder] = []
                            tasks_subfolders[subfolder].append(file_info)

                elif relative_path_normalized.startswith('reports/'):
                    path_parts = relative_path_normalized.split('/')

                    # Check if file is in .done folder
                    if relative_path_normalized.startswith('reports/.done/'):
                        if len(path_parts) == 3:  # reports/.done/file.md
                            reports_done.append(file_info)
                        else:  # reports/.done/subfolder/... files
                            subfolder = '/'.join(path_parts[2:-1])
                            if subfolder not in reports_done_subfolders:
                                reports_done_subfolders[subfolder] = []
                            reports_done_subfolders[subfolder].append(file_info)

                    elif len(path_parts) == 2:  # reports/file.md (active reports)
                        reports_active.append(file_info)
                    else:  # reports/subfolder/... files (not .done)
                        subfolder = '/'.join(path_parts[1:-1])
                        # Skip .done folder itself
                        if not subfolder.startswith('.done'):
                            if subfolder not in reports_subfolders:
                                reports_subfolders[subfolder] = []
                            reports_subfolders[subfolder].append(file_info)

    # Issues sort bugs before tasks, then smart-sort within each type group
    for group in issues.values():
        group['root'] = sort_issues(group['root'])
        for epic in group['epics']:
            group['epics'][epic] = sort_issues(group['epics'][epic])

    # Sort all sections using smart sorting (numbered files first, then alphabetical)
    docs_root = sort_files_smart(docs_root)
    bugs_active = sort_files_smart(bugs_active)
    bugs_solved = sort_files_smart(bugs_solved)
    tasks_pending = sort_files_smart(tasks_pending)
    tasks_done = sort_files_smart(tasks_done)
    reports_active = sort_files_smart(reports_active)
    reports_done = sort_files_smart(reports_done)

    # Sort subfolders and their contents (each folder treated independently)
    for subfolder in docs_subfolders:
        docs_subfolders[subfolder] = sort_files_smart(docs_subfolders[subfolder])
    for subfolder in bugs_subfolders:
        bugs_subfolders[subfolder] = sort_files_smart(bugs_subfolders[subfolder])
    for subfolder in tasks_subfolders:
        tasks_subfolders[subfolder] = sort_files_smart(tasks_subfolders[subfolder])
    for subfolder in tasks_done_subfolders:
        tasks_done_subfolders[subfolder] = sort_files_smart(tasks_done_subfolders[subfolder])
    for subfolder in reports_subfolders:
        reports_subfolders[subfolder] = sort_files_smart(reports_subfolders[subfolder])
    for subfolder in reports_done_subfolders:
        reports_done_subfolders[subfolder] = sort_files_smart(reports_done_subfolders[subfolder])

    # Generate INDEX.md content
    index_content = []
    index_content.append('# Documentation Index')
    index_content.append('')
    index_content.append('This is the main index for all documentation, bug reports, and task management.')
    index_content.append('')

    # DOCS SECTION - FIRST (as requested)
    index_content.append('## 📖 Documentation')
    index_content.append('')

    # Root docs files first
    for file_info in docs_root:
        index_content.append(f'- [{file_info["title"]}]({file_info["path"]})')
    if docs_root:
        index_content.append('')

    # Docs subfolders
    for subfolder in sorted(docs_subfolders.keys()):
        subfolder_title = subfolder.replace('-', ' ').replace('_', ' ').title()
        # Handle special case for features/primitives
        if '/' in subfolder_title:
            subfolder_title = subfolder_title.replace('/', ' / ')
        index_content.append(f'### {subfolder_title}')
        for file_info in docs_subfolders[subfolder]:
            index_content.append(f'- [{file_info["title"]}]({file_info["path"]})')
        index_content.append('')

    # ISSUES SECTION - SECOND (merged bugs + tasks)
    def group_has_files(group):
        return bool(group['root'] or group['epics'])

    if any(group_has_files(g) for g in issues.values()):
        # Live statuses share one heading; completed and archived get their own
        # so the long tail stays out of the way.
        if any(group_has_files(issues[s]) for s in ('active', 'open', 'deferred')):
            index_content.append('## \U0001F41B\U0001F4CB Issues')
            index_content.append('')
            index_content.append(f'{TYPE_MARKERS["bug"]} bug &nbsp;&nbsp; {TYPE_MARKERS["task"]} task')
            index_content.append('')

            for heading, status in (('In Progress', 'active'), ('Open', 'open'), ('Deferred', 'deferred')):
                if group_has_files(issues[status]):
                    index_content.append(f'### {heading}')
                    index_content.append('')
                    render_issue_group(index_content, issues[status], '####')

        for heading, status in (('✅ Completed Issues', 'done'),
                                ('\U0001F5C3️ Archived Issues', 'archived')):
            if group_has_files(issues[status]):
                index_content.append(f'## {heading}')
                index_content.append('')
                render_issue_group(index_content, issues[status], '###')

    # BUGS SECTION - SECOND
    if bugs_active or bugs_solved or bugs_subfolders:
        index_content.append('## 🐛 Bug Reports')
        index_content.append('')

        if bugs_active:
            index_content.append('### Active Issues')
            for file_info in bugs_active:
                index_content.append(f'- [{file_info["title"]}]({file_info["path"]})')
            index_content.append('')

        if bugs_solved:
            index_content.append('### Solved Issues')
            for file_info in bugs_solved:
                index_content.append(f'- [{file_info["title"]}]({file_info["path"]})')
            index_content.append('')

        # Bugs subfolders
        for subfolder in sorted(bugs_subfolders.keys()):
            subfolder_title = subfolder.replace('-', ' ').replace('_', ' ').title()
            index_content.append(f'### {subfolder_title}')
            for file_info in bugs_subfolders[subfolder]:
                index_content.append(f'- [{file_info["title"]}]({file_info["path"]})')
            index_content.append('')

    # TASKS SECTION - THIRD
    # Pending/Active Tasks
    if tasks_pending or tasks_subfolders:
        index_content.append('## 📋 Tasks')
        index_content.append('')

        if tasks_pending:
            index_content.append('### Pending Tasks')
            index_content.append('')
            # Root pending files
            for file_info in tasks_pending:
                index_content.append(f'- [{file_info["title"]}]({file_info["path"]})')
            index_content.append('')

        # Task subfolders (excluding .done)
        for subfolder in sorted(tasks_subfolders.keys()):
            subfolder_title = subfolder.replace('-', ' ').replace('_', ' ').title()
            if '/' in subfolder_title:
                subfolder_title = subfolder_title.replace('/', ' ')
            index_content.append(f'### {subfolder_title}')
            for file_info in tasks_subfolders[subfolder]:
                index_content.append(f'- [{file_info["title"]}]({file_info["path"]})')
            index_content.append('')

    # Completed Tasks
    if tasks_done or tasks_done_subfolders:
        index_content.append('## 📋 Completed Tasks')
        index_content.append('')

        # Root done files first
        for file_info in tasks_done:
            index_content.append(f'- [{file_info["title"]}]({file_info["path"]})')
        if tasks_done:
            index_content.append('')

        # Done subfolders
        for subfolder in sorted(tasks_done_subfolders.keys()):
            subfolder_title = subfolder.replace('-', ' ').replace('_', ' ').title()
            if '/' in subfolder_title:
                subfolder_title = subfolder_title.replace('/', '/')
            index_content.append(f'### {subfolder_title}')
            for file_info in tasks_done_subfolders[subfolder]:
                index_content.append(f'- [{file_info["title"]}]({file_info["path"]})')
            index_content.append('')

    # REPORTS SECTION - FOURTH
    # Active Reports
    if reports_active or reports_subfolders:
        index_content.append('## 📊 Reports')
        index_content.append('')

        if reports_active:
            index_content.append('### Active Reports')
            index_content.append('')
            # Root active files
            for file_info in reports_active:
                index_content.append(f'- [{file_info["title"]}]({file_info["path"]})')
            index_content.append('')

        # Reports subfolders (excluding .done)
        for subfolder in sorted(reports_subfolders.keys()):
            subfolder_title = subfolder.replace('-', ' ').replace('_', ' ').title()
            if '/' in subfolder_title:
                subfolder_title = subfolder_title.replace('/', ' ')
            index_content.append(f'### {subfolder_title}')
            for file_info in reports_subfolders[subfolder]:
                index_content.append(f'- [{file_info["title"]}]({file_info["path"]})')
            index_content.append('')

    # Completed Reports
    if reports_done or reports_done_subfolders:
        index_content.append('## 📊 Completed Reports')
        index_content.append('')

        # Root done files first
        for file_info in reports_done:
            index_content.append(f'- [{file_info["title"]}]({file_info["path"]})')
        if reports_done:
            index_content.append('')

        # Done subfolders
        for subfolder in sorted(reports_done_subfolders.keys()):
            subfolder_title = subfolder.replace('-', ' ').replace('_', ' ').title()
            if '/' in subfolder_title:
                subfolder_title = subfolder_title.replace('/', '/')
            index_content.append(f'### {subfolder_title}')
            for file_info in reports_done_subfolders[subfolder]:
                index_content.append(f'- [{file_info["title"]}]({file_info["path"]})')
            index_content.append('')

    # Footer with timestamp
    index_content.append('---')
    index_content.append('')
    current_date = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    index_content.append(f'**Last Updated**: {current_date}')

    # Write INDEX.md
    index_path = os.path.join(agents_root, 'INDEX.md')
    with open(index_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(index_content))

    # Summary
    all_issues = [f
                  for group in issues.values()
                  for files in [group['root']] + list(group['epics'].values())
                  for f in files]

    total_files = (len(all_issues) +
                   len(docs_root) + sum(len(files) for files in docs_subfolders.values()) +
                   len(bugs_active) + len(bugs_solved) + sum(len(files) for files in bugs_subfolders.values()) +
                   len(tasks_pending) + sum(len(files) for files in tasks_subfolders.values()) +
                   len(tasks_done) + sum(len(files) for files in tasks_done_subfolders.values()) +
                   len(reports_active) + sum(len(files) for files in reports_subfolders.values()) +
                   len(reports_done) + sum(len(files) for files in reports_done_subfolders.values()))

    print(f'{SYMBOLS["check"]} Updated {index_path}')
    print(f'[FILES] Processed {total_files} markdown files')

    if all_issues:
        bugs = sum(1 for f in all_issues if f.get('type') == 'bug')
        tasks = sum(1 for f in all_issues if f.get('type') == 'task')
        untyped = [f for f in all_issues if f.get('type') not in ('bug', 'task')]
        print(f'[ISSUES] Issues: {len(all_issues)} files ({bugs} bug, {tasks} task, {len(untyped)} untyped)')
        if untyped:
            print(f'{SYMBOLS["warning"]} {len(untyped)} issue(s) missing a valid `type:` (bug|task) in frontmatter:')
            for f in untyped[:10]:
                print(f'    - {f["path"]}')
            if len(untyped) > 10:
                print(f'    ... and {len(untyped) - 10} more')

    print(f'[DOCS] Docs: {len(docs_root) + sum(len(files) for files in docs_subfolders.values())} files')
    print(f'[BUGS] Bugs: {len(bugs_active) + len(bugs_solved) + sum(len(files) for files in bugs_subfolders.values())} files')
    print(f'[TASKS] Tasks: {len(tasks_pending) + len(tasks_done) + sum(len(files) for files in tasks_subfolders.values()) + sum(len(files) for files in tasks_done_subfolders.values())} files')
    print(f'[REPORTS] Reports: {len(reports_active) + len(reports_done) + sum(len(files) for files in reports_subfolders.values()) + sum(len(files) for files in reports_done_subfolders.values())} files')

    return True

if __name__ == '__main__':
    try:
        scan_agents_directory()
        print(f'\n{SYMBOLS["success"]} {SYMBOLS["check"]} Index update completed successfully!')
    except Exception as e:
        print(f'\n{SYMBOLS["error"]} {SYMBOLS["cross"]} Error during execution: {e}')
        exit(1)
