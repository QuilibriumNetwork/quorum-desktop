Analyze the latest code changes and create a concise, well-formatted commit message.
IMPORTANT: DO NOT MENTION THE LLM OR AI AGENT IN THE COMMIT MESSAGE

Instructions:
1) Run: git status
2) Run: git diff --cached   (or git diff if nothing staged)
3) Inspect changes and create a short commit message (max 50 characters).
4) Commit message format:
   <type>: <short, descriptive message>
5) Available types (choose one):
   feat: new feature or enhancement
   fix: bug fix
   chore: maintenance / non-functional updates
   style: formatting or visual tweaks
   refactor: code restructure, no behavior change
   test: add/update tests
   build: build system / dependency changes
   perf: performance improvements
   doc: changes to documentation (.md)
   task: create/update task (.md) files
   i18n: create/update translations
6) After writing the message, run:
   git add -A && git commit -m "<type>: <message>"
7) Do NOT push to remote.
8) Confirm commit succeeded (show git log -1 or commit hash).

Examples:
fix: handle null check in user fetch
feat: add dark mode toggle
chore: update ESLint config
doc: rewrite setup guide
task: add weekly review checklist