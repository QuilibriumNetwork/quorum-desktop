#!/usr/bin/env python3
"""
Task Sync Script for .agents task/bug files

Deterministic task file operations that Claude calls after implementation steps.
Reduces probabilistic errors by handling markdown edits mechanically.

Usage:
    python task-sync.py <task-file> <command> [args...]

Commands:
    check <text>        Check off a checkbox whose line contains <text>
    uncheck <text>      Uncheck a checkbox whose line contains <text>
    status <new-status> Update frontmatter status and updated date
    note <message>      Append timestamped note to ## Updates section
    remaining           Show all unchecked items with section context
    validate-paths      Check if backtick file references exist
    summary             Show status + progress + remaining items

Cross-platform compatible: Works on Windows, macOS, and Linux.
"""

import os
import re
import sys
from datetime import datetime

# Configure stdout for UTF-8 on Windows
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass


def read_file(path):
    """Read file content, return as string."""
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()


def write_file(path, content):
    """Write content to file."""
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(content)


def find_task_file(arg):
    """Resolve the task file path. Accepts relative or absolute path."""
    if os.path.isabs(arg):
        return arg
    # Relative to cwd
    return os.path.abspath(arg)


def parse_frontmatter(content):
    """Extract frontmatter boundaries and fields."""
    match = re.match(r'^---\s*\n(.*?\n)---\s*\n', content, re.DOTALL)
    if not match:
        return None, None, None
    fm_text = match.group(1)
    fm_end = match.end()
    fields = {}
    for line in fm_text.strip().split('\n'):
        m = re.match(r'^(\w[\w_-]*)\s*:\s*(.*)$', line)
        if m:
            fields[m.group(1)] = m.group(2).strip()
    return fm_text, fm_end, fields


def update_frontmatter_field(content, field, value):
    """Update a single frontmatter field value. Line-by-line for reliability."""
    lines = content.split('\n')
    in_fm = False
    fm_count = 0
    for i, line in enumerate(lines):
        if line.strip() == '---':
            fm_count += 1
            if fm_count == 1:
                in_fm = True
                continue
            elif fm_count == 2:
                break
        if in_fm:
            m = re.match(r'^(' + re.escape(field) + r'\s*:\s*)(.*)', line)
            if m:
                lines[i] = m.group(1) + value
                return '\n'.join(lines)

    return content  # Field not found, return unchanged


def cmd_check(content, search_text):
    """Check off a checkbox line containing search_text. Returns (new_content, message)."""
    lines = content.split('\n')
    matches = []
    for i, line in enumerate(lines):
        if re.match(r'^\s*-\s*\[ \]', line) and search_text.lower() in line.lower():
            matches.append(i)

    if len(matches) == 0:
        # Check if already checked
        for i, line in enumerate(lines):
            if re.match(r'^\s*-\s*\[x\]', line, re.IGNORECASE) and search_text.lower() in line.lower():
                return content, f"Already checked: {lines[i].strip()}"
        return content, f"ERROR: No unchecked checkbox found containing: {search_text}"

    if len(matches) > 1:
        found = [f"  Line {m+1}: {lines[m].strip()}" for m in matches]
        return content, f"ERROR: Multiple matches ({len(matches)}). Be more specific:\n" + '\n'.join(found)

    idx = matches[0]
    lines[idx] = re.sub(r'^(\s*-\s*)\[ \]', r'\1[x]', lines[idx])
    return '\n'.join(lines), f"Checked: {lines[idx].strip()}"


def cmd_uncheck(content, search_text):
    """Uncheck a checkbox line containing search_text."""
    lines = content.split('\n')
    matches = []
    for i, line in enumerate(lines):
        if re.match(r'^\s*-\s*\[x\]', line, re.IGNORECASE) and search_text.lower() in line.lower():
            matches.append(i)

    if len(matches) == 0:
        return content, f"ERROR: No checked checkbox found containing: {search_text}"

    if len(matches) > 1:
        found = [f"  Line {m+1}: {lines[m].strip()}" for m in matches]
        return content, f"ERROR: Multiple matches ({len(matches)}). Be more specific:\n" + '\n'.join(found)

    idx = matches[0]
    lines[idx] = re.sub(r'^(\s*-\s*)\[x\]', r'\1[ ]', lines[idx], flags=re.IGNORECASE)
    return '\n'.join(lines), f"Unchecked: {lines[idx].strip()}"


def cmd_status(content, new_status):
    """Update frontmatter status and updated date."""
    valid = ['open', 'in-progress', 'on-hold', 'done', 'archived']
    if new_status not in valid:
        return content, f"ERROR: Invalid status '{new_status}'. Valid: {', '.join(valid)}"

    today = datetime.now().strftime('%Y-%m-%d')
    content = update_frontmatter_field(content, 'status', new_status)
    content = update_frontmatter_field(content, 'updated', today)
    return content, f"Status -> {new_status}, updated -> {today}"


def cmd_note(content, message):
    """Append a timestamped note to ## Updates section."""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M')
    note_line = f"- **{timestamp}**: {message}"

    # Find ## Updates section
    updates_pattern = re.compile(r'^## Updates\s*$', re.MULTILINE)
    match = updates_pattern.search(content)

    if match:
        # Find the end of the Updates section (next ## heading or end of file)
        next_heading = re.search(r'^## ', content[match.end():], re.MULTILINE)
        if next_heading:
            insert_pos = match.end() + next_heading.start()
            # Insert before the next heading, with a blank line
            content = content[:insert_pos].rstrip('\n') + '\n' + note_line + '\n\n' + content[insert_pos:]
        else:
            # Updates is the last section, append at end
            content = content.rstrip('\n') + '\n' + note_line + '\n'
    else:
        # No ## Updates section exists — create it before the last --- footer or at end
        # Look for a trailing --- (common in templates)
        footer_match = re.search(r'\n---\s*\n\s*_', content)
        if footer_match:
            insert_pos = footer_match.start()
            content = content[:insert_pos] + '\n\n## Updates\n' + note_line + '\n' + content[insert_pos:]
        else:
            content = content.rstrip('\n') + '\n\n## Updates\n' + note_line + '\n'

    return content, f"Note added: {note_line}"


