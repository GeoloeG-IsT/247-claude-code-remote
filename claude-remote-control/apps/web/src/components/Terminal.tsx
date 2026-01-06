'use client';

import { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

interface TerminalProps {
  agentUrl: string;
  project: string;
  sessionName?: string;
}

export function Terminal({ agentUrl, project, sessionName }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Initialize xterm.js
    const term = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1a1a2e',
        foreground: '#eee',
        cursor: '#f97316',
        selectionBackground: '#44475a',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());

    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Connect WebSocket to agent
    // Use ws:// for localhost, wss:// for remote
    const wsProtocol = agentUrl.includes('localhost') ? 'ws' : 'wss';
    const wsUrl = `${wsProtocol}://${agentUrl}/terminal?project=${encodeURIComponent(project)}&session=${encodeURIComponent(sessionName || '')}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      term.write('\r\n\x1b[32mConnected to ' + agentUrl + '\x1b[0m\r\n\r\n');

      // Send initial size
      ws.send(
        JSON.stringify({
          type: 'resize',
          cols: term.cols,
          rows: term.rows,
        })
      );
    };

    ws.onmessage = (event) => {
      // Check if it's a JSON message or raw terminal data
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'pong') return;
      } catch {
        // Raw terminal output
        term.write(event.data);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      term.write('\r\n\x1b[31mDisconnected\x1b[0m\r\n');
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
      term.write('\r\n\x1b[31mConnection error\x1b[0m\r\n');
    };

    // Send input to agent
    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }));
      }
    });

    // Handle resize
    const handleResize = () => {
      fitAddon.fit();
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: 'resize',
            cols: term.cols,
            rows: term.rows,
          })
        );
      }
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      ws.close();
      term.dispose();
    };
  }, [agentUrl, project, sessionName]);

  const startClaude = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'start-claude' }));
    }
  };

  return (
    <div className="flex flex-col flex-1">
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
      </div>
      <div ref={terminalRef} className="flex-1 bg-[#1a1a2e]" />
    </div>
  );
}
