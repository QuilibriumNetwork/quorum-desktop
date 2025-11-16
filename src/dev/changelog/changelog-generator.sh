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
# Matches: ✨ feat:, feat:, or traditional "Add/Implement" patterns
git log --since="$DAYS days ago" --no-merges --pretty=format:"%H|%s" $BRANCH \
  | grep -iE "\|(✨ feat:|feat:|Add|Implement)" \
  | grep -viE "(playground|audit|component complexity|primitive|✅ task:|📝 doc:|🧹 chore:|task:|doc:|chore:)" \
  | while IFS='|' read -r hash message; do
    # Strip emoji prefix and type tag (handles both "✨ feat: " and "feat: " formats)
    clean_message=$(echo "$message" | sed -E 's/^[[:space:]]*(✨|🐛|🎨|🚀|🧹|⚙️|🧪|📦|📝|✅|🈶)?[[:space:]]*(feat|fix|style|perf|chore|refactor|test|build|doc|task|i18n):[[:space:]]*//')
    echo "- $clean_message ([${hash:0:7}]($REMOTE_URL/commit/$hash))" >> "$OUTPUT"
    echo "• $clean_message (${hash:0:7})" >> "$TEXT_OUTPUT"
  done

echo "" >> "$OUTPUT"
echo "## 🔧 Bug Fixes" >> "$OUTPUT"
echo "" >> "$OUTPUT"
echo "" >> "$TEXT_OUTPUT"
echo "🔧 BUG FIXES:" >> "$TEXT_OUTPUT"

# Get important bug fixes - user-facing issues only
# Matches: 🐛 fix:, fix:, or traditional "Fix" patterns
git log --since="$DAYS days ago" --no-merges --pretty=format:"%H|%s" $BRANCH \
  | grep -iE "\|(🐛 fix:|fix:|Fix)" \
  | grep -viE "(typescript|component|primitive|✅ task:|📝 doc:|🧹 chore:|task:|doc:|chore:)" \
  | while IFS='|' read -r hash message; do
    # Strip emoji prefix and type tag (handles both "🐛 fix: " and "fix: " formats)
    clean_message=$(echo "$message" | sed -E 's/^[[:space:]]*(✨|🐛|🎨|🚀|🧹|⚙️|🧪|📦|📝|✅|🈶)?[[:space:]]*(feat|fix|style|perf|chore|refactor|test|build|doc|task|i18n):[[:space:]]*//')
    echo "- $clean_message ([${hash:0:7}]($REMOTE_URL/commit/$hash))" >> "$OUTPUT"
    echo "• $clean_message (${hash:0:7})" >> "$TEXT_OUTPUT"
  done

echo "" >> "$OUTPUT"
echo "## 🎨 UI/UX Improvements" >> "$OUTPUT"
echo "" >> "$OUTPUT"
echo "" >> "$TEXT_OUTPUT"
echo "🎨 UX IMPROVEMENTS:" >> "$TEXT_OUTPUT"

# Get significant UX improvements - user-visible changes only
# Matches: 🎨 style:, style:, 🚀 perf:, perf:, or traditional "Improve/Enhance" patterns
git log --since="$DAYS days ago" --no-merges --pretty=format:"%H|%s" $BRANCH \
  | grep -iE "\|(🎨 style:|style:|🚀 perf:|perf:|Improve|Enhance)" \
  | grep -viE "(playground|primitive|component|✅ task:|📝 doc:|🧹 chore:|task:|doc:|chore:)" \
  | while IFS='|' read -r hash message; do
    # Strip emoji prefix and type tag (handles both emoji and non-emoji formats)
    clean_message=$(echo "$message" | sed -E 's/^[[:space:]]*(✨|🐛|🎨|🚀|🧹|⚙️|🧪|📦|📝|✅|🈶)?[[:space:]]*(feat|fix|style|perf|chore|refactor|test|build|doc|task|i18n):[[:space:]]*//')
    echo "- $clean_message ([${hash:0:7}]($REMOTE_URL/commit/$hash))" >> "$OUTPUT"
    echo "• $clean_message (${hash:0:7})" >> "$TEXT_OUTPUT"
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