---
description: Check status of running sessions
allowed_tools: ['mcp__247-orchestrator__list_sessions', 'mcp__247-orchestrator__get_session_status']
---

# Session Status

Show the status of running Claude sessions.

## Arguments

- If `$ARGUMENTS` is empty: List all active sessions with their status
- If `$ARGUMENTS` contains a session name: Show detailed status for that session

## Process

1. If no arguments provided:
   - Use `list_sessions` tool to get all sessions
   - Display a summary table with: name, status, project, duration, cost

2. If session name provided:
   - Use `get_session_status` tool with the session name
   - Display detailed info: status, attention reason, metrics, output preview

## Status Values

- `init` - Session starting up
- `working` - Claude is actively processing
- `needs_attention` - Waiting for input or permission
- `idle` - Session completed or waiting

## Example Usage

```
/247:status                    # List all sessions
/247:status myproject--spawn-fox-42   # Detailed status for specific session
```
