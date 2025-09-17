#!/bin/bash
# Simple Changelog Generator for Quorum

DAYS=${1:-7}
BRANCH=${2:-cross-platform}
OUTPUT="src/dev/changelog/quorum-changelog_$(date +%Y-%m-%d).md"
TEXT_OUTPUT="src/dev/changelog/quorum-changelog_$(date +%Y-%m-%d).txt"

# Get remote URL for GitHub links
REMOTE_URL=$(git remote get-url origin | sed 's/\.git$//' | sed 's/git@github\.com:/https:\/\/github.com\//')

echo "🔍 Generating changelog for last $DAYS days from $BRANCH branch..."

# Create markdown header
cat > "$OUTPUT" << EOF
# Quorum Changelog
## What's New - $(date -d "$DAYS days ago" +%b\ %d) to $(date +%b\ %d)

EOF

# Create text header for social media
cat > "$TEXT_OUTPUT" << EOF
📋 QUORUM CHANGELOG
🚀 Updates - $(date -d "$DAYS days ago" +%b\ %d) to $(date +%b\ %d)

EOF

echo "## 🚀 New Features" >> "$OUTPUT"
echo "" >> "$OUTPUT"
echo "✨ NEW FEATURES:" >> "$TEXT_OUTPUT"

# Get major new features - user-facing functionality only
git log --since="$DAYS days ago" --no-merges --pretty=format:"%H|%s" $BRANCH \
  | grep -iE "\|(Add|Implement).*(search|filtering|compression|overlay|modal system|kick user|encryption|users list)" \
  | grep -viE "(playground|docs|audit|preview|component complexity|primitive)" \
  | while IFS='|' read -r hash message; do
    echo "- $message ([${hash:0:7}]($REMOTE_URL/commit/$hash))" >> "$OUTPUT"
    echo "• $message (${hash:0:7})" >> "$TEXT_OUTPUT"
  done

echo "" >> "$OUTPUT"
echo "## 🐛 Bug Fixes" >> "$OUTPUT"
echo "" >> "$OUTPUT"
echo "" >> "$TEXT_OUTPUT"
echo "🔧 BUG FIXES:" >> "$TEXT_OUTPUT"

# Get important bug fixes - user-facing issues only
git log --since="$DAYS days ago" --no-merges --pretty=format:"%H|%s" $BRANCH \
  | grep -iE "\|Fix.*(crash|clipping|stacking|alignment|dropdown|modal|profile|display)" \
  | grep -viE "(typescript|component|primitive|docs)" \
  | while IFS='|' read -r hash message; do
    echo "- $message ([${hash:0:7}]($REMOTE_URL/commit/$hash))" >> "$OUTPUT"
    echo "• $message (${hash:0:7})" >> "$TEXT_OUTPUT"
  done

echo "" >> "$OUTPUT"
echo "## 🎨 UI/UX Improvements" >> "$OUTPUT"
echo "" >> "$OUTPUT"
echo "" >> "$TEXT_OUTPUT"
echo "🎨 UX IMPROVEMENTS:" >> "$TEXT_OUTPUT"

# Get significant UX improvements - user-visible changes only
git log --since="$DAYS days ago" --no-merges --pretty=format:"%H|%s" $BRANCH \
  | grep -iE "\|(Improve|Enhance).*(event message|avatar|layout|settings|UX|icons|styling)" \
  | grep -viE "(playground|primitive|component|docs)" \
  | while IFS='|' read -r hash message; do
    echo "- $message ([${hash:0:7}]($REMOTE_URL/commit/$hash))" >> "$OUTPUT"
    echo "• $message (${hash:0:7})" >> "$TEXT_OUTPUT"
  done

# Skip technical improvements section - not relevant for user changelog

# Count stats
TOTAL=$(git log --since="$DAYS days ago" --no-merges --oneline $BRANCH | wc -l)
INCLUDED=$(grep -c "^- " "$OUTPUT" 2>/dev/null || echo "0")
FILTERED=$((TOTAL - INCLUDED))

echo "" >> "$OUTPUT"
echo "---" >> "$OUTPUT"
echo "**$INCLUDED major changes** (filtered out $FILTERED minor commits)" >> "$OUTPUT"
echo "*Generated $(date +%Y-%m-%d)*" >> "$OUTPUT"

echo "" >> "$TEXT_OUTPUT"
echo "---" >> "$TEXT_OUTPUT"
echo "$INCLUDED major changes (filtered out $FILTERED minor commits)" >> "$TEXT_OUTPUT"
echo "Generated $(date +%Y-%m-%d)" >> "$TEXT_OUTPUT"

echo "✅ Markdown changelog saved: $OUTPUT"
echo "✅ Text changelog saved: $TEXT_OUTPUT"
echo "📊 $INCLUDED relevant changes out of $TOTAL total commits"

# Show the result
if [[ "${3:-}" == "--show" ]]; then
  echo ""
  echo "📋 Generated Changelog:"
  echo "======================"
  cat "$OUTPUT"
fi