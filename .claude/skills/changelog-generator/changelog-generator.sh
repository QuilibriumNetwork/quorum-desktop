#!/bin/bash
# Enhanced Technical Changelog Generator for Quorum
# Part of the changelog-generator skill

# Default parameters
DAYS=${1:-7}
BRANCH=${2:-cross-platform}
CLAUDE_ENHANCE=${3:-false}
SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="${4:-$SKILL_DIR/changelogs}"
OUTPUT="$OUTPUT_DIR/quorum-changelog_$(date +%Y-%m-%d).md"
TEXT_OUTPUT="$OUTPUT_DIR/quorum-changelog_$(date +%Y-%m-%d).txt"

# Ensure output directory exists
mkdir -p "$OUTPUT_DIR"

# Get remote URL for GitHub links
REMOTE_URL=$(git remote get-url origin | sed 's/\.git$//' | sed 's/git@github\.com:/https:\/\/github.com\//')

echo "🔍 Generating technical changelog for last $DAYS days from $BRANCH branch..."

# Load filters from skill configuration
USER_FACING_FILTER="$SKILL_DIR/filters/user-facing-commits.txt"
EXCLUDE_FILTER="$SKILL_DIR/filters/exclude-patterns.txt"

# Create enhanced filters if they don't exist
if [ ! -f "$USER_FACING_FILTER" ]; then
    cat > "$USER_FACING_FILTER" << 'EOF'
✨ feat:
feat:
🐛 fix:
fix:
🎨 style:
style:
🚀 perf:
perf:
Add
Implement
Fix
Improve
Enhance
Update.*UI
Update.*interface
Update.*user
EOF
fi

if [ ! -f "$EXCLUDE_FILTER" ]; then
    cat > "$EXCLUDE_FILTER" << 'EOF'
playground
audit
component complexity
primitive
typescript
build
lint
✅ task:
task:
📝 doc:
doc:
🧹 chore:
chore:
⚙️ refactor:
refactor:
🧪 test:
test:
📦 build:
build:
EOF
fi

# Create markdown header using template
if [ -f "$SKILL_DIR/templates/technical-format.md" ]; then
    # Use template with substitutions
    sed "s/{{DATE_RANGE}}/$(date -d "$DAYS days ago" +%b\ %d) to $(date +%b\ %d)/g" \
        "$SKILL_DIR/templates/technical-format.md" > "$OUTPUT"
else
    # Fallback to original format
    cat > "$OUTPUT" << EOF
# Quorum Technical Changelog
## Development Updates - $(date -d "$DAYS days ago" +%b\ %d) to $(date +%b\ %d)

EOF
fi

# Create text header
cat > "$TEXT_OUTPUT" << EOF
📋 QUORUM TECHNICAL CHANGELOG
🚀 Development Updates - $(date -d "$DAYS days ago" +%b\ %d) to $(date +%b\ %d)

EOF

# Function to clean commit messages
clean_commit_message() {
    local message="$1"
    # Strip emoji prefix and type tag (handles both emoji and non-emoji formats)
    # Updated to include all emojis and i18n type
    echo "$message" | sed -E 's/^[[:space:]]*(✨|🐛|🎨|🚀|🧹|⚙️|🧪|📦|📝|✅|🈶|🌐|⚡|🩹|♿|📱)?[[:space:]]*(feat|fix|style|perf|chore|refactor|test|build|doc|task|i18n):[[:space:]]*//'
}

