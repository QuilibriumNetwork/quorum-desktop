---
description: Tag a commit for production deployment
argument-hint: [commit-hash] (leave empty to tag HEAD)
allowed-tools: Bash
---

Tag a commit for production deployment using the `prod-YYYY-MM-DD` naming convention.

Arguments: $ARGUMENTS

**WORKFLOW:**

1. **Determine the commit to tag:**
   - If an argument is provided, use it as the commit hash
   - If no argument, use the current HEAD

2. **Show the commit being tagged:**
   - Run `git log -1 --format="%h %ci %s" <commit>` so the user sees exactly what they're tagging

3. **Generate the tag name:**
   - Base name: `prod-YYYY-MM-DD` using today's date
   - Check if that tag already exists with `git tag -l "prod-YYYY-MM-DD*"`
   - If it exists, append an incrementing suffix: `prod-YYYY-MM-DD-2`, `prod-YYYY-MM-DD-3`, etc.

4. **Confirm with the user before proceeding:**
   - Show: the tag name, the commit hash, and the commit message
   - Ask: "Tag and push?" — wait for confirmation

5. **After confirmation:**
   - Create the annotated tag: `git tag -a <tag-name> <commit> -m "Production deployment"`
   - Push the tag: `git push origin <tag-name>`
   - Show the final result: tag name, commit, and remote URL

**IMPORTANT:**
- Always use annotated tags (`-a`), not lightweight tags
- Never push without user confirmation
- Use the actual current date, not a placeholder
