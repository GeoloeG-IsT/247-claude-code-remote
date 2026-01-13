---
description: Use this skill when the user wants to run multiple tasks in parallel, needs to spawn background Claude sessions, or when a task can be divided into independent sub-tasks for concurrent execution
---

# 247 Multi-Tasking Skill

This skill enables parallel execution of Claude Code tasks through 247's multi-session orchestration.

## When to Activate

Trigger this skill when the user:

- Mentions "parallel", "background", "concurrent", "simultaneously"
- Wants to "spawn" or "start" multiple sessions
- Has a task involving multiple independent files/modules
- Wants to run tests while working on something else
- Needs code review across multiple files at once
- Has a large task that can be divided into smaller independent parts

## Keywords That Trigger This Skill

- "in parallel"
- "at the same time"
- "spawn a session"
- "background task"
- "while I work on X, do Y"
- "review all files in..."
- "run tests in background"
- "multiple agents"

## How to Use 247 Multi-Tasking

### Quick Commands

```
/247:spawn <task>     - Start a background session
/247:sessions         - List all active sessions
/247:status <name>    - Check session status
/247:output <name>    - View session output
/247:stop <name>      - Stop a session
```

### For Complex Orchestration

Use the **orchestrator agent** which can:

- Automatically divide tasks into sub-tasks
- Spawn and monitor multiple sessions
- Handle permission prompts automatically
- Collect and synthesize results

## Parallel Task Examples

### 1. Parallel Testing

```
User: "Run the unit, integration, and e2e tests in parallel"
Action: Spawn 3 sessions, one for each test suite
```

### 2. Multi-File Review

```
User: "Review all the service files for security issues"
Action: Spawn a session per service file for parallel review
```

### 3. Background Work

```
User: "Refactor the auth module in the background while I work on the API"
Action: Spawn a session for auth refactoring, continue working in main session
```

### 4. Bulk Operations

```
User: "Add type annotations to all files in src/utils/"
Action: Spawn sessions for groups of files to parallelize the work
```

## Capacity Limits

- Default: 3 concurrent sessions
- Sessions use git worktrees for isolation (no merge conflicts)
- Each session has its own Claude Code instance

## Monitoring Sessions

Always inform the user about:

- Sessions that have been spawned (with names)
- Sessions that need attention (permission prompts)
- Sessions that have completed
- Summary of what each session accomplished

## Integration with 247 Dashboard

Sessions spawned via this skill are visible in the 247 web dashboard at the configured agent URL. Users can also monitor and interact with sessions through the dashboard interface.
