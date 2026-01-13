---
description: List all active sessions
allowed_tools: ['mcp__247-orchestrator__list_sessions']
---

# List Sessions

List all active Claude sessions with their current status.

## Process

1. Use `list_sessions` tool to get all sessions
2. Display a formatted table with:
   - Session name
   - Project
   - Status (with emoji indicator)
   - Duration
   - Cost (if available)
   - Attention reason (if needs_attention)

## Status Indicators

- `working` - Claude is actively working
- `needs_attention` - Waiting for user input/permission
- `idle` - Session completed
- `init` - Session starting

## Example Output

```
Sessions:
---------
| Name                    | Status          | Project | Duration |
|-------------------------|-----------------|---------|----------|
| myapp--spawn-fox-42     | working         | myapp   | 2m 30s   |
| myapp--spawn-owl-17     | needs_attention | myapp   | 5m 12s   |
| other--spawn-bear-8     | idle            | other   | 1m 45s   |
```

## Notes

- Use `/247:status <name>` for detailed info on a specific session
- Use `/247:output <name>` to see what a session has done
