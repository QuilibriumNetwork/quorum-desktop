---
description: Generate detailed, well-structured commit messages from code changes
---

Commit what you did in this session, or what the user asks specifically.

CRITICAL: NEVER mention Claude, AI, LLM, Anthropic, or add any AI attribution to the commit.

User notes: $ARGUMENTS

Instructions:
1) Run: git status
2) Run: git diff --cached   (or git diff if nothing staged)
3) Analyze all code changes in detail.
4) Create a commit message with this format:

   <type>: <short summary line (max 50 chars)>

   <detailed description (max 700 chars)>
   - Use short sentences and bullet points.
   - Describe what changed and why.
   - Focus on clarity, not verbosity.
   - Skip detailed description if the commit is very simple.

5) Available types:
   feat: new feature or enhancement
   fix: bug fix
   chore: maintenance / non-functional updates
   style: css, layout, formatting or visual tweaks
   refactor: code restructure, no behavior change
   test: add/update tests
   build: build system / dependency changes
   perf: performance improvements
   doc: changes to documentation (.md)
   task: create/update task (.md) files
   i18n: create/update translations

6) After composing the message, run:
   git add -A && git commit -m "<type>: <short summary>" -m "<detailed description>"

7) Do NOT push to remote.
8) Confirm that the commit was successful (e.g., git log -1).

Examples:
fix: handle null user case

- Added null check for user object
- Prevented crash during login
- Updated unit tests for coverage

feat: add settings modal

- Implemented UI for user preferences
- Added theme and language options
- Linked to persistent config storage


IMPORTANT:
for files in src/i18n you need to add them in batches and then create the commit, e.g.

git add src/i18n/ar/* src/i18n/cs/* src/i18n/da/* src/i18n/de/*
git add src/i18n/defaultLocale/* src/i18n/el/* src/i18n/en-PI/* src/i18n/en/*
git add src/i18n/es/* src/i18n/fi/* src/i18n/fr/* src/i18n/he/*
git add src/i18n/id/* src/i18n/it/* src/i18n/ja/* src/i18n/ko/*
git add src/i18n/nl/* src/i18n/no/* src/i18n/pl/* src/i18n/pt/*
git add src/i18n/ro/* src/i18n/ru/* src/i18n/sk/* src/i18n/sl/*
git add src/i18n/sr/* src/i18n/sv/* src/i18n/th/* src/i18n/tr/*
git add src/i18n/uk/* src/i18n/vi/* src/i18n/zh-CN/* src/i18n/zh-TW/*
git commit -m "i18n: update translations"
