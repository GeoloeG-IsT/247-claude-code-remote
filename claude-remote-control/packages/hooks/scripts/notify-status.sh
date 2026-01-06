#!/bin/bash
set -euo pipefail

# Read stdin for hook input
INPUT=$(cat)

# Extract event details
EVENT=$(echo "$INPUT" | jq -r '.hook_event_name // "unknown"' 2>/dev/null || echo "unknown")
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // "unknown"' 2>/dev/null || echo "unknown")
NOTIFICATION_TYPE=$(echo "$INPUT" | jq -r '.notification_type // ""' 2>/dev/null || echo "")
STOP_REASON=$(echo "$INPUT" | jq -r '.stop_reason // ""' 2>/dev/null || echo "")
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null || echo "")
CWD=$(echo "$INPUT" | jq -r '.cwd // ""' 2>/dev/null || echo "")

# Detect tmux session name with multiple fallback methods
TMUX_SESSION=""

# Priority 1: Use CLAUDE_TMUX_SESSION env var (set by agent - most reliable)
if [ -z "$TMUX_SESSION" ]; then
  TMUX_SESSION="${CLAUDE_TMUX_SESSION:-}"
fi

# Priority 2: Try tmux display-message if in tmux context
if [ -z "$TMUX_SESSION" ] && [ -n "$TMUX" ]; then
  TMUX_SESSION=$(tmux display-message -p '#{session_name}' 2>/dev/null || echo "")
fi

# Priority 3: Query tmux by parent PID (finds session containing our shell)
if [ -z "$TMUX_SESSION" ]; then
  TMUX_SESSION=$(tmux list-panes -a -F '#{pane_pid} #{session_name}' 2>/dev/null | \
    awk -v pid="$PPID" '$1 == pid {print $2}' | head -1 || echo "")
fi

# Priority 4: Try to find session by current tty
if [ -z "$TMUX_SESSION" ]; then
  CURRENT_TTY=$(tty 2>/dev/null | sed 's|/dev/||' || echo "")
  if [ -n "$CURRENT_TTY" ]; then
    TMUX_SESSION=$(tmux list-panes -a -F '#{pane_tty} #{session_name}' 2>/dev/null | \
      grep "$CURRENT_TTY" | awk '{print $2}' | head -1 || echo "")
  fi
fi

# Get project name from cwd (last component of path)
PROJECT=$(basename "$CWD" 2>/dev/null || echo "")

# Get current timestamp in milliseconds
TIMESTAMP=$(($(date +%s) * 1000))

# Notify local agent with full event data
curl -s -X POST "http://localhost:4678/api/hooks/status" \
  -H "Content-Type: application/json" \
  -d "{
    \"event\": \"$EVENT\",
    \"session_id\": \"$SESSION_ID\",
    \"tmux_session\": \"$TMUX_SESSION\",
    \"project\": \"$PROJECT\",
    \"cwd\": \"$CWD\",
    \"notification_type\": \"$NOTIFICATION_TYPE\",
    \"stop_reason\": \"$STOP_REASON\",
    \"tool_name\": \"$TOOL_NAME\",
    \"timestamp\": $TIMESTAMP
  }" > /dev/null 2>&1 || true

# Exit successfully (don't block Claude)
exit 0
