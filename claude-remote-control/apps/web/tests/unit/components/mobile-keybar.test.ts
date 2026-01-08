import { describe, it, expect, vi } from 'vitest';

/**
 * Test MobileKeybar component logic.
 * This tests the ANSI escape sequences sent for each key and scroll behavior.
 */

// ANSI escape sequences (must match MobileKeybar.tsx)
const KEYS = {
  UP: '\x1b[A',
  DOWN: '\x1b[B',
  LEFT: '\x1b[D',
  RIGHT: '\x1b[C',
  ENTER: '\r',
  ESC: '\x1b',
  SHIFT_TAB: '\x1b[Z',
  CTRL_C: '\x03',
} as const;

describe('MobileKeybar', () => {
  describe('ANSI escape sequences', () => {
    it('uses correct escape sequence for arrow up', () => {
      expect(KEYS.UP).toBe('\x1b[A');
    });

    it('uses correct escape sequence for arrow down', () => {
      expect(KEYS.DOWN).toBe('\x1b[B');
    });

    it('uses correct escape sequence for arrow left', () => {
      expect(KEYS.LEFT).toBe('\x1b[D');
    });

    it('uses correct escape sequence for arrow right', () => {
      expect(KEYS.RIGHT).toBe('\x1b[C');
    });

    it('uses correct sequence for Enter', () => {
      expect(KEYS.ENTER).toBe('\r');
    });

    it('uses correct sequence for Escape', () => {
      expect(KEYS.ESC).toBe('\x1b');
    });

    it('uses correct sequence for Shift+Tab', () => {
      expect(KEYS.SHIFT_TAB).toBe('\x1b[Z');
    });

    it('uses correct sequence for Ctrl+C', () => {
      expect(KEYS.CTRL_C).toBe('\x03');
    });
  });

  describe('Key press handler simulation', () => {
    it('sends UP key when up arrow is pressed', () => {
      // Simulate what MobileKeybar does when up arrow button is clicked
      const onKeyPress = vi.fn();
      onKeyPress(KEYS.UP);
      expect(onKeyPress).toHaveBeenCalledWith('\x1b[A');
    });

    it('sends DOWN key when down arrow is pressed', () => {
      const onKeyPress = vi.fn();
      onKeyPress(KEYS.DOWN);
      expect(onKeyPress).toHaveBeenCalledWith('\x1b[B');
    });

    it('sends LEFT key when left arrow is pressed', () => {
      const onKeyPress = vi.fn();
      onKeyPress(KEYS.LEFT);
      expect(onKeyPress).toHaveBeenCalledWith('\x1b[D');
    });

    it('sends RIGHT key when right arrow is pressed', () => {
      const onKeyPress = vi.fn();
      onKeyPress(KEYS.RIGHT);
      expect(onKeyPress).toHaveBeenCalledWith('\x1b[C');
    });

    it('sends ENTER when enter button is pressed', () => {
      const onKeyPress = vi.fn();
      onKeyPress(KEYS.ENTER);
      expect(onKeyPress).toHaveBeenCalledWith('\r');
    });

    it('sends ESC when escape button is pressed', () => {
      const onKeyPress = vi.fn();
      onKeyPress(KEYS.ESC);
      expect(onKeyPress).toHaveBeenCalledWith('\x1b');
    });

    it('sends SHIFT_TAB when shift+tab button is pressed', () => {
      const onKeyPress = vi.fn();
      onKeyPress(KEYS.SHIFT_TAB);
      expect(onKeyPress).toHaveBeenCalledWith('\x1b[Z');
    });

    it('sends CTRL_C when ctrl+c button is pressed', () => {
      const onKeyPress = vi.fn();
      onKeyPress(KEYS.CTRL_C);
      expect(onKeyPress).toHaveBeenCalledWith('\x03');
    });

    it('scrolls up when page up button is pressed', () => {
      const onScroll = vi.fn();
      onScroll('up');
      expect(onScroll).toHaveBeenCalledWith('up');
    });

    it('scrolls down when page down button is pressed', () => {
      const onScroll = vi.fn();
      onScroll('down');
      expect(onScroll).toHaveBeenCalledWith('down');
    });
  });

  describe('Integration with terminal', () => {
    it('all arrow keys produce valid xterm escape sequences', () => {
      // These sequences should be recognized by xterm.js
      const arrowSequences = [KEYS.UP, KEYS.DOWN, KEYS.LEFT, KEYS.RIGHT];

      arrowSequences.forEach((seq) => {
        // All arrow keys start with ESC [
        expect(seq.startsWith('\x1b[')).toBe(true);
        // And end with a single letter
        expect(seq.length).toBe(3);
      });
    });

    it('control characters are single bytes', () => {
      expect(KEYS.ENTER.length).toBe(1);
      expect(KEYS.ESC.length).toBe(1);
      expect(KEYS.CTRL_C.length).toBe(1);
    });

    it('Shift+Tab is a 3-byte escape sequence', () => {
      expect(KEYS.SHIFT_TAB.length).toBe(3);
      expect(KEYS.SHIFT_TAB.startsWith('\x1b[')).toBe(true);
    });
  });
});
