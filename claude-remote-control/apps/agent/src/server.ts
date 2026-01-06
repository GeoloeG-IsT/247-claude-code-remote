import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createHttpServer } from 'http';
import { createTerminal } from './terminal.js';
import config from '../config.json' with { type: 'json' };
import type { WSMessageToAgent } from '@claude-remote/shared';

export function createServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const server = createHttpServer(app);
  const wss = new WebSocketServer({ server, path: '/terminal' });

  // WebSocket terminal handler
  wss.on('connection', async (ws, req) => {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const project = url.searchParams.get('project');
    const sessionName = url.searchParams.get('session') || `claude-${Date.now()}`;

    // Validate project whitelist
    if (!project || !config.projects.whitelist.includes(project)) {
      ws.close(1008, 'Project not whitelisted');
      return;
    }

    const projectPath = `${config.projects.basePath}/${project}`.replace(
      '~',
      process.env.HOME!
    );

    console.log(`New terminal connection for project: ${project}`);
    console.log(`Project path: ${projectPath}`);

    // Verify path exists
    const fs = await import('fs');
    if (!fs.existsSync(projectPath)) {
      console.error(`Path does not exist: ${projectPath}`);
      ws.close(1008, 'Project path not found');
      return;
    }

    let terminal;
    try {
      terminal = createTerminal(projectPath, sessionName);
    } catch (err) {
      console.error('Failed to create terminal:', err);
      ws.close(1011, 'Failed to create terminal');
      return;
    }

    // Forward terminal output to WebSocket
    terminal.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    terminal.onExit(({ exitCode }) => {
      console.log(`Terminal exited with code ${exitCode}`);
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(1000, 'Terminal closed');
      }
    });

    // Handle incoming messages
    ws.on('message', (data) => {
      try {
        const msg: WSMessageToAgent = JSON.parse(data.toString());

        switch (msg.type) {
          case 'input':
            terminal.write(msg.data);
            break;
          case 'resize':
            terminal.resize(msg.cols, msg.rows);
            break;
          case 'start-claude':
            terminal.write('claude\r');
            break;
          case 'ping':
            ws.send(JSON.stringify({ type: 'pong' }));
            break;
        }
      } catch (err) {
        console.error('Failed to parse message:', err);
      }
    });

    ws.on('close', () => {
      console.log(`Client disconnected, tmux session '${sessionName}' preserved`);
      // Detach from tmux instead of killing - session stays alive
      terminal.detach();
    });

    ws.on('error', (err) => {
      console.error('WebSocket error:', err);
    });
  });

  // REST API endpoints
  app.get('/api/projects', (_req, res) => {
    res.json(config.projects.whitelist);
  });

  app.get('/api/sessions', async (_req, res) => {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    try {
      const { stdout } = await execAsync(
        'tmux list-sessions -F "#{session_name}" 2>/dev/null'
      );
      res.json(stdout.trim().split('\n').filter(Boolean));
    } catch {
      res.json([]);
    }
  });

  return server;
}
