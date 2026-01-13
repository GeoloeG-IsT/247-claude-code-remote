# 247 (Quivr)

Web terminal access to Claude Code from anywhere.

## Quick Start

```bash
# Install CLI
npm install -g 247-cli

# Start the agent
247 start

# Open dashboard
open https://247.quivr.com
```

## Multi-Agent Orchestration Plugin

247 includes a Claude Code plugin for spawning and controlling parallel Claude sessions.

### Installation

```bash
# Add the 247 marketplace
claude marketplace add https://github.com/quivr/247

# Install the plugin
claude plugin install 247-orchestrator
```

Or install locally for development:

```bash
claude plugin install ./packages/plugin-247 --scope local
```

### Commands

| Command              | Description                    |
| -------------------- | ------------------------------ |
| `/247:spawn <task>`  | Spawn a new background session |
| `/247:status [name]` | Check session status           |
| `/247:sessions`      | List all active sessions       |
| `/247:output <name>` | Get session terminal output    |
| `/247:stop <name>`   | Stop a running session         |

### Example Usage

```
# Spawn a background task
/247:spawn Write unit tests for the auth module

# Check all sessions
/247:sessions

# Get output from a specific session
/247:output myproject--spawn-fox-42
```

For complex workflows, use the orchestrator agent which can parallelize tasks automatically.

See [packages/plugin-247/README.md](./packages/plugin-247/README.md) for full documentation.

## Documentation

See [CLAUDE.md](./CLAUDE.md) for detailed documentation.
