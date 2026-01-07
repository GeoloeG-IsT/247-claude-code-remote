import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Test paste handling logic in Terminal component.
 *
 * The Terminal uses a paste event listener that:
 * 1. Detects if clipboard contains an image - if so, lets default behavior handle it
 * 2. For text-only paste, sends via WebSocket and prevents default
 * 3. Uses isPastingRef flag to prevent onData from double-sending during paste
 */

// Helper to create a mock ClipboardEvent
const createPasteEvent = (
  items: Array<{ type: string; data?: string }>,
  textData?: string
): ClipboardEvent => {
  const dataTransferItems = items.map((item) => ({
    type: item.type,
    kind: item.type.startsWith('image/') ? 'file' : 'string',
    getAsString: vi.fn(),
    getAsFile: vi.fn(),
  }));

  const clipboardData = {
    items: dataTransferItems,
    getData: vi.fn((type: string) => (type === 'text' ? (textData ?? '') : '')),
    setData: vi.fn(),
    clearData: vi.fn(),
    types: items.map((i) => i.type),
  };

  const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent;
  Object.defineProperty(event, 'clipboardData', {
    value: clipboardData,
    writable: false,
  });

  return event;
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
 * Simulates the paste event handler logic from Terminal.tsx
 * Returns true if the event was handled (preventDefault called)
 */
const handlePasteEvent = (
  event: ClipboardEvent,
  state: PasteHandlerState,
  ws: MockWebSocket | null
): boolean => {
  const clipboardData = event.clipboardData;
  if (!clipboardData) return false;

  // Check if clipboard contains an image
  const hasImage = Array.from(clipboardData.items).some((item) => item.type.startsWith('image/'));

  if (hasImage) {
    // Let default behavior handle images (Claude Code can process them)
    return false;
  }

  // Text paste - send via WebSocket and prevent default
  const text = clipboardData.getData('text');
  if (text && ws && ws.readyState === WEBSOCKET_OPEN) {
    state.isPasting = true;
    ws.send(JSON.stringify({ type: 'input', data: text }));
    return true; // Event was handled
  }

  return false;
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

  describe('Text paste handling', () => {
    it('should send text via WebSocket on paste', () => {
      const pasteEvent = createPasteEvent([{ type: 'text/plain' }], 'pasted text');

      const handled = handlePasteEvent(pasteEvent, state, mockWs);

      expect(handled).toBe(true);
      expect(state.isPasting).toBe(true);
      expect(mockWs.send).toHaveBeenCalledTimes(1);
      expect(mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'input', data: 'pasted text' })
      );
    });

    it('should not handle empty text paste', () => {
      const pasteEvent = createPasteEvent([{ type: 'text/plain' }], '');

      const handled = handlePasteEvent(pasteEvent, state, mockWs);

      expect(handled).toBe(false);
      expect(state.isPasting).toBe(false);
      expect(mockWs.send).not.toHaveBeenCalled();
    });
  });

  describe('Image paste handling', () => {
    it('should let default behavior handle image paste', () => {
      const pasteEvent = createPasteEvent([{ type: 'image/png' }]);

      const handled = handlePasteEvent(pasteEvent, state, mockWs);

      expect(handled).toBe(false); // Should not prevent default
      expect(state.isPasting).toBe(false);
      expect(mockWs.send).not.toHaveBeenCalled();
    });

    it('should let default behavior handle mixed text+image paste', () => {
      // When both text and image are present, let default handle it
      // (image takes precedence)
      const pasteEvent = createPasteEvent(
        [{ type: 'text/plain' }, { type: 'image/png' }],
        'some text'
      );

      const handled = handlePasteEvent(pasteEvent, state, mockWs);

      expect(handled).toBe(false); // Should not prevent default
      expect(state.isPasting).toBe(false);
      expect(mockWs.send).not.toHaveBeenCalled();
    });

    it('should handle various image types', () => {
      const imageTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

      for (const imageType of imageTypes) {
        state = { isPasting: false };
        const pasteEvent = createPasteEvent([{ type: imageType }]);

        const handled = handlePasteEvent(pasteEvent, state, mockWs);

        expect(handled).toBe(false);
      }
    });
  });

  describe('onData handler during paste', () => {
    it('should skip onData events while isPasting is true', () => {
      const pasteText = 'pasted text';

      // First, trigger paste (sets isPasting = true)
      const pasteEvent = createPasteEvent([{ type: 'text/plain' }], pasteText);
      handlePasteEvent(pasteEvent, state, mockWs);

      expect(mockWs.send).toHaveBeenCalledTimes(1);

      // Now simulate xterm.js firing onData with the same text
      handleOnData(pasteText, state, mockWs);

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
      const pasteText = 'pasted text';

      // Trigger paste
      const pasteEvent = createPasteEvent([{ type: 'text/plain' }], pasteText);
      handlePasteEvent(pasteEvent, state, mockWs);

      expect(mockWs.send).toHaveBeenCalledTimes(1);

      // Simulate onData during paste (should be blocked)
      handleOnData(pasteText, state, mockWs);
      expect(mockWs.send).toHaveBeenCalledTimes(1);

      // Clear the paste flag (simulates setTimeout callback)
      state.isPasting = false;

      // Now onData should work again
      handleOnData('new typing', state, mockWs);
      expect(mockWs.send).toHaveBeenCalledTimes(2);
    });
  });

  describe('Double paste prevention (the actual bug)', () => {
    it('should send text exactly once even if onData fires simultaneously', () => {
      const pasteText = 'Hello World';

      // Step 1: User pastes text
      const pasteEvent = createPasteEvent([{ type: 'text/plain' }], pasteText);
      handlePasteEvent(pasteEvent, state, mockWs);

      // Step 2: xterm.js fires onData with the same pasted text
      // (This was causing the double paste bug)
      handleOnData(pasteText, state, mockWs);

      // Should only have sent once
      expect(mockWs.send).toHaveBeenCalledTimes(1);
      expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify({ type: 'input', data: pasteText }));
    });

    it('should handle multiple rapid pastes correctly', () => {
      // First paste
      const paste1 = createPasteEvent([{ type: 'text/plain' }], 'text1');
      handlePasteEvent(paste1, state, mockWs);
      handleOnData('text1', state, mockWs); // Duplicate attempt blocked

      expect(mockWs.send).toHaveBeenCalledTimes(1);

      // Clear flag
      state.isPasting = false;

      // Second paste
      const paste2 = createPasteEvent([{ type: 'text/plain' }], 'text2');
      handlePasteEvent(paste2, state, mockWs);
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

      const pasteEvent = createPasteEvent([{ type: 'text/plain' }], 'text');
      const handled = handlePasteEvent(pasteEvent, state, mockWs);

      // Should not handle when WS not open
      expect(handled).toBe(false);
      expect(mockWs.send).not.toHaveBeenCalled();
    });

    it('should handle paste when WebSocket is null', () => {
      const pasteEvent = createPasteEvent([{ type: 'text/plain' }], 'text');
      const handled = handlePasteEvent(pasteEvent, state, null);

      expect(handled).toBe(false);
    });

    it('should handle paste when clipboardData is null', () => {
      const event = new Event('paste', { bubbles: true }) as ClipboardEvent;
      Object.defineProperty(event, 'clipboardData', {
        value: null,
        writable: false,
      });

      const handled = handlePasteEvent(event, state, mockWs);

      expect(handled).toBe(false);
      expect(mockWs.send).not.toHaveBeenCalled();
    });

    it('should handle HTML text paste (text/html)', () => {
      const pasteEvent = createPasteEvent([{ type: 'text/html' }], '<p>formatted</p>');

      const handled = handlePasteEvent(pasteEvent, state, mockWs);

      // getData('text') returns the text data
      expect(handled).toBe(true);
    });
  });
});
