'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import { WebglAddon } from '@xterm/addon-webgl';
import { CanvasAddon } from '@xterm/addon-canvas';
import '@xterm/xterm/css/xterm.css';
import { Search, ChevronUp, ChevronDown, X, ArrowDown } from 'lucide-react';

interface TerminalProps {
  agentUrl: string;
  project: string;
  sessionName?: string;
}

// Generate human-readable session names with project prefix (same as agent)
function generateSessionName(project: string): string {
  const adjectives = ['brave', 'swift', 'calm', 'bold', 'wise', 'keen', 'fair', 'wild', 'bright', 'cool'];
  const nouns = ['lion', 'hawk', 'wolf', 'bear', 'fox', 'owl', 'deer', 'lynx', 'eagle', 'tiger'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 100);
  return `${project}--${adj}-${noun}-${num}`;
}

export function Terminal({ agentUrl, project, sessionName }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [connected, setConnected] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const wsRef = useRef<WebSocket | null>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const webglAddonRef = useRef<WebglAddon | null>(null);

  // Generate session name ONCE on first render, persisted across re-mounts
  const generatedSessionRef = useRef<string | null>(null);
  if (!sessionName && !generatedSessionRef.current) {
    generatedSessionRef.current = generateSessionName(project);
  }
  const effectiveSessionName = sessionName || generatedSessionRef.current || '';

  // Scroll to bottom handler
  const scrollToBottom = useCallback(() => {
    if (xtermRef.current) {
      xtermRef.current.scrollToBottom();
    }
  }, []);

  // Focus terminal to enable native scroll handling
  const focusTerminal = useCallback(() => {
    xtermRef.current?.focus();
  }, []);

  // Search handlers
  const findNext = useCallback(() => {
    if (searchAddonRef.current && searchQuery) {
      searchAddonRef.current.findNext(searchQuery, {
        regex: false,
        caseSensitive: false,
        incremental: true,
      });
    }
  }, [searchQuery]);

  const findPrevious = useCallback(() => {
    if (searchAddonRef.current && searchQuery) {
      searchAddonRef.current.findPrevious(searchQuery, {
        regex: false,
        caseSensitive: false,
      });
    }
  }, [searchQuery]);

  const closeSearch = useCallback(() => {
    setSearchVisible(false);
    setSearchQuery('');
    if (searchAddonRef.current) {
      searchAddonRef.current.clearDecorations();
    }
    xtermRef.current?.focus();
  }, []);

  // Keyboard shortcuts handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Shift + F = Open search
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'f') {
        e.preventDefault();
        setSearchVisible(true);
        setTimeout(() => searchInputRef.current?.focus(), 0);
      }
      // Escape = Close search
      if (e.key === 'Escape' && searchVisible) {
        closeSearch();
      }
      // Enter in search = Find next
      if (
        e.key === 'Enter' &&
        searchVisible &&
        document.activeElement === searchInputRef.current
      ) {
        e.preventDefault();
        if (e.shiftKey) {
          findPrevious();
        } else {
          findNext();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchVisible, findNext, findPrevious, closeSearch]);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Track cleanup state and resources
    let cancelled = false;
    let term: XTerm | null = null;
    let ws: WebSocket | null = null;
    let handleResize: (() => void) | null = null;

    // Debounce connection to avoid React Strict Mode double-mount issues
    const connectTimeout = setTimeout(() => {
      if (cancelled || !terminalRef.current) return;

      // Initialize xterm.js with enhanced options
      term = new XTerm({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        scrollback: 15000,
        scrollSensitivity: 1,
        fastScrollSensitivity: 5,
        fastScrollModifier: 'alt',
        smoothScrollDuration: 100,
        theme: {
          background: '#1a1a2e',
          foreground: '#eee',
          cursor: '#f97316',
          selectionBackground: '#44475a',
        },
      });

      // Load addons
      const fitAddon = new FitAddon();
      const searchAddon = new SearchAddon();

      term.loadAddon(fitAddon);
      term.loadAddon(new WebLinksAddon());
      term.loadAddon(searchAddon);

      term.open(terminalRef.current);

      // Try WebGL renderer, fall back to Canvas
      try {
        const webglAddon = new WebglAddon();
        webglAddon.onContextLoss(() => {
          webglAddon.dispose();
          webglAddonRef.current = null;
          if (term) term.loadAddon(new CanvasAddon());
        });
        term.loadAddon(webglAddon);
        webglAddonRef.current = webglAddon;
      } catch {
        console.warn('WebGL not available, using Canvas renderer');
        term.loadAddon(new CanvasAddon());
      }

      fitAddon.fit();

      xtermRef.current = term;
      fitAddonRef.current = fitAddon;
      searchAddonRef.current = searchAddon;

      // Track scroll position
      term.onScroll(() => {
        if (!term) return;
        const buffer = term.buffer.active;
        const isBottom = buffer.viewportY >= buffer.baseY;
        setIsAtBottom(isBottom);
      });

      // Connect WebSocket
      const wsProtocol = agentUrl.includes('localhost') ? 'ws' : 'wss';
      const wsUrl = `${wsProtocol}://${agentUrl}/terminal?project=${encodeURIComponent(project)}&session=${encodeURIComponent(effectiveSessionName)}`;
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      const currentTerm = term;
      const currentWs = ws;

      currentWs.onopen = () => {
        if (cancelled) return;
        setConnected(true);
        currentTerm.write('\r\n\x1b[32mConnected to ' + agentUrl + '\x1b[0m\r\n\r\n');

        currentWs.send(
          JSON.stringify({
            type: 'resize',
            cols: currentTerm.cols,
            rows: currentTerm.rows,
          })
        );
      };

      currentWs.onmessage = (event) => {
        if (cancelled) return;
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'pong') return;
          if (msg.type === 'history') {
            currentTerm.write(msg.data);
            currentTerm.scrollToBottom();
            return;
          }
        } catch {
          currentTerm.write(event.data);
        }
      };

      currentWs.onclose = () => {
        if (cancelled) return;
        setConnected(false);
        currentTerm.write('\r\n\x1b[31mDisconnected\x1b[0m\r\n');
      };

      currentWs.onerror = (err) => {
        if (cancelled) return;
        console.error('WebSocket error:', err);
        currentTerm.write('\r\n\x1b[31mConnection error\x1b[0m\r\n');
      };

      currentTerm.onData((data) => {
        if (currentWs.readyState === WebSocket.OPEN) {
          currentWs.send(JSON.stringify({ type: 'input', data }));
        }
      });

      handleResize = () => {
        fitAddon.fit();
        if (currentWs.readyState === WebSocket.OPEN) {
          currentWs.send(
            JSON.stringify({
              type: 'resize',
              cols: currentTerm.cols,
              rows: currentTerm.rows,
            })
          );
        }
      };

      window.addEventListener('resize', handleResize);
    }, 150); // 150ms debounce to let React Strict Mode cleanup complete

    // Cleanup
    return () => {
      cancelled = true;
      clearTimeout(connectTimeout);

      if (handleResize) {
        window.removeEventListener('resize', handleResize);
      }
      if (ws) {
        ws.close();
      }
      if (webglAddonRef.current) {
        try {
          webglAddonRef.current.dispose();
        } catch {
          // Ignore disposal errors
        }
        webglAddonRef.current = null;
      }
      if (term) {
        term.dispose();
      }
    };
  }, [agentUrl, project, effectiveSessionName]);

  // Search effect
  useEffect(() => {
    if (searchQuery && searchAddonRef.current) {
      findNext();
    }
  }, [searchQuery, findNext]);

  const startClaude = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'start-claude' }));
    }
  };

  return (
    <div className="flex flex-col flex-1 relative">
      {/* Toolbar */}
      <div className="flex items-center gap-4 p-2 bg-gray-800 border-b border-gray-700">
        <span
          className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}
        />
        <span className="text-sm text-gray-300">{project}</span>
        <button
          onClick={startClaude}
          disabled={!connected}
          className="px-3 py-1 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 text-white rounded text-sm transition"
        >
          Start Claude
        </button>

        <div className="flex-1" />

        {/* Search button */}
        <button
          onClick={() => {
            setSearchVisible(!searchVisible);
            if (!searchVisible) {
              setTimeout(() => searchInputRef.current?.focus(), 0);
            }
          }}
          className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition"
          title="Search (Ctrl+Shift+F)"
        >
          <Search className="w-4 h-4" />
        </button>
      </div>

      {/* Search bar */}
      {searchVisible && (
        <div className="flex items-center gap-2 p-2 bg-gray-800 border-b border-gray-700">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="flex-1 bg-gray-700 text-white px-2 py-1 rounded text-sm border border-gray-600 focus:border-orange-500 focus:outline-none"
          />
          <button
            onClick={findPrevious}
            className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
            title="Previous (Shift+Enter)"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            onClick={findNext}
            className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
            title="Next (Enter)"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <button
            onClick={closeSearch}
            className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Terminal */}
      <div
        ref={terminalRef}
        className="flex-1 bg-[#1a1a2e]"
        onClick={focusTerminal}
        onMouseEnter={focusTerminal}
      />

      {/* Scroll to bottom indicator */}
      {!isAtBottom && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 right-4 p-2 bg-orange-500 hover:bg-orange-600 text-white rounded-full shadow-lg transition-all animate-bounce"
          title="Scroll to bottom"
        >
          <ArrowDown className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
