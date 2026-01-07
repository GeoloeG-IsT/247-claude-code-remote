import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Test paste handling logic in Terminal component.
 *
 * The bug: When pasting with Cmd+V, text was sometimes pasted twice because:
 * 1. Custom key handler sends clipboard text via WebSocket
 * 2. xterm.js onData also fires with the same text
 *
 * The fix: Use isPastingRef flag to prevent onData from sending during paste.
 */

// Helper to create keyboard events
const createKeyboardEvent = (
  key: string,
  type: 'keydown' | 'keyup',
  modifiers: { metaKey?: boolean; ctrlKey?: boolean } = {}
): KeyboardEvent => {
  return new KeyboardEvent(type, {
    key,
    metaKey: modifiers.metaKey ?? false,
    ctrlKey: modifiers.ctrlKey ?? false,
    bubbles: true,
  });
};

// Extract the paste handling logic for testing
interface PasteHandlerState {
  isPasting: boolean;
}

interface MockWebSocket {
  send: (data: string) => void;
  readyState: number;
}

const WEBSOCKET_OPEN = 1;

/**
 * Simulates the custom key event handler logic from Terminal.tsx
 * Returns true if the event was handled (should return false to prevent default)
 */
const handleCustomKeyEvent = (
  event: KeyboardEvent,
  state: PasteHandlerState,
  ws: MockWebSocket | null,
  clipboardText: string
): boolean => {
  // Cmd+V (Mac) or Ctrl+V (Windows/Linux) = paste (only on keydown)
  if ((event.metaKey || event.ctrlKey) && event.key === 'v' && event.type === 'keydown') {
    state.isPasting = true;

    // Simulate async clipboard read completing immediately for test
    if (ws && ws.readyState === WEBSOCKET_OPEN) {
      ws.send(JSON.stringify({ type: 'input', data: clipboardText }));
    }

    return true; // Event was handled
  }
  return false; // Event was not handled
};

/**
 * Simulates the onData handler logic from Terminal.tsx
 */
const handleOnData = (data: string, state: PasteHandlerState, ws: MockWebSocket | null): void => {
  // Skip if paste in progress
  if (state.isPasting) return;

  if (ws && ws.readyState === WEBSOCKET_OPEN) {
    ws.send(JSON.stringify({ type: 'input', data }));
  }
};

