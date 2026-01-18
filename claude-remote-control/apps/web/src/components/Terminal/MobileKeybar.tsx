'use client';

import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CornerDownLeft,
  Copy,
  ClipboardPaste,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ANSI escape sequences for arrow keys
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

interface MobileKeybarProps {
  onKeyPress: (key: string) => void;
  /** Controls visibility with slide animation */
  visible?: boolean;
  /** Callback when copy button is pressed */
  onCopy?: () => void;
  /** Callback when paste button is pressed */
  onPaste?: () => void;
  /** Whether there's currently a text selection (enables copy button) */
  hasSelection?: boolean;
}

interface KeyButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  label?: string;
  className?: string;
  disabled?: boolean;
}

function KeyButton({ onClick, children, label, className, disabled }: KeyButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex min-h-[44px] min-w-[44px] touch-manipulation items-center justify-center',
        'rounded-lg bg-white/5 text-white/70 transition-all',
        'active:scale-95 active:bg-white/10 active:text-white',
        'hover:bg-white/8',
        disabled && 'cursor-not-allowed opacity-40 active:scale-100 active:bg-white/5',
        className
      )}
      title={label}
      aria-label={label}
    >
      {children}
    </button>
  );
}

export function MobileKeybar({
  onKeyPress,
  visible = true,
  onCopy,
  onPaste,
  hasSelection = false,
}: MobileKeybarProps) {
  // When hidden, completely remove from layout (h-0 + overflow-hidden)
  // This allows the terminal to expand and fill the space
  if (!visible) {
    return null;
  }

  // Handle paste from clipboard
  const handlePaste = async () => {
    if (onPaste) {
      onPaste();
    } else {
      // Default behavior: read from clipboard and send to terminal
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          onKeyPress(text);
        }
      } catch {
        // Clipboard access denied - silently fail
      }
    }
  };

  return (
    <div
      className={cn(
        'flex flex-col gap-1.5 border-t border-white/5 bg-[#0d0d14]/95 px-2 py-2 backdrop-blur-sm'
      )}
    >
      {/* Row 1: Copy/Paste Actions */}
      <div className="flex items-center justify-between gap-1 border-b border-white/5 pb-1.5">
        <KeyButton
          onClick={onCopy ?? (() => {})}
          disabled={!hasSelection || !onCopy}
          label="Copy Selection"
          className="gap-1.5 px-3"
        >
          <Copy className="h-4 w-4" />
          <span className="text-xs font-medium">Copy</span>
        </KeyButton>
        <KeyButton onClick={handlePaste} label="Paste from Clipboard" className="gap-1.5 px-3">
          <ClipboardPaste className="h-4 w-4" />
          <span className="text-xs font-medium">Paste</span>
        </KeyButton>
      </div>

      {/* Row 2: Arrow Navigation */}
      <div className="flex items-center justify-end gap-1">
        <KeyButton onClick={() => onKeyPress(KEYS.LEFT)} label="Left Arrow">
          <ChevronLeft className="h-5 w-5" />
        </KeyButton>
        <KeyButton onClick={() => onKeyPress(KEYS.UP)} label="Up Arrow">
          <ChevronUp className="h-5 w-5" />
        </KeyButton>
        <KeyButton onClick={() => onKeyPress(KEYS.DOWN)} label="Down Arrow">
          <ChevronDown className="h-5 w-5" />
        </KeyButton>
        <KeyButton onClick={() => onKeyPress(KEYS.RIGHT)} label="Right Arrow">
          <ChevronRight className="h-5 w-5" />
        </KeyButton>
      </div>

      {/* Row 3: Action keys */}
      <div className="flex items-center justify-between gap-1">
        <div className="flex gap-1">
          <KeyButton onClick={() => onKeyPress(KEYS.ESC)} label="Escape" className="px-3">
            <span className="text-xs font-medium">Esc</span>
          </KeyButton>
          <KeyButton onClick={() => onKeyPress(KEYS.SHIFT_TAB)} label="Shift+Tab" className="px-2">
            <span className="text-xs font-medium">⇧Tab</span>
          </KeyButton>
        </div>

        <div className="flex gap-1">
          <KeyButton
            onClick={() => onKeyPress(KEYS.ENTER)}
            label="Enter"
            className="bg-orange-500/20 px-4 text-orange-400 hover:bg-orange-500/30 active:bg-orange-500/40"
          >
            <CornerDownLeft className="h-5 w-5" />
          </KeyButton>
          <KeyButton
            onClick={() => onKeyPress(KEYS.CTRL_C)}
            label="Ctrl+C (Interrupt)"
            className="px-3 text-red-400/70 hover:text-red-400 active:text-red-300"
          >
            <span className="text-xs font-medium">^C</span>
          </KeyButton>
        </div>
      </div>
    </div>
  );
}