# Function to generate category content
generate_category() {
    local category_name="$1"
    local category_emoji="$2"
    local include_patterns="$3"
    local text_header="$4"

    local count=0
    local temp_md=""
    local temp_txt=""

    # Build grep pattern from include filters
    local grep_pattern=""
    while IFS= read -r pattern; do
        [ -n "$pattern" ] && [ "${pattern:0:1}" != "#" ] && {
            [ -n "$grep_pattern" ] && grep_pattern="${grep_pattern}|"
            grep_pattern="${grep_pattern}${pattern}"
        }
    done < <(echo "$include_patterns")

    # Build exclude pattern
    local exclude_pattern=""
    while IFS= read -r pattern; do
        [ -n "$pattern" ] && [ "${pattern:0:1}" != "#" ] && {
            [ -n "$exclude_pattern" ] && exclude_pattern="${exclude_pattern}|"
            exclude_pattern="${exclude_pattern}${pattern}"
        }
    done < "$EXCLUDE_FILTER"

    # Get commits for this category and store in temp variables
    while IFS='|' read -r hash message; do
        if [ -n "$hash" ] && [ -n "$message" ]; then
            clean_message=$(clean_commit_message "$message")
            temp_md+="- $clean_message ([${hash:0:7}]($REMOTE_URL/commit/$hash))"$'\n'
            temp_txt+="• $clean_message (${hash:0:7})"$'\n'
            ((count++))
        fi
    done < <(git log --since="$DAYS days ago" --no-merges --pretty=format:"%H|%s" $BRANCH \
        | grep -iE "\|(${grep_pattern})" \
        | grep -viE "(${exclude_pattern})")

    # Only write category header and content if there are commits
    if [ $count -gt 0 ]; then
        echo "## $category_emoji $category_name" >> "$OUTPUT"
        echo "" >> "$OUTPUT"
        echo -n "$temp_md" >> "$OUTPUT"
        echo "" >> "$OUTPUT"

        echo "" >> "$TEXT_OUTPUT"
        echo "$text_header" >> "$TEXT_OUTPUT"
        echo -n "$temp_txt" >> "$TEXT_OUTPUT"
    fi

    return $count
}

# Generate categories using industry standards
echo "📊 Processing commits by category..."

# New Features
generate_category "New Features" "🎉" "✨ feat:|🚀 feat:|feat:" "🎉 NEW FEATURES:"

# Enhancements
generate_category "Enhancements" "✨" "🎨 style:|style:|🚀 perf:|⚡ perf:|perf:" "✨ ENHANCEMENTS:"

# Bug Fixes
generate_category "Bug Fixes" "🐛" "🐛 fix:|🩹 fix:|fix:" "🐛 BUG FIXES:"

# Localization
generate_category "Localization" "🌐" "🌐 i18n:|i18n:" "🌐 LOCALIZATION:"

# Maintenance (for technical changelog)
generate_category "Maintenance" "🔧" "🧹 chore:|chore:|⚙️ refactor:|refactor:" "🔧 MAINTENANCE:"

# Compatibility
generate_category "Compatibility" "📱" "responsive|mobile|Mobile|platform|Platform|cross-platform|touch|Touch" "📱 COMPATIBILITY:"

# Count stats
TOTAL=$(git log --since="$DAYS days ago" --no-merges --oneline $BRANCH | wc -l)
INCLUDED=$(grep -c "^- " "$OUTPUT" 2>/dev/null || echo "0")
FILTERED=$((TOTAL - INCLUDED))

# Add footer
echo "" >> "$OUTPUT"
echo "---" >> "$OUTPUT"
echo "**$INCLUDED changes documented** (filtered out $FILTERED internal commits)" >> "$OUTPUT"
echo "*Generated $(date +%Y-%m-%d) by changelog-generator skill*" >> "$OUTPUT"

echo "" >> "$TEXT_OUTPUT"
echo "---" >> "$TEXT_OUTPUT"
echo "$INCLUDED changes documented (filtered out $FILTERED internal commits)" >> "$TEXT_OUTPUT"
echo "Generated $(date +%Y-%m-%d) by changelog-generator skill" >> "$TEXT_OUTPUT"

echo "✅ Technical changelog saved: $OUTPUT"
echo "✅ Text version saved: $TEXT_OUTPUT"
echo "📊 $INCLUDED documented changes out of $TOTAL total commits"

# Claude enhancement phase
if [ "$CLAUDE_ENHANCE" = "true" ] && command -v claude >/dev/null 2>&1; then
    echo ""
    echo "🤖 Claude enhancement requested..."
    echo "Note: Manual enhancement available - ask Claude to review and improve the generated changelog"
fi

# Show the result if requested
if [[ "${5:-}" == "--show" ]]; then
    echo ""
    echo "📋 Generated Technical Changelog:"
    echo "=================================="
    cat "$OUTPUT"
fi

echo ""
echo "💡 Pro tip: For user-friendly changelogs, use: ./changelog-user-friendly.sh $DAYS $BRANCH"