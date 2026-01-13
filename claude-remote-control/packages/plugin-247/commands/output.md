---
description: Get terminal output from a session
allowed_tools: ['mcp__247-orchestrator__get_session_output']
---

# Session Output

Retrieve the terminal output from a running or completed session.

## Arguments

`$ARGUMENTS` should contain the session name.

Optionally append `:N` to specify number of lines (e.g., `session-name:50`).

## Process

1. Parse session name from arguments
2. Use `get_session_output` tool with:
   - `name`: The session name
   - `lines`: Number of lines (default 100)
   - `format`: "plain" (ANSI stripped for readability)

3. Display the output with context about the session status

## Example Usage

```
/247:output myproject--spawn-fox-42      # Last 100 lines
/247:output myproject--spawn-fox-42:500  # Last 500 lines
```

## Notes

- Output is captured from the tmux scrollback buffer
- Use this to see what Claude has done in the session
- For real-time monitoring, check the 247 dashboard
