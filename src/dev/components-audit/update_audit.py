#!/usr/bin/env python3
"""
Enhanced script to update the unified components audit.json file.
Handles dependency tracking, complexity calculation, and smart updates.

Usage Examples:
  # Basic component update
  python3 update_audit_enhanced.py --component "Button" --primitives "done" --native "done"
  
  # Add dependencies and auto-calculate complexity
  python3 update_audit_enhanced.py --component "Modal" --add-deps "Button,Container,Icon" --primitives "done"
  
  # Auto-detect changes after working on a component
  python3 update_audit_enhanced.py --component "SearchInput" --auto-detect
  
  # Bulk update multiple components
  python3 update_audit_enhanced.py --bulk-update "Button,Icon,Text" --native "done"
  
  # Update with smart suggestions
  python3 update_audit_enhanced.py --component "Dialog" --native "ready" --suggest
  
  # Recalculate all dependency levels and complexity
  python3 update_audit_enhanced.py --recalculate-all
  
  # Validate JSON structure and fix inconsistencies
  python3 update_audit_enhanced.py --validate --fix
"""

import json
import argparse
import os
from datetime import datetime
from typing import Dict, List, Set, Optional, Tuple
import re

class AuditUpdater:
    def __init__(self):
        self.script_dir = os.path.dirname(os.path.abspath(__file__))
        self.audit_path = os.path.join(self.script_dir, 'audit.json')
        self.data = None
        self.dependency_graph = {}
        
    def load_audit(self) -> Dict:
        """Load the audit.json file"""
        with open(self.audit_path, 'r') as f:
            self.data = json.load(f)
        return self.data
    
    def save_audit(self):
        """Save the audit.json file with proper formatting"""
        # Create backup
        backup_path = self.audit_path.replace('.json', f'-backup-{datetime.now().strftime("%Y%m%d")}.json')
        if not os.path.exists(backup_path):
            with open(backup_path, 'w') as f:
                json.dump(self.data, f, indent=2)
        
        # Save main file
        with open(self.audit_path, 'w') as f:
            json.dump(self.data, f, indent=2)
        print(f"✅ Saved {self.audit_path}")
    
    def build_dependency_graph(self):
        """Build a dependency graph for calculating levels"""
        self.dependency_graph = {}
        components = self.data['components']
        
        for name, comp in components.items():
            deps = comp.get('dependencies', [])
            # Filter to only include dependencies that exist as components
            valid_deps = [dep for dep in deps if dep in components]
            self.dependency_graph[name] = valid_deps
    
    def calculate_dependency_level(self, component_name: str, visited: Set[str] = None) -> int:
        """Calculate dependency level using depth-first search"""
        if visited is None:
            visited = set()
        
        if component_name in visited:
            return 0  # Circular dependency, treat as level 0
        
        if component_name not in self.dependency_graph:
            return 0
        
        visited.add(component_name)
        deps = self.dependency_graph[component_name]
        
        if not deps:
            return 0  # No dependencies = level 0
        
        max_level = 0
        for dep in deps:
            dep_level = self.calculate_dependency_level(dep, visited.copy())
            max_level = max(max_level, dep_level + 1)
        
        return max_level
    
    def calculate_complexity_category(self, dependencies: List[str]) -> str:
        """Calculate complexity category based on dependency count"""
        dep_count = len(dependencies) if dependencies else 0
        
        if dep_count == 0:
            return 'basic'
        elif dep_count <= 3:
            return 'simple' 
        elif dep_count <= 6:
            return 'medium'
        else:
            return 'complex'
    
    def update_component_calculations(self, component_name: str):
        """Update calculated fields for a component"""
        comp = self.data['components'][component_name]
        deps = comp.get('dependencies', [])
        
        # Update dependency level
        comp['dependency_level'] = self.calculate_dependency_level(component_name)
        
        # Update complexity category
        comp['complexity_category'] = self.calculate_complexity_category(deps)
        
        # Update timestamp
        comp['updated'] = datetime.now().strftime('%Y-%m-%d')
    
    def recalculate_all_components(self):
        """Recalculate dependency levels and complexity for all components"""
        self.build_dependency_graph()
        
        print("🔄 Recalculating dependency levels and complexity...")
        for component_name in self.data['components']:
            self.update_component_calculations(component_name)
        
        print(f"✅ Updated calculations for {len(self.data['components'])} components")
    
    def update_statistics(self):
        """Recalculate all statistics including dependency hierarchy"""
        components = self.data['components']
        
        # Basic stats
        total = len(components)
        primitives_done = sum(1 for c in components.values() if c.get('primitives') == 'done')
        logic_extraction_done = sum(1 for c in components.values() 
                                  if c.get('logic_extraction') in ['done', 'keep'])
        native_ready = sum(1 for c in components.values() if c.get('native') == 'ready')
        native_done = sum(1 for c in components.values() if c.get('native') == 'done')
        
        # Category counts
        categories = {}
        for comp in components.values():
            cat = comp.get('category', 'unknown')
            categories[cat] = categories.get(cat, 0) + 1
        
        # Usage counts
        usage = {}
        for comp in components.values():
            use = comp.get('used', 'unknown')
            usage[use] = usage.get(use, 0) + 1
        
        # Dependency hierarchy counts
        complexity_counts = {
            'basic': 0, 'simple': 0, 'medium': 0, 'complex': 0
        }
        complexity_components = {
            'basic': [], 'simple': [], 'medium': [], 'complex': []
        }
        
        for name, comp in components.items():
            complexity = comp.get('complexity_category', 'basic')
            if complexity in complexity_counts:
                complexity_counts[complexity] += 1
                complexity_components[complexity].append(name)
        
        # Update stats
        self.data['stats'] = {
            'total': total,
            'primitives_done': primitives_done,
            'logic_extraction_done': logic_extraction_done,
            'native_ready': native_ready,
            'native_done': native_done,
            'by_category': categories,
            'by_usage': usage,
            'analysis_notes': self.data.get('stats', {}).get('analysis_notes', ''),
            'last_updated': datetime.now().strftime('%Y-%m-%d')
        }
        
        # Update dependency hierarchy
        self.data['dependency_hierarchy'] = {
            complexity: {
                'count': complexity_counts[complexity],
                'components': complexity_components[complexity]
            } for complexity in complexity_counts
        }
        
        print(f"📊 Updated stats: {total} total, {primitives_done} primitives done, {native_done} native done")
    
    def update_component(self, component_name: str, updates: Dict):
        """Update a specific component with the given updates"""
        if component_name not in self.data['components']:
            print(f"⚠️  Component {component_name} not found, creating new entry...")
            self.data['components'][component_name] = {
                "name": component_name.replace('.tsx', '').replace('.ts', ''),
                "path": f"src/components/{component_name}",
                "description": "Component description pending",
                "category": "platform_specific", 
                "used": "yes",
                "primitives": "todo",
                "logic_extraction": "todo",
                "hooks": [],
                "native": "todo",
                "notes": "Added via script",
                "dependencies": [],
                "dependency_level": 0,
                "complexity_category": "basic",
                "updated": datetime.now().strftime('%Y-%m-%d')
            }
        
        comp = self.data['components'][component_name]
        
        # Apply updates
        for key, value in updates.items():
            if key == 'hooks' and isinstance(value, str):
                comp[key] = [h.strip() for h in value.split(',') if h.strip()]
            elif key == 'add_deps':
                # Add dependencies (merge with existing)
                existing_deps = set(comp.get('dependencies', []))
                new_deps = [d.strip() for d in value.split(',') if d.strip()]
                comp['dependencies'] = sorted(list(existing_deps | set(new_deps)))
            elif key == 'remove_deps':
                # Remove dependencies
                existing_deps = set(comp.get('dependencies', []))
                remove_deps = [d.strip() for d in value.split(',') if d.strip()]
                comp['dependencies'] = sorted(list(existing_deps - set(remove_deps)))
            elif key == 'set_deps':
                # Replace all dependencies
                comp['dependencies'] = [d.strip() for d in value.split(',') if d.strip()]
            elif key != 'auto_detect':  # Skip special flags
                comp[key] = value
        
        # Recalculate dependency-based fields
        self.build_dependency_graph()
        self.update_component_calculations(component_name)
        
        print(f"✅ Updated {component_name}")
    
    def bulk_update(self, component_names: List[str], updates: Dict):
        """Update multiple components with the same changes"""
        print(f"🔄 Bulk updating {len(component_names)} components...")
        for name in component_names:
            self.update_component(name, updates)
    
    def auto_detect_changes(self, component_name: str):
        """Auto-detect what might need updating based on component status"""
        if component_name not in self.data['components']:
            print(f"❌ Component {component_name} not found")
            return
        
        comp = self.data['components'][component_name]
        suggestions = []
        
        # Check if primitives are done but native is still todo
        if comp.get('primitives') == 'done' and comp.get('native') == 'todo':
            deps = comp.get('dependencies', [])
            if not deps:  # No dependencies
                suggestions.append("Consider setting native='ready' (no dependencies)")
            else:
                # Check if dependencies are ready
                ready_deps = 0
                for dep in deps:
                    if dep in self.data['components']:
                        dep_native = self.data['components'][dep].get('native')
                        if dep_native in ['done', 'ready']:
                            ready_deps += 1
                
                if ready_deps == len(deps):
                    suggestions.append("Consider setting native='ready' (all dependencies ready)")
        
        # Check if logic extraction might be complete
        if comp.get('primitives') == 'done' and comp.get('logic_extraction') == 'todo':
            suggestions.append("Consider updating logic_extraction status")
        
        if suggestions:
            print(f"💡 Suggestions for {component_name}:")
            for suggestion in suggestions:
                print(f"   • {suggestion}")
        else:
            print(f"ℹ️  No obvious updates needed for {component_name}")
    
    def get_smart_suggestions(self, component_name: str):
        """Get smart suggestions based on component state and dependencies"""
        if component_name not in self.data['components']:
            return
        
        comp = self.data['components'][component_name]
        deps = comp.get('dependencies', [])
        
        print(f"🤖 Smart analysis for {component_name}:")
        print(f"   Current status: primitives={comp.get('primitives')}, native={comp.get('native')}")
        print(f"   Dependencies ({len(deps)}): {', '.join(deps) if deps else 'None'}")
        print(f"   Complexity: {comp.get('complexity_category')}")
        print(f"   Dependency Level: {comp.get('dependency_level')}")
        
        # Analyze dependency readiness
        if deps:
            ready_deps = []
            pending_deps = []
            
            for dep in deps:
                if dep in self.data['components']:
                    dep_status = self.data['components'][dep].get('native')
                    if dep_status in ['done', 'ready']:
                        ready_deps.append(dep)
                    else:
                        pending_deps.append(f"{dep}({dep_status})")
                else:
                    pending_deps.append(f"{dep}(not found)")
            
            print(f"   Dependencies ready: {len(ready_deps)}/{len(deps)}")
            if pending_deps:
                print(f"   Waiting for: {', '.join(pending_deps)}")
    
    def validate_and_fix(self, fix: bool = False):
        """Validate JSON structure and optionally fix issues"""
        issues = []
        fixes_applied = []
        
        components = self.data['components']
        
        # Check for missing required fields
        required_fields = ['name', 'path', 'description', 'category', 'used', 
                          'primitives', 'logic_extraction', 'native', 'notes', 'updated']
        
        for name, comp in components.items():
            for field in required_fields:
                if field not in comp:
                    issues.append(f"{name}: Missing field '{field}'")
                    if fix:
                        default_values = {
                            'name': name.replace('.tsx', '').replace('.ts', ''),
                            'path': f'src/components/{name}',
                            'description': 'Description needed',
                            'category': 'platform_specific',
                            'used': 'unknown',
                            'primitives': 'todo',
                            'logic_extraction': 'todo', 
                            'native': 'todo',
                            'notes': 'Needs review',
                            'updated': datetime.now().strftime('%Y-%m-%d')
                        }
                        comp[field] = default_values.get(field, '')
                        fixes_applied.append(f"Added missing {field} to {name}")
            
            # Ensure new fields exist
            if 'dependencies' not in comp:
                comp['dependencies'] = []
                if fix:
                    fixes_applied.append(f"Added dependencies field to {name}")
            
            if 'dependency_level' not in comp:
                comp['dependency_level'] = 0
                if fix:
                    fixes_applied.append(f"Added dependency_level to {name}")
            
            if 'complexity_category' not in comp:
                comp['complexity_category'] = 'basic'
                if fix:
                    fixes_applied.append(f"Added complexity_category to {name}")
        
        # Validate dependency references
        for name, comp in components.items():
            deps = comp.get('dependencies', [])
            for dep in deps:
                if dep not in components:
                    issues.append(f"{name}: References non-existent dependency '{dep}'")
        
        # Check stats consistency
        if 'dependency_hierarchy' not in self.data:
            issues.append("Missing dependency_hierarchy in root")
            if fix:
                self.data['dependency_hierarchy'] = {
                    'basic': {'count': 0, 'components': []},
                    'simple': {'count': 0, 'components': []}, 
                    'medium': {'count': 0, 'components': []},
                    'complex': {'count': 0, 'components': []}
                }
                fixes_applied.append("Added missing dependency_hierarchy")
        
        print(f"🔍 Validation complete: {len(issues)} issues found")
        if issues:
            print("Issues found:")
            for issue in issues:
                print(f"   ❌ {issue}")
        
        if fix and fixes_applied:
            print(f"🔧 Applied {len(fixes_applied)} fixes:")
            for fix_msg in fixes_applied:
                print(f"   ✅ {fix_msg}")
            
            # Recalculate everything after fixes
            self.recalculate_all_components()
        
        return len(issues) == 0

