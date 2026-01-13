import type { AgentClient } from '../client/agent-client.js';

export interface ToolContext {
  agentClient: AgentClient;
}

export const toolDefinitions = [
  {
    name: 'spawn_session',
    description:
      'Spawn a new Claude Code session that runs claude -p with a prompt. Returns the session name for tracking.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        prompt: {
          type: 'string',
          description: 'The prompt/task to send to Claude Code',
        },
        project: {
          type: 'string',
          description: 'Project name (must be in agent whitelist)',
        },
        worktree: {
          type: 'boolean',
          description: 'Create isolated git worktree for this session (default: false)',
        },
        branchName: {
          type: 'string',
          description: 'Branch name for worktree (auto-generated if not specified)',
        },
        trustMode: {
          type: 'boolean',
          description: 'Skip permission prompts (--dangerously-skip-permissions)',
        },
        model: {
          type: 'string',
          description: 'Model to use (e.g., "opus", "sonnet")',
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds (default: no timeout)',
        },
      },
      required: ['prompt', 'project'],
    },
  },
  {
    name: 'list_sessions',
    description: 'Get all active Claude Code sessions with their current status',
    inputSchema: {
      type: 'object' as const,
      properties: {
        project: {
          type: 'string',
          description: 'Filter by project name (optional)',
        },
        status: {
          type: 'string',
          enum: ['init', 'working', 'needs_attention', 'idle'],
          description: 'Filter by status (optional)',
        },
      },
    },
  },
  {
    name: 'get_session_status',
    description: 'Get detailed status of a specific session',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          description: 'Session name',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'get_session_output',
    description: 'Get terminal output from a session',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          description: 'Session name',
        },
        lines: {
          type: 'number',
          description: 'Number of lines to retrieve (default: 100, max: 10000)',
        },
        format: {
          type: 'string',
          enum: ['raw', 'plain'],
          description: 'Output format: raw (with ANSI) or plain (stripped)',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'send_input',
    description: 'Send input text to a session (for answering prompts or providing permissions)',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          description: 'Session name',
        },
        text: {
          type: 'string',
          description: 'Text to send (will be followed by Enter by default)',
        },
        sendEnter: {
          type: 'boolean',
          description: 'Append Enter after text (default: true)',
        },
      },
      required: ['name', 'text'],
    },
  },
  {
    name: 'wait_for_completion',
    description: 'Wait until a session completes or reaches needs_attention state',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          description: 'Session name to wait for',
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds (default: 300000 = 5 min)',
        },
        pollInterval: {
          type: 'number',
          description: 'Polling interval in milliseconds (default: 5000)',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'stop_session',
    description: 'Kill a running session',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          description: 'Session name',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'archive_session',
    description: 'Mark a session as complete and archive it (preserves history)',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          description: 'Session name',
        },
      },
      required: ['name'],
    },
  },
];

export async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  context: ToolContext
): Promise<unknown> {
  const { agentClient } = context;

  switch (name) {
    case 'spawn_session': {
      const result = await agentClient.spawnSession({
        prompt: args.prompt as string,
        project: args.project as string,
        worktree: args.worktree as boolean | undefined,
        branchName: args.branchName as string | undefined,
        trustMode: args.trustMode as boolean | undefined,
        model: args.model as string | undefined,
        timeout: args.timeout as number | undefined,
      });
      return result;
    }

    case 'list_sessions': {
      let sessions = await agentClient.listSessions();

      if (args.project) {
        sessions = sessions.filter((s) => s.project === args.project);
      }
      if (args.status) {
        sessions = sessions.filter((s) => s.status === args.status);
      }

      return {
        sessions: sessions.map((s) => ({
          name: s.name,
          project: s.project,
          status: s.status,
          attentionReason: s.attentionReason,
          createdAt: s.createdAt,
          lastActivity: s.lastActivity,
          model: s.model,
          costUsd: s.costUsd,
        })),
        total: sessions.length,
      };
    }

    case 'get_session_status': {
      const session = await agentClient.getSession(args.name as string);
      if (!session) {
        return { error: `Session not found: ${args.name}` };
      }
      return session;
    }

    case 'get_session_output': {
      const result = await agentClient.getSessionOutput(
        args.name as string,
        (args.lines as number) || 100,
        (args.format as 'raw' | 'plain') || 'plain'
      );
      return result;
    }

    case 'send_input': {
      const result = await agentClient.sendInput(
        args.name as string,
        args.text as string,
        args.sendEnter !== false
      );
      return result;
    }

    case 'wait_for_completion': {
      const sessionName = args.name as string;
      const timeout = (args.timeout as number) || 300000; // 5 min default
      const pollInterval = (args.pollInterval as number) || 5000; // 5s default

      const startTime = Date.now();

      while (Date.now() - startTime < timeout) {
        const session = await agentClient.getSession(sessionName);

        if (!session) {
          return {
            completed: false,
            error: `Session not found: ${sessionName}`,
            duration: Date.now() - startTime,
          };
        }

        if (session.status === 'idle' || session.status === 'needs_attention') {
          return {
            completed: true,
            finalStatus: session.status,
            attentionReason: session.attentionReason,
            duration: Date.now() - startTime,
            timedOut: false,
          };
        }

        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      }

      return {
        completed: false,
        finalStatus: 'timeout',
        duration: timeout,
        timedOut: true,
      };
    }

    case 'stop_session': {
      const result = await agentClient.stopSession(args.name as string);
      return result;
    }

    case 'archive_session': {
      const result = await agentClient.archiveSession(args.name as string);
      return result;
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
