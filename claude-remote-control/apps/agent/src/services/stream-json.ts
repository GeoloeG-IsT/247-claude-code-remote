/**
 * StreamJsonSession - Manages Claude sessions using stream-json format
 *
 * Instead of tmux + terminal parsing, this spawns Claude with:
 *   --input-format stream-json --output-format stream-json --verbose
 *
 * Benefits:
 * - Structured events (no ANSI parsing)
 * - Programmatic tool call interception
 * - Direct cost/token tracking
 * - Bidirectional communication via stdin/stdout
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { createInterface, Interface } from 'readline';
import type {
  StreamJsonEvent,
  StreamJsonInitEvent,
  StreamJsonAssistantEvent,
  StreamJsonUserEvent,
  StreamJsonResultEvent,
  SessionEvent,
  SessionStatus,
} from '247-shared';
import { randomUUID } from 'crypto';

export interface StreamJsonSessionOptions {
  cwd: string;
  sessionName: string;
  prompt: string;
  model?: string;
  trustMode?: boolean;
  envVars?: Record<string, string>;
  onEvent?: (event: SessionEvent) => void;
  onStatusChange?: (status: SessionStatus) => void;
  onComplete?: (result: StreamJsonResultEvent) => void;
}

export type StreamSessionStatus = 'starting' | 'running' | 'waiting_input' | 'completed' | 'error';

export class StreamJsonSession extends EventEmitter {
  private process: ChildProcess | null = null;
  private readline: Interface | null = null;
  private options: StreamJsonSessionOptions;
  private events: SessionEvent[] = [];
  private status: StreamSessionStatus = 'starting';
  private claudeSessionId: string | null = null;
  private model: string | null = null;

  constructor(options: StreamJsonSessionOptions) {
    super();
    this.options = options;
  }

  /**
   * Start the Claude process
   */
  start(): void {
    const args = ['--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose'];

    if (this.options.trustMode) {
      args.push('--dangerously-skip-permissions');
    }

    if (this.options.model) {
      args.push('--model', this.options.model);
    }

    // Build environment
    const env = {
      ...process.env,
      ...this.options.envVars,
    };

    console.log(`[StreamJson] Starting session ${this.options.sessionName} in ${this.options.cwd}`);

    this.process = spawn('claude', args, {
      cwd: this.options.cwd,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    if (!this.process.stdout || !this.process.stdin) {
      this.handleError(new Error('Failed to get process streams'));
      return;
    }

    // Parse NDJSON from stdout
    this.readline = createInterface({
      input: this.process.stdout,
      crlfDelay: Infinity,
    });

    this.readline.on('line', (line) => {
      this.parseLine(line);
    });

    this.process.stderr?.on('data', (data) => {
      console.error(`[StreamJson] stderr: ${data.toString()}`);
    });

    this.process.on('error', (err) => {
      this.handleError(err);
    });

    this.process.on('exit', (code) => {
      console.log(`[StreamJson] Process exited with code ${code}`);
      if (this.status !== 'completed') {
        this.status = code === 0 ? 'completed' : 'error';
        this.emit('exit', code);
      }
    });

    // Send initial prompt
    this.sendUserMessage(this.options.prompt);
    this.status = 'running';
    this.options.onStatusChange?.('working');
  }

  /**
   * Parse a line of NDJSON output
   */
  private parseLine(line: string): void {
    if (!line.trim()) return;

    try {
      const event = JSON.parse(line) as StreamJsonEvent;
      this.handleEvent(event);
    } catch (_err) {
      console.error(`[StreamJson] Failed to parse line: ${line.substring(0, 100)}...`);
    }
  }

  /**
   * Handle a parsed stream event
   */
  private handleEvent(event: StreamJsonEvent): void {
    switch (event.type) {
      case 'system':
        this.handleInitEvent(event as StreamJsonInitEvent);
        break;
      case 'assistant':
        this.handleAssistantEvent(event as StreamJsonAssistantEvent);
        break;
      case 'user':
        this.handleUserEvent(event as StreamJsonUserEvent);
        break;
      case 'result':
        this.handleResultEvent(event as StreamJsonResultEvent);
        break;
    }
  }

  /**
   * Handle system init event
   */
  private handleInitEvent(event: StreamJsonInitEvent): void {
    this.claudeSessionId = event.session_id;
    this.model = event.model;

    const sessionEvent: SessionEvent = {
      id: randomUUID(),
      sessionName: this.options.sessionName,
      timestamp: Date.now(),
      eventType: 'init',
    };

    this.addEvent(sessionEvent);
    this.emit('init', event);
  }

  /**
   * Handle assistant message event
   */
  private handleAssistantEvent(event: StreamJsonAssistantEvent): void {
    for (const content of event.message.content) {
      if (content.type === 'text') {
        const sessionEvent: SessionEvent = {
          id: randomUUID(),
          sessionName: this.options.sessionName,
          timestamp: Date.now(),
          eventType: 'text',
          text: content.text,
        };
        this.addEvent(sessionEvent);
        this.emit('text', content.text);
      } else if (content.type === 'tool_use') {
        const sessionEvent: SessionEvent = {
          id: randomUUID(),
          sessionName: this.options.sessionName,
          timestamp: Date.now(),
          eventType: 'tool_call',
          toolName: content.name,
          toolInput: content.input,
          toolId: content.id,
        };
        this.addEvent(sessionEvent);
        this.emit('tool_call', {
          name: content.name,
          input: content.input,
          id: content.id,
        });

        // Check if this is AskUserQuestion - we need to handle it specially
        if (content.name === 'AskUserQuestion') {
          this.status = 'waiting_input';
          this.options.onStatusChange?.('needs_attention');
          this.emit('needs_input', content.input);
        }
      }
    }
  }

  /**
   * Handle user message event (tool results)
   */
  private handleUserEvent(event: StreamJsonUserEvent): void {
    for (const content of event.message.content) {
      if (content.type === 'tool_result') {
        const sessionEvent: SessionEvent = {
          id: randomUUID(),
          sessionName: this.options.sessionName,
          timestamp: Date.now(),
          eventType: 'tool_result',
          toolId: content.tool_use_id,
          toolOutput: event.tool_use_result?.stdout || content.content,
          toolError: content.is_error,
        };
        this.addEvent(sessionEvent);
        this.emit('tool_result', {
          id: content.tool_use_id,
          output: event.tool_use_result?.stdout || content.content,
          error: content.is_error,
        });
      }
    }
  }

  /**
   * Handle final result event
   */
  private handleResultEvent(event: StreamJsonResultEvent): void {
    const sessionEvent: SessionEvent = {
      id: randomUUID(),
      sessionName: this.options.sessionName,
      timestamp: Date.now(),
      eventType: 'result',
      success: !event.is_error,
      durationMs: event.duration_ms,
      totalCostUsd: event.total_cost_usd,
      numTurns: event.num_turns,
    };
    this.addEvent(sessionEvent);

    this.status = 'completed';
    this.options.onStatusChange?.('idle');
    this.options.onComplete?.(event);
    this.emit('result', event);
    this.emit('complete', event);
  }

  /**
   * Add event and notify callback
   */
  private addEvent(event: SessionEvent): void {
    this.events.push(event);
    this.options.onEvent?.(event);
    this.emit('event', event);
  }

  /**
   * Handle process error
   */
  private handleError(err: Error): void {
    console.error(`[StreamJson] Error in session ${this.options.sessionName}:`, err);
    this.status = 'error';
    this.options.onStatusChange?.('idle');
    this.emit('error', err);
  }

  /**
   * Send a user message via stdin
   */
  sendUserMessage(content: string): void {
    if (!this.process?.stdin?.writable) {
      console.error(`[StreamJson] Cannot send message - stdin not writable`);
      return;
    }

    const message = {
      type: 'user',
      message: {
        role: 'user',
        content: content,
      },
    };

    this.process.stdin.write(JSON.stringify(message) + '\n');
  }

  /**
   * Send a tool result via stdin (for responding to AskUserQuestion, etc.)
   */
  sendToolResult(toolUseId: string, result: string, isError = false): void {
    if (!this.process?.stdin?.writable) {
      console.error(`[StreamJson] Cannot send tool result - stdin not writable`);
      return;
    }

    const message = {
      type: 'user',
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: toolUseId,
            content: result,
            is_error: isError,
          },
        ],
      },
    };

    this.process.stdin.write(JSON.stringify(message) + '\n');

    if (this.status === 'waiting_input') {
      this.status = 'running';
      this.options.onStatusChange?.('working');
    }
  }

  /**
   * Kill the process
   */
  kill(): void {
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
    }
    if (this.readline) {
      this.readline.close();
      this.readline = null;
    }
  }

  /**
   * Get all events
   */
  getEvents(): SessionEvent[] {
    return [...this.events];
  }

  /**
   * Get current status
   */
  getStatus(): StreamSessionStatus {
    return this.status;
  }

  /**
   * Get Claude session ID
   */
  getClaudeSessionId(): string | null {
    return this.claudeSessionId;
  }

  /**
   * Get model name
   */
  getModel(): string | null {
    return this.model;
  }

  /**
   * Check if process is running
   */
  isRunning(): boolean {
    return this.status === 'running' || this.status === 'waiting_input';
  }
}

// Registry for active stream-json sessions
const activeSessions = new Map<string, StreamJsonSession>();

export function getStreamSession(sessionName: string): StreamJsonSession | undefined {
  return activeSessions.get(sessionName);
}

export function registerStreamSession(sessionName: string, session: StreamJsonSession): void {
  activeSessions.set(sessionName, session);
}

export function unregisterStreamSession(sessionName: string): void {
  activeSessions.delete(sessionName);
}

export function getAllStreamSessions(): Map<string, StreamJsonSession> {
  return activeSessions;
}