def main():
    parser = argparse.ArgumentParser(description='Enhanced audit.json updater')
    
    # Component selection
    parser.add_argument('--component', help='Single component to update')
    parser.add_argument('--bulk-update', help='Comma-separated list of components to update')
    
    # Status updates
    parser.add_argument('--primitives', choices=['todo', 'partial', 'done'], help='Primitives status')
    parser.add_argument('--logic_extraction', choices=['todo', 'in_progress', 'done', 'keep'], help='Logic extraction status')
    parser.add_argument('--native', choices=['todo', 'in_progress', 'ready', 'done', 'not_needed'], help='Native status')
    parser.add_argument('--category', choices=['shared', 'platform_specific', 'complex_refactor'], help='Component category')
    parser.add_argument('--used', choices=['yes', 'no', 'unknown', 'suspended'], help='Usage status')
    
    # Dependency management
    parser.add_argument('--add-deps', help='Add dependencies (comma-separated)')
    parser.add_argument('--remove-deps', help='Remove dependencies (comma-separated)')
    parser.add_argument('--set-deps', help='Set all dependencies (comma-separated, replaces existing)')
    
    # Content updates
    parser.add_argument('--hooks', help='Update hooks (comma-separated)')
    parser.add_argument('--notes', help='Update notes')
    parser.add_argument('--description', help='Update description')
    parser.add_argument('--path', help='Update path')
    
    # Smart features
    parser.add_argument('--auto-detect', action='store_true', help='Auto-detect suggested changes')
    parser.add_argument('--suggest', action='store_true', help='Show smart suggestions')
    
    # Maintenance operations
    parser.add_argument('--recalculate-all', action='store_true', help='Recalculate all dependency levels and complexity')
    parser.add_argument('--stats-only', action='store_true', help='Only update statistics')
    parser.add_argument('--validate', action='store_true', help='Validate JSON structure')
    parser.add_argument('--fix', action='store_true', help='Fix validation issues (use with --validate)')
    
    args = parser.parse_args()
    
    # Initialize updater
    updater = AuditUpdater()
    updater.load_audit()
    
    # Handle different operations
    if args.recalculate_all:
        updater.recalculate_all_components()
        updater.update_statistics()
        updater.save_audit()
        
    elif args.validate:
        is_valid = updater.validate_and_fix(fix=args.fix)
        if args.fix:
            updater.update_statistics()
            updater.save_audit()
        return 0 if is_valid else 1
        
    elif args.stats_only:
        updater.update_statistics()
        updater.save_audit()
        
    elif args.component or args.bulk_update:
        # Prepare updates
        updates = {}
        for field in ['primitives', 'logic_extraction', 'native', 'category', 'used', 
                     'hooks', 'notes', 'description', 'path', 'add_deps', 'remove_deps', 'set_deps']:
            value = getattr(args, field.replace('-', '_'))
            if value is not None:
                updates[field] = value
        
        if args.component:
            # Single component update
            if args.auto_detect:
                updater.auto_detect_changes(args.component)
            
            if args.suggest:
                updater.get_smart_suggestions(args.component)
            
            if updates:
                updater.update_component(args.component, updates)
        
        elif args.bulk_update:
            # Bulk update
            component_names = [name.strip() for name in args.bulk_update.split(',') if name.strip()]
            if updates:
                updater.bulk_update(component_names, updates)
        
        # Always update stats after component changes
        updater.update_statistics()
        updater.save_audit()
    
    else:
        print("❌ Must specify an operation (--component, --bulk-update, --recalculate-all, --stats-only, or --validate)")
        return 1
    
    return 0

if __name__ == '__main__':
    exit(main())