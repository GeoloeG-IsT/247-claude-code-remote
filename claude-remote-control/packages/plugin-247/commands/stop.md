---
description: Stop a running session
allowed_tools: ['mcp__247-orchestrator__stop_session']
---

# Stop Session

Stop and kill a running Claude session.

## Arguments

`$ARGUMENTS` should contain the session name to stop.

## Process

1. Confirm with user before stopping (unless they explicitly said "stop")
2. Use `stop_session` tool with the session name
3. Report success/failure

## Example Usage

```
/247:stop myproject--spawn-fox-42
```

## Notes

- Stopping a session will terminate the Claude process
- Any unsaved work in the session will be lost
- The session's git worktree (if any) will be cleaned up
- Use `/247:output <name>` first to see what the session has done
