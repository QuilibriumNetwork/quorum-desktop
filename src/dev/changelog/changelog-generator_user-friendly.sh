#!/bin/bash
# AI-Powered User-Friendly Changelog Generator for Quorum
# Uses Claude Code to analyze commits and generate engaging user-focused changelogs

DAYS=${1:-14}
BRANCH=${2:-cross-platform}
OUTPUT="src/dev/changelog/quorum-changelog-user-friendly_$(date +%Y-%m-%d_%H-%M).md"
TEXT_OUTPUT="src/dev/changelog/quorum-changelog-user-friendly_$(date +%Y-%m-%d_%H-%M).txt"
COMMITS_FILE="src/dev/changelog/commits-analysis_$(date +%Y-%m-%d_%H-%M).txt"

echo "🔍 Analyzing commits from last $DAYS days on $BRANCH branch..."

# Step 1: Crawl all commits and filter important ones
echo "📝 Step 1: Collecting commits..."
git log --since="$DAYS days ago" --no-merges --pretty=format:"%H|%s|%b" $BRANCH > temp_all_commits.txt

# Filter for user-facing changes (exclude technical/dev stuff)
# Now includes emoji-prefixed commits: ✨ feat:, 🐛 fix:, 🎨 style:, 🚀 perf:
echo "🔍 Step 2: Filtering important commits..."
cat temp_all_commits.txt | grep -iE "\|(✨ feat:|🐛 fix:|🎨 style:|🚀 perf:|Add|Implement|Fix|Improve|Enhance|Update)" | grep -viE "(playground|audit|component complexity|primitive|typescript|build|lint|✅ task:|📝 doc:|🧹 chore:|⚙️ refactor:|🧪 test:|📦 build:)" > important_commits.txt

# Create analysis file for Claude
echo "🤖 Step 3: Preparing analysis for Claude Code..."
cat > "$COMMITS_FILE" << EOF
COMMIT ANALYSIS FOR USER-FRIENDLY CHANGELOG
==========================================

Time Period: Last $DAYS days from $BRANCH branch
Total Commits: $(wc -l < temp_all_commits.txt)
Important Commits: $(wc -l < important_commits.txt)

IMPORTANT COMMITS TO ANALYZE:
=============================

EOF

# Add important commits to analysis file
cat important_commits.txt | while IFS='|' read -r hash message body; do
    echo "Commit: ${hash:0:7}" >> "$COMMITS_FILE"
    echo "Message: $message" >> "$COMMITS_FILE"
    if [ -n "$body" ]; then
        echo "Details: $body" >> "$COMMITS_FILE"
    fi
    echo "---" >> "$COMMITS_FILE"
done

# Add Claude instructions
cat >> "$COMMITS_FILE" << 'EOF'

CLAUDE CODE INSTRUCTIONS:
=========================

Please analyze these commits and create a user-friendly changelog with these requirements:

1. **Target Audience**: End users and beta testers, not developers
2. **Format**: Create both markdown and text versions
3. **Structure**: Use this format:

# Updates for Quorum Development

This list is for the web app, these changes are not yet live but you can test them on https://test.quorummessenger.com/
For Test Space access see: https://t.me/c/1967251104/146703/187208

📌 [Category Name]
   - [User-friendly feature description]
   - [Focus on what users can DO, not technical details]

4. **Categories to use** (only include if relevant commits exist):
   - 📌 Pinned Messages & Content Management
   - 👥 User & Space Management
   - 💬 Messaging & Communication
   - 🔧 Interface & Experience Improvements
   - 🐛 Bug Fixes & Stability
   - 🔒 Privacy & Security
   - 📱 Mobile & Cross-Platform

5. **Writing Style**:
   - KEEP IT SHORT: Max 1-2 bullet points per category
   - Write like a friendly announcement, not technical documentation
   - Group multiple related commits into one concise feature description
   - Focus on the main benefit users will notice
   - Avoid technical jargon completely

6. **Examples of good vs bad descriptions**:
   ❌ "You can now pin important messages in channels for easy access by all members"
   ✅ "Pin important messages in channels and organize content better"

   ❌ "Images automatically compress when uploaded, saving bandwidth and storage"
   ✅ "Images now compress automatically to save bandwidth"

   ❌ "Search and filter through member lists in spaces and channels instantly"
   ✅ "Search through member lists instantly and click profiles for details"

7. **Output both formats**:
   - Save markdown version to: src/dev/changelog/quorum-changelog-user-friendly_$(date +%Y-%m-%d_%H-%M).md
   - Save text version to: src/dev/changelog/quorum-changelog-user-friendly_$(date +%Y-%m-%d_%H-%M).txt

8. **Footer**: Include stats like "Based on X key improvements from Y commits"

Remember: Users want to know "What can I do now that I couldn't before?" or "What works better now?"
EOF

echo "✅ Commit analysis saved: $COMMITS_FILE"
echo "📊 Found $(wc -l < important_commits.txt) important commits out of $(wc -l < temp_all_commits.txt) total"
echo ""
echo "🤖 NEXT STEP: Run Claude Code to analyze commits:"
echo "   claude analyze the commits in $COMMITS_FILE and generate the user-friendly changelog"
echo ""
echo "💡 Or copy-paste the analysis file content to Claude and ask:"
echo "   \"Please create a user-friendly changelog based on this commit analysis\""

# Cleanup temp files
rm temp_all_commits.txt important_commits.txt

# Show the result
if [[ "$1" == "--show" ]] || [[ "$2" == "--show" ]] || [[ "$3" == "--show" ]]; then
  echo ""
  echo "📋 Generated User-Friendly Changelog:"
  echo "===================================="
  cat "$OUTPUT"
fi