#!/usr/bin/env python3
"""
Reusable script to update the components audit.json file.

Usage:
  python3 update_audit.py --component "ComponentName.tsx" --logic_extraction "done" --hooks "useHook1,useHook2" --notes "Updated notes"
  python3 update_audit.py --component "ComponentName.tsx" --primitives "done" --native "ready"
  python3 update_audit.py --stats-only  # Just update statistics
"""

import json
import argparse
from datetime import datetime
import os

def load_audit():
    """Load the audit.json file"""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    audit_path = os.path.join(script_dir, 'audit.json')
    
    with open(audit_path, 'r') as f:
        return json.load(f), audit_path

def save_audit(data, audit_path):
    """Save the audit.json file"""
    with open(audit_path, 'w') as f:
        json.dump(data, f, indent=2)

def update_statistics(data):
    """Recalculate all statistics from the components data"""
    components = data['components']
    
    # Count totals
    total = len(components)
    primitives_done = sum(1 for c in components.values() if c.get('primitives') == 'done')
    # Count logic work as complete if 'done' or 'keep'
    logic_extraction_done = sum(1 for c in components.values() 
                              if c.get('logic_extraction') in ['done', 'keep'])
    native_ready = sum(1 for c in components.values() if c.get('native') == 'ready')
    native_done = sum(1 for c in components.values() if c.get('native') == 'done')
    
    # Count by category
    categories = {}
    for comp in components.values():
        cat = comp.get('category', 'unknown')
        categories[cat] = categories.get(cat, 0) + 1
    
    # Count by usage
    usage = {}
    for comp in components.values():
        use = comp.get('used', 'unknown')
        usage[use] = usage.get(use, 0) + 1
    
    
    # Update stats
    data['stats'] = {
        'total': total,
        'primitives_done': primitives_done,
        'logic_extraction_done': logic_extraction_done,
        'native_ready': native_ready,
        'native_done': native_done,
        'by_category': categories,
        'by_usage': usage,
        'analysis_notes': data['stats'].get('analysis_notes', ''),
        'last_updated': datetime.now().strftime('%Y-%m-%d')
    }

def update_component(data, component_name, updates):
    """Update a specific component with the given updates"""
    if component_name not in data['components']:
        print(f"Warning: Component {component_name} not found in audit.json")
        # Create new component with default values
        data['components'][component_name] = {
            "name": component_name.replace('.tsx', ''),
            "path": f"src/components/message/{component_name}",  # Default path, can be updated
            "description": "Component description pending",
            "category": "platform_specific",
            "used": "yes",
            "primitives": "todo",
            "logic_extraction": "todo", 
            "hooks": [],
            "native": "todo",
            "notes": "New component added to audit",
            "updated": datetime.now().strftime('%Y-%m-%d')
        }
        print(f"Created new component entry for {component_name}")
    
    comp = data['components'][component_name]
    
    # Apply updates
    for key, value in updates.items():
        if key == 'hooks' and isinstance(value, str):
            # Convert comma-separated string to list
            comp[key] = [h.strip() for h in value.split(',') if h.strip()]
        elif key == 'updated':
            comp[key] = datetime.now().strftime('%Y-%m-%d')
        else:
            comp[key] = value
    
    # Always update the timestamp
    comp['updated'] = datetime.now().strftime('%Y-%m-%d')

def move_ready_components(data):
    """Move components from 'Native > Ready' to appropriate categories based on their main category"""
    moved_components = []
    
    for comp_name, comp_data in data['components'].items():
        if comp_data.get('native') == 'ready':
            category = comp_data.get('category')
            
            if category == 'shared':
                # Move to "Native > Done"
                comp_data['native'] = 'done'
                comp_data['updated'] = datetime.now().strftime('%Y-%m-%d')
                moved_components.append(f"{comp_name}: shared -> done")
            elif category == 'platform_specific':
                # Move to "Native > Todo"
                comp_data['native'] = 'todo'
                comp_data['updated'] = datetime.now().strftime('%Y-%m-%d')
                moved_components.append(f"{comp_name}: platform_specific -> todo")
    
    return moved_components

def main():
    parser = argparse.ArgumentParser(description='Update components audit.json file')
    parser.add_argument('--component', help='Component name to update (e.g., "GroupEditor.tsx")')
    parser.add_argument('--primitives', choices=['todo', 'partial', 'done'], help='Primitives status')
    parser.add_argument('--logic_extraction', choices=['todo', 'in_progress', 'done'], help='Logic extraction status')
    parser.add_argument('--hooks', help='Comma-separated list of hooks (e.g., "useHook1,useHook2")')
    parser.add_argument('--native', choices=['todo', 'in_progress', 'ready', 'done'], help='Native readiness status')
    parser.add_argument('--category', choices=['shared', 'platform_specific', 'complex_refactor'], help='Component category')
    parser.add_argument('--notes', help='Updated notes for the component')
    parser.add_argument('--analysis_notes', help='Update the global analysis notes')
    parser.add_argument('--stats-only', action='store_true', help='Only recalculate statistics')
    parser.add_argument('--move-ready', action='store_true', help='Move components from Native>Ready to appropriate categories')
    
    args = parser.parse_args()
    
    # Load audit data
    data, audit_path = load_audit()
    
    if args.stats_only:
        # Just update statistics
        update_statistics(data)
        print("Updated statistics only")
    elif args.move_ready:
        # Move components from Native>Ready to appropriate categories
        moved_components = move_ready_components(data)
        if moved_components:
            print("Moved the following components:")
            for move in moved_components:
                print(f"  - {move}")
        else:
            print("No components found with 'ready' status to move")
    elif args.component:
        # Update specific component
        updates = {}
        
        if args.primitives:
            updates['primitives'] = args.primitives
        if args.logic_extraction:
            updates['logic_extraction'] = args.logic_extraction
        if args.hooks:
            updates['hooks'] = args.hooks
        if args.native:
            updates['native'] = args.native
        if args.category:
            updates['category'] = args.category
        if args.notes:
            updates['notes'] = args.notes
        
        if updates:
            update_component(data, args.component, updates)
            print(f"Updated component {args.component} with: {updates}")
        else:
            print("No updates specified for component")
            return
    else:
        print("Must specify either --component, --stats-only, or --move-ready")
        return
    
    # Update global analysis notes if provided
    if args.analysis_notes:
        data['stats']['analysis_notes'] = args.analysis_notes
    
    # Always recalculate statistics after any update
    update_statistics(data)
    
    # Save the file
    save_audit(data, audit_path)
    print(f"Successfully updated {audit_path}")

if __name__ == '__main__':
    main()