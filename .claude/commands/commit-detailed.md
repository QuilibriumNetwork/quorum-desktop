Analyze the latest code changes and generate a detailed, well-structured commit message
IMPORTANT: DO NOT MENTION THE LLM OR AI AGENT IN THE COMMIT MESSAGE

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

5) Available types:
   feat: new feature or enhancement
   fix: bug fix
   chore: maintenance / non-functional updates
   style: formatting or visual tweaks
   refactor: code restructure, no behavior change
   test: add/update tests
   build: build system / dependency changes
   perf: performance improvements
   doc: documentation updates (.md)
   task: creation or update of task files (.md)

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
