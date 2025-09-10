#!/usr/bin/env python3
"""
Index Update Script for .readme directory

This script automatically updates the INDEX.md file by:
1. Scanning all markdown files in .readme directory
2. Adding back links to INDEX.md in all files (after title and at end)
3. Extracting titles from files
4. Organizing files by folder structure (docs -> bugs -> tasks)
5. Maintaining proper subfolder groupings
6. Updating the "Last Updated" timestamp

Usage: python3 update-index.py
"""

import os
import re
from datetime import datetime

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

def get_relative_back_link(file_path, readme_root):
    """Calculate relative path to INDEX.md from any file"""
    file_dir = os.path.dirname(file_path)
    rel_path = os.path.relpath(readme_root, file_dir)
    
    if rel_path == '.':
        return '/.readme/INDEX.md'
    else:
        return f'/{rel_path}/INDEX.md'.replace('\\', '/')

def add_back_links(file_path, readme_root):
    """Add back links to markdown files if missing"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        back_link = f'[← Back to INDEX]({get_relative_back_link(file_path, readme_root)})'
        
        # Skip if it already has a back link (any variant)
        if '← Back to' in content or '[Back to' in content:
            return False
        
        lines = content.split('\n')
        modified = False
        
        # Add after title if there's a title
        title_idx = -1
        for i, line in enumerate(lines):
            if line.startswith('# '):
                title_idx = i
                break
        
        if title_idx >= 0:
            # Insert after title
            lines.insert(title_idx + 1, '')
            lines.insert(title_idx + 2, back_link)
            lines.insert(title_idx + 3, '')
            modified = True
        else:
            # Insert at beginning
            lines.insert(0, back_link)
            lines.insert(1, '')
            modified = True
        
        # Add at end if not already there
        if not content.strip().endswith(back_link):
            if not lines[-1].strip():
                lines[-1] = back_link
            else:
                lines.append('')
                lines.append(back_link)
            modified = True
        
        if modified:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write('\n'.join(lines))
            return True
            
    except Exception as e:
        print(f'Error processing {file_path}: {e}')
    
    return False

def scan_readme_directory():
    """Scan .readme directory and build file structure"""
    readme_root = os.path.dirname(os.path.abspath(__file__))  # Current script directory
    
    # Organize by structure - DOCS FIRST, BUGS SECOND, TASKS THIRD
    docs_root = []
    docs_subfolders = {}  # e.g., 'features' -> [files], 'features/primitives' -> [files]
    
    bugs_active = []
    bugs_solved = []  # Will be populated from .solved folder
    bugs_subfolders = {}
    
    tasks_pending = []  # Tasks directly in tasks/ folder
    tasks_subfolders = {}  # Subfolders in tasks/ (except .done)
    tasks_done = []  # Tasks in tasks/.done/
    tasks_done_subfolders = {}  # Subfolders in tasks/.done/
    
    for root, _, files in os.walk(readme_root):
        for file in files:
            if file.endswith('.md') and file != 'INDEX.md':
                file_path = os.path.join(root, file)
                relative_path = os.path.relpath(file_path, readme_root)
                
                # Add back links to the file
                add_back_links(file_path, readme_root)
                
                # Extract title and create file info
                title = extract_title(file_path)
                file_info = {
                    'title': title,
                    'path': relative_path.replace('\\', '/'),
                    'filename': file
                }
                
                # Categorize files based on their path
                if relative_path.startswith('docs/'):
                    path_parts = relative_path.split('/')
                    if len(path_parts) == 2:  # docs/file.md
                        docs_root.append(file_info)
                    else:  # docs/subfolder/... files
                        subfolder = '/'.join(path_parts[1:-1])  # Get subfolder path
                        if subfolder not in docs_subfolders:
                            docs_subfolders[subfolder] = []
                        docs_subfolders[subfolder].append(file_info)
                
                elif relative_path.startswith('bugs/'):
                    path_parts = relative_path.split('/')
                    
                    # Check if file is in .solved folder
                    if relative_path.startswith('bugs/.solved/'):
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
                
                elif relative_path.startswith('tasks/'):
                    path_parts = relative_path.split('/')
                    
                    # Check if file is in .done folder
                    if relative_path.startswith('tasks/.done/'):
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
    
    # Sort all sections using smart sorting (numbered files first, then alphabetical)
    docs_root = sort_files_smart(docs_root)
    bugs_active = sort_files_smart(bugs_active)
    bugs_solved = sort_files_smart(bugs_solved)
    tasks_pending = sort_files_smart(tasks_pending)
    tasks_done = sort_files_smart(tasks_done)
    
    # Sort subfolders and their contents (each folder treated independently)
    for subfolder in docs_subfolders:
        docs_subfolders[subfolder] = sort_files_smart(docs_subfolders[subfolder])
    for subfolder in bugs_subfolders:
        bugs_subfolders[subfolder] = sort_files_smart(bugs_subfolders[subfolder])
    for subfolder in tasks_subfolders:
        tasks_subfolders[subfolder] = sort_files_smart(tasks_subfolders[subfolder])
    for subfolder in tasks_done_subfolders:
        tasks_done_subfolders[subfolder] = sort_files_smart(tasks_done_subfolders[subfolder])
    
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
    
    # Footer with timestamp
    index_content.append('---')
    index_content.append('')
    current_date = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    index_content.append(f'**Last Updated**: {current_date}')
    
    # Write INDEX.md
    index_path = os.path.join(readme_root, 'INDEX.md')
    with open(index_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(index_content))
    
    # Summary
    total_files = (len(docs_root) + sum(len(files) for files in docs_subfolders.values()) +
                   len(bugs_active) + len(bugs_solved) + sum(len(files) for files in bugs_subfolders.values()) +
                   len(tasks_pending) + sum(len(files) for files in tasks_subfolders.values()) +
                   len(tasks_done) + sum(len(files) for files in tasks_done_subfolders.values()))
    
    print(f'✅ Updated {index_path}')
    print(f'📄 Processed {total_files} markdown files')
    print(f'📖 Docs: {len(docs_root) + sum(len(files) for files in docs_subfolders.values())} files')
    print(f'🐛 Bugs: {len(bugs_active) + len(bugs_solved) + sum(len(files) for files in bugs_subfolders.values())} files')
    print(f'📋 Tasks: {len(tasks_pending) + len(tasks_done) + sum(len(files) for files in tasks_subfolders.values()) + sum(len(files) for files in tasks_done_subfolders.values())} files')
    
    return True

if __name__ == '__main__':
    try:
        scan_readme_directory()
        print('\n🎉 Index update completed successfully!')
    except Exception as e:
        print(f'❌ Error updating index: {e}')
        exit(1)