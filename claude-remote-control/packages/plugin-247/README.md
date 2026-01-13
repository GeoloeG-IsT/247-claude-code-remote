# 247 Orchestrator Plugin

Multi-agent orchestration plugin for 247 - spawn and control parallel Claude Code sessions.

## Features

- **Spawn Sessions**: Launch background Claude sessions with `claude -p`
- **Parallel Execution**: Run multiple tasks simultaneously
- **Session Monitoring**: Track status, output, and metrics
- **Orchestrator Agent**: Specialized agent for complex multi-session workflows
- **Multi-tasking Skill**: Auto-triggered for parallelizable tasks

## Installation

### From 247 Marketplace

```bash
# Add the 247 marketplace
claude marketplace add https://github.com/quivr/247

# Install the plugin
claude plugin install 247-orchestrator
```

### Local Development

```bash
# Clone the repo
git clone https://github.com/quivr/247
cd 247

# Install the plugin locally
claude plugin install ./packages/plugin-247 --scope local
```

## Commands

| Command              | Description                    |
| -------------------- | ------------------------------ |
| `/247:spawn <task>`  | Spawn a new background session |
| `/247:status [name]` | Check session status           |
| `/247:sessions`      | List all active sessions       |
| `/247:output <name>` | Get session terminal output    |
| `/247:stop <name>`   | Stop a running session         |

## Examples

### Spawn a Background Task

```
/247:spawn Write unit tests for the auth module
```

### Check Session Status

```
/247:status
/247:status myproject--spawn-fox-42
```

### View Session Output

```
/247:output myproject--spawn-fox-42
```

## Orchestrator Agent

For complex workflows, use the orchestrator agent:

```
Use the orchestrator agent to review all files in src/services/ for security issues
```

The agent will:

1. Analyze and divide the task
2. Spawn parallel sessions
3. Monitor progress
4. Handle permission prompts
5. Collect and synthesize results

## Configuration

The plugin connects to your local 247 agent. Configure the agent URL:

```bash
# Environment variable
export AGENT_247_URL=http://localhost:4678

# Or via config file
echo '{"agentUrl": "http://localhost:4678"}' > ~/.247/config.json
```

## Requirements

- 247 Agent running locally or via tunnel
- Claude Code CLI installed
- Node.js 18+

## License

MIT