describe('Terminal paste handling', () => {
  let mockWs: MockWebSocket;
  let state: PasteHandlerState;

  beforeEach(() => {
    mockWs = {
      send: vi.fn(),
      readyState: WEBSOCKET_OPEN,
    };
    state = { isPasting: false };
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Cmd+V paste handling', () => {
    it('should send clipboard data only once on Cmd+V keydown', () => {
      const clipboardText = 'pasted text';

      // Simulate Cmd+V keydown
      const keydownEvent = createKeyboardEvent('v', 'keydown', { metaKey: true });
      const handled = handleCustomKeyEvent(keydownEvent, state, mockWs, clipboardText);

      expect(handled).toBe(true);
      expect(state.isPasting).toBe(true);
      expect(mockWs.send).toHaveBeenCalledTimes(1);
      expect(mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'input', data: clipboardText })
      );
    });

    it('should ignore Cmd+V keyup event', () => {
      const clipboardText = 'pasted text';

      // Simulate Cmd+V keyup (should be ignored)
      const keyupEvent = createKeyboardEvent('v', 'keyup', { metaKey: true });
      const handled = handleCustomKeyEvent(keyupEvent, state, mockWs, clipboardText);

      expect(handled).toBe(false);
      expect(state.isPasting).toBe(false);
      expect(mockWs.send).not.toHaveBeenCalled();
    });

    it('should work with Ctrl+V (Windows/Linux)', () => {
      const clipboardText = 'pasted text';

      // Simulate Ctrl+V keydown
      const keydownEvent = createKeyboardEvent('v', 'keydown', { ctrlKey: true });
      const handled = handleCustomKeyEvent(keydownEvent, state, mockWs, clipboardText);

      expect(handled).toBe(true);
      expect(state.isPasting).toBe(true);
      expect(mockWs.send).toHaveBeenCalledTimes(1);
    });
  });

  describe('onData handler during paste', () => {
    it('should skip onData events while isPasting is true', () => {
      const clipboardText = 'pasted text';

      // First, trigger paste (sets isPasting = true)
      const keydownEvent = createKeyboardEvent('v', 'keydown', { metaKey: true });
      handleCustomKeyEvent(keydownEvent, state, mockWs, clipboardText);

      expect(mockWs.send).toHaveBeenCalledTimes(1);

      // Now simulate xterm.js firing onData with the same text
      handleOnData(clipboardText, state, mockWs);

      // Should NOT send again because isPasting is true
      expect(mockWs.send).toHaveBeenCalledTimes(1);
    });

    it('should allow onData events when isPasting is false', () => {
      // Regular typing (isPasting = false)
      const typedChar = 'a';

      handleOnData(typedChar, state, mockWs);

      expect(mockWs.send).toHaveBeenCalledTimes(1);
      expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify({ type: 'input', data: typedChar }));
    });

    it('should allow onData events after paste flag is cleared', () => {
      const clipboardText = 'pasted text';

      // Trigger paste
      const keydownEvent = createKeyboardEvent('v', 'keydown', { metaKey: true });
      handleCustomKeyEvent(keydownEvent, state, mockWs, clipboardText);

      expect(mockWs.send).toHaveBeenCalledTimes(1);

      // Simulate onData during paste (should be blocked)
      handleOnData(clipboardText, state, mockWs);
      expect(mockWs.send).toHaveBeenCalledTimes(1);

      // Clear the paste flag (simulates setTimeout callback)
      state.isPasting = false;

      // Now onData should work again
      handleOnData('new typing', state, mockWs);
      expect(mockWs.send).toHaveBeenCalledTimes(2);
    });
  });

  describe('Double paste prevention (the actual bug)', () => {
    it('should send clipboard text exactly once even if onData fires simultaneously', () => {
      const clipboardText = 'Hello World';

      // Step 1: User presses Cmd+V (keydown)
      const keydownEvent = createKeyboardEvent('v', 'keydown', { metaKey: true });
      handleCustomKeyEvent(keydownEvent, state, mockWs, clipboardText);

      // Step 2: xterm.js fires onData with the same pasted text
      // (This was causing the double paste bug)
      handleOnData(clipboardText, state, mockWs);

      // Should only have sent once
      expect(mockWs.send).toHaveBeenCalledTimes(1);
      expect(mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'input', data: clipboardText })
      );
    });

    it('should handle multiple rapid pastes correctly', () => {
      // First paste
      const keydown1 = createKeyboardEvent('v', 'keydown', { metaKey: true });
      handleCustomKeyEvent(keydown1, state, mockWs, 'text1');
      handleOnData('text1', state, mockWs); // Duplicate attempt blocked

      expect(mockWs.send).toHaveBeenCalledTimes(1);

      // Clear flag
      state.isPasting = false;

      // Second paste
      const keydown2 = createKeyboardEvent('v', 'keydown', { metaKey: true });
      handleCustomKeyEvent(keydown2, state, mockWs, 'text2');
      handleOnData('text2', state, mockWs); // Duplicate attempt blocked

      expect(mockWs.send).toHaveBeenCalledTimes(2);
      expect(mockWs.send).toHaveBeenNthCalledWith(
        1,
        JSON.stringify({ type: 'input', data: 'text1' })
      );
      expect(mockWs.send).toHaveBeenNthCalledWith(
        2,
        JSON.stringify({ type: 'input', data: 'text2' })
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle paste when WebSocket is not open', () => {
      mockWs.readyState = 0; // CONNECTING

      const keydownEvent = createKeyboardEvent('v', 'keydown', { metaKey: true });
      handleCustomKeyEvent(keydownEvent, state, mockWs, 'text');

      // isPasting should still be set, but no send
      expect(state.isPasting).toBe(true);
      expect(mockWs.send).not.toHaveBeenCalled();
    });

    it('should handle paste when WebSocket is null', () => {
      const keydownEvent = createKeyboardEvent('v', 'keydown', { metaKey: true });
      handleCustomKeyEvent(keydownEvent, state, null, 'text');

      expect(state.isPasting).toBe(true);
    });

    it('should not trigger on other key combinations', () => {
      // Cmd+C (copy, not paste)
      const cmdC = createKeyboardEvent('c', 'keydown', { metaKey: true });
      expect(handleCustomKeyEvent(cmdC, state, mockWs, '')).toBe(false);

      // Plain V (no modifier)
      const plainV = createKeyboardEvent('v', 'keydown', {});
      expect(handleCustomKeyEvent(plainV, state, mockWs, '')).toBe(false);

      // Alt+V (option key)
      const altV = new KeyboardEvent('keydown', { key: 'v', altKey: true });
      expect(handleCustomKeyEvent(altV, state, mockWs, '')).toBe(false);

      expect(mockWs.send).not.toHaveBeenCalled();
    });
  });
});
