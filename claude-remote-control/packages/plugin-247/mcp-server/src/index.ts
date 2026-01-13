#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import { getConfig } from './config/index.js';
import { AgentClient } from './client/agent-client.js';
import { toolDefinitions, handleToolCall } from './tools/index.js';

async function main() {
  const config = getConfig();
  const agentClient = new AgentClient(config);

  console.error(`[247-orchestrator] Starting MCP server`);
  console.error(`[247-orchestrator] Agent URL: ${config.agentUrl}`);

  const server = new Server(
    {
      name: '247-orchestrator',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: toolDefinitions,
  }));

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    console.error(`[247-orchestrator] Tool call: ${name}`);

    try {
      const result = await handleToolCall(name, args || {}, { agentClient });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      console.error(`[247-orchestrator] Error in ${name}:`, error);

      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Connect via stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('[247-orchestrator] MCP server running');
}

main().catch((error) => {
  console.error('[247-orchestrator] Fatal error:', error);
  process.exit(1);
});
