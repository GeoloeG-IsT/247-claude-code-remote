---
description: Spawn a new parallel Claude session with a task
allowed_tools: ['mcp__247-orchestrator__spawn_session']
---

# Spawn Session

Spawn a new parallel Claude Code session to work on a task in the background.

## Arguments

`$ARGUMENTS` contains the task description to pass to the new session.

## Process

1. Use the `spawn_session` MCP tool with:
   - `prompt`: The task from $ARGUMENTS
   - `project`: Current project (or ask user if unclear)
   - `worktree`: true (for git isolation)

2. Report the session name back to the user

3. The session will run `claude -p "task"` in the background

## Example Usage

```
/247:spawn Write unit tests for the auth module
/247:spawn Review src/api.ts for security issues
/247:spawn Fix the failing tests in tests/unit/
```

## Notes

- Sessions run independently and can be monitored with `/247:status`
- Use `/247:output <session>` to see what a session has done
- Multiple sessions can run in parallel (up to capacity limit)
