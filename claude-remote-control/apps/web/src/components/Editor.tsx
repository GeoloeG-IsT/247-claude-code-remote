'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { cn, buildApiUrl } from '@/lib/utils';
import type { EditorStatus } from '@vibecompany/247-shared';

interface EditorProps {
  agentUrl: string;
  project: string;
  onStatusChange?: (status: EditorStatus) => void;
}

export function Editor({ agentUrl, project, onStatusChange }: EditorProps) {
  const [status, setStatus] = useState<EditorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  // Debug: log what project the Editor component received
  console.log('[Editor] mounted/rendered with project:', project, 'status:', status);

  // Build editor URL - direct access to code-server port when available
  const buildEditorUrl = useCallback(() => {
    // If we have the port from status, access code-server directly (works in local dev)
    if (status?.port && agentUrl.includes('localhost')) {
      return `http://127.0.0.1:${status.port}/`;
    }
    // Fallback to proxy (for remote access via tunnel)
    return buildApiUrl(agentUrl, `/editor/${encodeURIComponent(project)}/`);
  }, [agentUrl, project, status?.port]);

  // Fetch editor status
  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(
        buildApiUrl(agentUrl, `/api/editor/${encodeURIComponent(project)}/status`)
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch editor status: ${response.statusText}`);
      }

      const data: EditorStatus = await response.json();
      setStatus(data);
      onStatusChange?.(data);
      setError(null);
      return data;
    } catch (err) {
      setError((err as Error).message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [agentUrl, project, onStatusChange]);

  // Start editor
  const startEditor = useCallback(async () => {
    setStarting(true);
    setError(null);

    try {
      const response = await fetch(
        buildApiUrl(agentUrl, `/api/editor/${encodeURIComponent(project)}/start`),
        { method: 'POST' }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start editor');
      }

      // Wait a bit for code-server to be ready
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Fetch updated status
      await fetchStatus();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setStarting(false);
    }
  }, [agentUrl, project, fetchStatus]);

  // Initial status fetch
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Auto-start editor if not running
  useEffect(() => {
    if (!loading && status && !status.running && !starting && !error) {
      startEditor();
    }
  }, [loading, status, starting, error, startEditor]);

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-[#0a0a10]">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        <span className="text-sm text-white/60">Checking editor status...</span>
      </div>
    );
  }

  // Starting state
  if (starting || (status && !status.running)) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-[#0a0a10]">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        <span className="text-sm text-white/60">Starting VS Code...</span>
        <span className="text-xs text-white/40">This may take a few seconds</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-[#0a0a10] p-8">
        <div className="flex items-center gap-2 text-red-400">
          <AlertCircle className="h-6 w-6" />
          <span className="font-medium">Failed to load editor</span>
        </div>
        <p className="max-w-md text-center text-sm text-white/40">{error}</p>
        <button
          onClick={() => {
            setError(null);
            setLoading(true);
            fetchStatus();
          }}
          className={cn(
            'flex items-center gap-2 rounded-lg px-4 py-2',
            'bg-white/10 text-white/80 hover:bg-white/15 hover:text-white',
            'transition-colors'
          )}
        >
          <RefreshCw className="h-4 w-4" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  // Editor iframe
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Toolbar */}
      <div
        className={cn(
          'flex items-center gap-3 px-4 py-2',
          'bg-[#0d0d14]/80 backdrop-blur-sm',
          'border-b border-white/5'
        )}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white/60">{project}</span>
          <span className="text-white/20">/</span>
          <span className="text-sm text-emerald-400">VS Code</span>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2 text-xs text-white/40">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          <span>Running on port {status?.port}</span>
        </div>
      </div>

      {/* VS Code iframe */}
      <iframe
        src={buildEditorUrl()}
        className="w-full flex-1 border-0 bg-[#1e1e1e]"
        title={`VS Code - ${project}`}
        allow="clipboard-read; clipboard-write"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
      />
    </div>
  );
}
