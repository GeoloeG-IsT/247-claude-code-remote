#!/bin/bash
# 247 Hook Script for Claude Code
# VERSION: 2.28.2
# Ultra simple: hook called = needs_attention
set -euo pipefail

AGENT_URL="http://${AGENT_247_HOST:-localhost}:${AGENT_247_PORT:-4678}/api/hooks/status"
cat > /dev/null  # Consume stdin (Claude's event JSON, not needed)

# Use CLAUDE_TMUX_SESSION env var (set by 247 when starting session)
SESSION_ID="${CLAUDE_TMUX_SESSION:-}"
[ -z "$SESSION_ID" ] && exit 0

# Simple: hook called = needs_attention
curl -s -X POST "$AGENT_URL" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg sid "$SESSION_ID" '{sessionId:$sid,status:"needs_attention",source:"hook",timestamp:(now*1000|floor)}')" \
  --connect-timeout 2 --max-time 5 > /dev/null 2>&1 || true

echo "[247-hook] $SESSION_ID needs attention" >&2
