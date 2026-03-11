#!/usr/bin/env python3
"""
Documentation Index Update Script for .agents directory

This script performs documentation index synchronization by:
1. Scanning all markdown files in .agents directory
2. Extracting titles from files
3. Organizing files by folder structure (docs -> bugs -> tasks -> reports)
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


def find_agents_directory():
    """Find the .agents directory relative to the script or current working directory"""
    # First, try relative to script location (for when script is in .claude/skills/docs-manager/)
    script_dir = os.path.dirname(os.path.abspath(__file__))

    # Try going up 3 levels from skill directory to project root
    agents_from_skill = os.path.join(script_dir, '..', '..', '..', '.agents')
    agents_from_skill = os.path.abspath(agents_from_skill)

    if os.path.exists(agents_from_skill):
        return agents_from_skill

    # Try current working directory
    agents_from_cwd = os.path.join(os.getcwd(), '.agents')
    if os.path.exists(agents_from_cwd):
        return agents_from_cwd

    # Try going up from current working directory
    parent_dir = os.path.dirname(os.getcwd())
    agents_from_parent = os.path.join(parent_dir, '.agents')
    if os.path.exists(agents_from_parent):
        return agents_from_parent

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
                    'filename': file
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
    total_files = (len(docs_root) + sum(len(files) for files in docs_subfolders.values()) +
                   len(bugs_active) + len(bugs_solved) + sum(len(files) for files in bugs_subfolders.values()) +
                   len(tasks_pending) + sum(len(files) for files in tasks_subfolders.values()) +
                   len(tasks_done) + sum(len(files) for files in tasks_done_subfolders.values()) +
                   len(reports_active) + sum(len(files) for files in reports_subfolders.values()) +
                   len(reports_done) + sum(len(files) for files in reports_done_subfolders.values()))

    print(f'{SYMBOLS["check"]} Updated {index_path}')
    print(f'[FILES] Processed {total_files} markdown files')
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