def cmd_remaining(content, task_file):
    """Show all unchecked items with their section context."""
    lines = content.split('\n')
    current_section = "(top)"
    current_phase = ""
    results = []

    for line in lines:
        heading_match = re.match(r'^(#{1,3})\s+(.+)', line)
        if heading_match:
            level = len(heading_match.group(1))
            heading = heading_match.group(2).strip()
            if level == 2:
                current_section = heading
                current_phase = ""
            elif level == 3:
                current_phase = heading

        if re.match(r'^\s*-\s*\[ \]', line):
            location = current_section
            if current_phase:
                location += f" > {current_phase}"
            results.append(f"  [{location}] {line.strip()}")

    if not results:
        return f"All items checked in {os.path.basename(task_file)}"

    # Count total checkboxes
    total = len(re.findall(r'^\s*-\s*\[[x ]\]', content, re.MULTILINE | re.IGNORECASE))
    checked = total - len(results)

    header = f"Progress: {checked}/{total} checked ({len(results)} remaining)"
    return header + '\n' + '\n'.join(results)


def cmd_validate_paths(content, task_file):
    """Check if backtick file references exist relative to cwd."""
    # Find patterns like `src/path/to/file.ts:123` or `src/path/to/file.ts`
    pattern = re.compile(r'`([a-zA-Z0-9_./-]+\.[a-zA-Z0-9]+)(?::(\d+))?`')
    matches = pattern.findall(content)

    if not matches:
        return "No file references found in backticks."

    seen = set()
    missing = []
    found = []
    for filepath, _lineno in matches:
        if filepath in seen:
            continue
        seen.add(filepath)
        # Skip obvious non-file patterns
        if filepath.startswith('http') or filepath.startswith('npm:'):
            continue
        if os.path.exists(filepath):
            found.append(filepath)
        else:
            missing.append(filepath)

    lines = [f"Checked {len(seen)} unique file references:"]
    if found:
        lines.append(f"  Found: {len(found)}")
    if missing:
        lines.append(f"  MISSING: {len(missing)}")
        for m in missing:
            lines.append(f"    - {m}")
    else:
        lines.append("  All references valid.")

    return '\n'.join(lines)


def cmd_summary(content, task_file):
    """Show status + progress + remaining items."""
    _, _, fields = parse_frontmatter(content)
    parts = []

    if fields:
        title = fields.get('title', '').strip('"').strip("'")
        status = fields.get('status', '?')
        complexity = fields.get('complexity', '')
        parts.append(f"Task: {title}")
        parts.append(f"Status: {status}" + (f" | Complexity: {complexity}" if complexity else ""))
        parts.append(f"File: {task_file}")
    else:
        parts.append(f"File: {task_file}")

    parts.append("")

    # Checkbox progress
    total = len(re.findall(r'^\s*-\s*\[[x ]\]', content, re.MULTILINE | re.IGNORECASE))
    checked = len(re.findall(r'^\s*-\s*\[x\]', content, re.MULTILINE | re.IGNORECASE))
    unchecked = total - checked

    if total > 0:
        pct = int((checked / total) * 100)
        bar_len = 20
        filled = int(bar_len * checked / total)
        bar = '#' * filled + '-' * (bar_len - filled)
        parts.append(f"Progress: [{bar}] {pct}% ({checked}/{total})")
    else:
        parts.append("Progress: No checkboxes found")

    if unchecked > 0:
        parts.append("")
        parts.append(cmd_remaining(content, task_file))

    return '\n'.join(parts)


def main():
    if len(sys.argv) < 3:
        print("Usage: python task-sync.py <task-file> <command> [args...]")
        print()
        print("Commands:")
        print("  check <text>        Check off a checkbox containing <text>")
        print("  uncheck <text>      Uncheck a checkbox containing <text>")
        print("  status <new-status> Update frontmatter status and date")
        print("  note <message>      Add timestamped note to Updates section")
        print("  remaining           Show unchecked items with context")
        print("  validate-paths      Check if file references exist")
        print("  summary             Full status overview")
        sys.exit(1)

    task_file = find_task_file(sys.argv[1])
    command = sys.argv[2]

    if not os.path.exists(task_file):
        print(f"ERROR: File not found: {task_file}")
        sys.exit(1)

    content = read_file(task_file)

    # Read-only commands
    if command == 'remaining':
        print(cmd_remaining(content, task_file))
        return

    if command == 'validate-paths':
        print(cmd_validate_paths(content, task_file))
        return

    if command == 'summary':
        print(cmd_summary(content, task_file))
        return

    # Write commands require an argument
    if len(sys.argv) < 4:
        print(f"ERROR: '{command}' requires an argument.")
        sys.exit(1)

    arg = ' '.join(sys.argv[3:])

    if command == 'check':
        new_content, msg = cmd_check(content, arg)
    elif command == 'uncheck':
        new_content, msg = cmd_uncheck(content, arg)
    elif command == 'status':
        new_content, msg = cmd_status(content, arg)
    elif command == 'note':
        new_content, msg = cmd_note(content, arg)
    else:
        print(f"ERROR: Unknown command '{command}'")
        print("Valid commands: check, uncheck, status, note, remaining, validate-paths, summary")
        sys.exit(1)

    if new_content != content:
        write_file(task_file, new_content)

    print(msg)


if __name__ == '__main__':
    main()
