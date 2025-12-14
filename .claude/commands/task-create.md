---
description: Create a task using docs-manager skill
---

# Task Creation Workflow

## Step 1: Create Task
Use the `docs-manager` skill to create a task for the feature being discussed or specified by the user.

## Step 2: Parallel Analysis
After the task is created, launch these agents **in parallel** using the Task tool:

1. **feature-analyzer**: Review the task for best practices, over-engineering, and implementation completeness
2. **security-analyst**: Review the task for security vulnerabilities and privacy concerns

## Step 3: Refinement
Update the task document based on agent feedback (if any improvements are suggested).

Provide in chat a summary of changes made by the agents.
