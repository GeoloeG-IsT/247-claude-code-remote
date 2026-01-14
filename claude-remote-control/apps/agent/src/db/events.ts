/**
 * Session Events Database Operations
 *
 * Handles storage and retrieval of structured events from stream-json sessions.
 */

import { getDatabase } from './index.js';
import type { DbSessionEvent } from './schema.js';
import type { SessionEvent } from '247-shared';

/**
 * Insert a session event
 */
export function insertEvent(event: SessionEvent): number {
  const db = getDatabase();

  const stmt = db.prepare(`
    INSERT INTO session_events (
      session_name, event_type, timestamp,
      tool_name, tool_input, tool_id,
      tool_output, tool_error,
      text_content,
      success, duration_ms, total_cost_usd, num_turns
    ) VALUES (
      @sessionName, @eventType, @timestamp,
      @toolName, @toolInput, @toolId,
      @toolOutput, @toolError,
      @textContent,
      @success, @durationMs, @totalCostUsd, @numTurns
    )
  `);

  const result = stmt.run({
    sessionName: event.sessionName,
    eventType: event.eventType,
    timestamp: event.timestamp,
    toolName: event.toolName ?? null,
    toolInput: event.toolInput ? JSON.stringify(event.toolInput) : null,
    toolId: event.toolId ?? null,
    toolOutput: event.toolOutput ?? null,
    toolError: event.toolError !== undefined ? (event.toolError ? 1 : 0) : null,
    textContent: event.text ?? null,
    success: event.success !== undefined ? (event.success ? 1 : 0) : null,
    durationMs: event.durationMs ?? null,
    totalCostUsd: event.totalCostUsd ?? null,
    numTurns: event.numTurns ?? null,
  });

  return result.lastInsertRowid as number;
}

/**
 * Get all events for a session
 */
export function getSessionEvents(sessionName: string): SessionEvent[] {
  const db = getDatabase();

  const rows = db
    .prepare(
      `
    SELECT * FROM session_events
    WHERE session_name = ?
    ORDER BY timestamp ASC
  `
    )
    .all(sessionName) as DbSessionEvent[];

  return rows.map(dbEventToSessionEvent);
}

/**
 * Get events for a session with pagination
 */
export function getSessionEventsPaginated(
  sessionName: string,
  limit: number,
  offset: number
): { events: SessionEvent[]; total: number } {
  const db = getDatabase();

  const countResult = db
    .prepare('SELECT COUNT(*) as count FROM session_events WHERE session_name = ?')
    .get(sessionName) as { count: number };

  const rows = db
    .prepare(
      `
    SELECT * FROM session_events
    WHERE session_name = ?
    ORDER BY timestamp ASC
    LIMIT ? OFFSET ?
  `
    )
    .all(sessionName, limit, offset) as DbSessionEvent[];

  return {
    events: rows.map(dbEventToSessionEvent),
    total: countResult.count,
  };
}

/**
 * Get recent events for a session (last N events)
 */
export function getRecentEvents(sessionName: string, limit = 50): SessionEvent[] {
  const db = getDatabase();

  const rows = db
    .prepare(
      `
    SELECT * FROM session_events
    WHERE session_name = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `
    )
    .all(sessionName, limit) as DbSessionEvent[];

  // Reverse to get chronological order
  return rows.map(dbEventToSessionEvent).reverse();
}

/**
 * Get tool calls for a session
 */
export function getToolCalls(sessionName: string): SessionEvent[] {
  const db = getDatabase();

  const rows = db
    .prepare(
      `
    SELECT * FROM session_events
    WHERE session_name = ? AND event_type = 'tool_call'
    ORDER BY timestamp ASC
  `
    )
    .all(sessionName) as DbSessionEvent[];

  return rows.map(dbEventToSessionEvent);
}

/**
 * Get the result event for a session (if completed)
 */
export function getResultEvent(sessionName: string): SessionEvent | null {
  const db = getDatabase();

  const row = db
    .prepare(
      `
    SELECT * FROM session_events
    WHERE session_name = ? AND event_type = 'result'
    ORDER BY timestamp DESC
    LIMIT 1
  `
    )
    .get(sessionName) as DbSessionEvent | undefined;

  return row ? dbEventToSessionEvent(row) : null;
}

/**
 * Delete all events for a session
 */
export function deleteSessionEvents(sessionName: string): number {
  const db = getDatabase();

  const result = db.prepare('DELETE FROM session_events WHERE session_name = ?').run(sessionName);

  return result.changes;
}

/**
 * Delete events older than a certain age
 */
export function deleteOldEvents(maxAgeMs: number): number {
  const db = getDatabase();
  const cutoff = Date.now() - maxAgeMs;

  const result = db.prepare('DELETE FROM session_events WHERE timestamp < ?').run(cutoff);

  return result.changes;
}

/**
 * Get event count for a session
 */
export function getEventCount(sessionName: string): number {
  const db = getDatabase();

  const result = db
    .prepare('SELECT COUNT(*) as count FROM session_events WHERE session_name = ?')
    .get(sessionName) as { count: number };

  return result.count;
}

/**
 * Convert DB row to SessionEvent
 */
function dbEventToSessionEvent(row: DbSessionEvent): SessionEvent {
  const event: SessionEvent = {
    id: row.id.toString(),
    sessionName: row.session_name,
    timestamp: row.timestamp,
    eventType: row.event_type,
  };

  // Tool call fields
  if (row.tool_name) event.toolName = row.tool_name;
  if (row.tool_input) {
    try {
      event.toolInput = JSON.parse(row.tool_input);
    } catch {
      // Keep as undefined if parse fails
    }
  }
  if (row.tool_id) event.toolId = row.tool_id;

  // Tool result fields
  if (row.tool_output) event.toolOutput = row.tool_output;
  if (row.tool_error !== null) event.toolError = row.tool_error === 1;

  // Text content
  if (row.text_content) event.text = row.text_content;

  // Result fields
  if (row.success !== null) event.success = row.success === 1;
  if (row.duration_ms !== null) event.durationMs = row.duration_ms;
  if (row.total_cost_usd !== null) event.totalCostUsd = row.total_cost_usd;
  if (row.num_turns !== null) event.numTurns = row.num_turns;

  return event;
}
