'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Loader2,
  AlertCircle,
  RefreshCw,
  File,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  FileText,
  FileCode,
  Image,
  Archive,
  FileJson,
  FileSpreadsheet,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type GitFileStatus = 'modified' | 'added' | 'deleted' | 'untracked' | 'unchanged' | 'conflicted';

export interface FileNode {
  path: string;
  name: string;
  type: 'file' | 'directory';
  status?: GitFileStatus;
  children?: FileNode[];
  extension?: string;
}

interface ChangesSummary {
  modified: number;
  added: number;
  deleted: number;
  untracked: number;
  conflicted: number;
}

interface FileExplorerProps {
  agentUrl: string;
  project: string;
}

export function FileExplorer({ agentUrl, project }: FileExplorerProps) {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [summary, setSummary] = useState<ChangesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Tree expansion state (path -> expanded boolean)
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  // Selected file for preview
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);

  // Fetch files
  const fetchFiles = useCallback(async () => {
    try {
      const protocol = agentUrl.includes('localhost') ? 'http' : 'https';
      const response = await fetch(
        `${protocol}://${agentUrl}/api/files/${encodeURIComponent(project)}`
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `Failed to fetch files: ${response.statusText}`);
      }

      const data = await response.json();
      setFiles(data.files || []);
      setSummary(data.summary || null);
      setError(null);

      // Auto-expand first level
      if (data.files && data.files.length > 0) {
        const firstLevelPaths = new Set<string>(
          data.files.map((f: FileNode) => f.path).filter(Boolean)
        );
        setExpandedPaths(firstLevelPaths);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [agentUrl, project]);

  // Refresh files
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchFiles();
  }, [fetchFiles]);

  // Fetch file content
  const fetchFileContent = useCallback(
    async (file: FileNode) => {
      if (file.type !== 'file') return;

      setSelectedFile(file);
      setLoadingContent(true);
      setFileContent(null);

      try {
        const protocol = agentUrl.includes('localhost') ? 'http' : 'https';
        const response = await fetch(
          `${protocol}://${agentUrl}/api/files/${encodeURIComponent(project)}/content?path=${encodeURIComponent(file.path)}`
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch file: ${response.statusText}`);
        }

        const data = await response.json();
        setFileContent(data.content);
      } catch (err) {
        setFileContent(`// Error: ${(err as Error).message}`);
      } finally {
        setLoadingContent(false);
      }
    },
    [agentUrl, project]
  );

  // Open file in local editor
  const openInEditor = useCallback(async () => {
    if (!selectedFile) return;

    try {
      const protocol = agentUrl.includes('localhost') ? 'http' : 'https';
      const response = await fetch(
        `${protocol}://${agentUrl}/api/files/${encodeURIComponent(project)}/open`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: selectedFile.path }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to open file');
      }
    } catch (err) {
      console.error('Failed to open file:', err);
    }
  }, [agentUrl, project, selectedFile]);

  // Toggle folder expansion
  const toggleExpand = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  }, []);

  // Get status badge
  const getStatusBadge = useCallback((status?: GitFileStatus) => {
    if (!status || status === 'unchanged') return null;

    const badges = {
      modified: { label: 'M', className: 'text-orange-400 bg-orange-400/10' },
      added: { label: 'A', className: 'text-emerald-400 bg-emerald-400/10' },
      deleted: { label: 'D', className: 'text-red-400 bg-red-400/10' },
      untracked: { label: '?', className: 'text-white/40 bg-white/5' },
      conflicted: { label: 'C', className: 'text-red-500 bg-red-500/10' },
    };

    const badge = badges[status];
    if (!badge) return null;

    return (
      <span className={cn('ml-2 rounded px-1.5 py-0.5 font-mono text-[10px]', badge.className)}>
        {badge.label}
      </span>
    );
  }, []);

  // Get file icon
  const getFileIcon = useCallback((node: FileNode, isExpanded: boolean) => {
    if (node.type === 'directory') {
      return isExpanded ? <FolderOpen className="h-4 w-4" /> : <Folder className="h-4 w-4" />;
    }

    const ext = node.extension;

    // Code files
    if (['ts', 'tsx', 'js', 'jsx', 'c', 'cpp', 'h', 'go', 'rs', 'java', 'py'].includes(ext || '')) {
      return <FileCode className="h-4 w-4" />;
    }

    // Data files
    if (['json', 'yaml', 'yml', 'toml', 'xml', 'csv'].includes(ext || '')) {
      if (ext === 'json') return <FileJson className="h-4 w-4" />;
      if (ext === 'xml') return <FileCode className="h-4 w-4" />;
      if (ext === 'csv') return <FileSpreadsheet className="h-4 w-4" />;
      return <FileCode className="h-4 w-4" />;
    }

    // Images
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(ext || '')) {
      return <Image className="h-4 w-4" />;
    }

    // Archives
    if (['zip', 'tar', 'gz', 'rar', '7z'].includes(ext || '')) {
      return <Archive className="h-4 w-4" />;
    }

    // Config files
    if (['conf', 'config', 'env', 'ini'].includes(ext || '') || node.name.startsWith('.')) {
      return <Settings className="h-4 w-4" />;
    }

    // Default text file
    return <FileText className="h-4 w-4" />;
  }, []);

  // Recursive tree renderer
  const renderTree = useCallback(
    (nodes: FileNode[], depth: number = 0): React.ReactNode => {
      return nodes.map((node) => {
        const isExpanded = expandedPaths.has(node.path);
        const hasChildren = node.children && node.children.length > 0;
        const isSelected = selectedFile?.path === node.path;

        return (
          <div key={node.path}>
            <div
              className={cn(
                'flex cursor-pointer items-center gap-1.5 rounded px-2 py-1',
                'transition-colors hover:bg-white/5',
                isSelected && 'bg-white/10',
                depth > 0 && 'ml-3'
              )}
              style={{ paddingLeft: `${depth * 8 + 8}px` }}
              onClick={() => {
                if (node.type === 'directory') {
                  toggleExpand(node.path);
                } else {
                  fetchFileContent(node);
                }
              }}
            >
              {/* Expand/collapse for directories */}
              {node.type === 'directory' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpand(node.path);
                  }}
                  className="rounded p-0.5 transition-colors hover:bg-white/10"
                >
                  {hasChildren || isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5 text-white/40" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-white/40" />
                  )}
                </button>
              )}

              {/* File/folder icon */}
              <span
                className={cn(
                  'flex-shrink-0',
                  node.status === 'modified' && 'text-orange-400',
                  node.status === 'added' && 'text-emerald-400',
                  node.status === 'deleted' && 'text-red-400',
                  node.status === 'untracked' && 'text-white/40',
                  node.status === 'conflicted' && 'text-red-500',
                  !node.status && 'text-white/60'
                )}
              >
                {getFileIcon(node, isExpanded)}
              </span>

              {/* Name */}
              <span
                className={cn(
                  'flex-1 truncate text-sm',
                  node.status === 'deleted' && 'text-white/30 line-through',
                  isSelected && 'font-medium text-white',
                  !isSelected && 'text-white/70'
                )}
              >
                {node.name}
              </span>

              {/* Status badge */}
              {getStatusBadge(node.status)}
            </div>

            {/* Children (if expanded directory) */}
            {node.type === 'directory' && isExpanded && hasChildren && (
              <div>{renderTree(node.children!, depth + 1)}</div>
            )}
          </div>
        );
      });
    },
    [expandedPaths, selectedFile, toggleExpand, fetchFileContent, getFileIcon, getStatusBadge]
  );

  // Initial load
  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // Calculate total changes
  const totalChanges = summary
    ? summary.modified + summary.added + summary.deleted + summary.untracked + summary.conflicted
    : 0;

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-[#0a0a10]">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        <span className="text-sm text-white/60">Loading files...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-[#0a0a10] p-8">
        <div className="flex items-center gap-2 text-red-400">
          <AlertCircle className="h-6 w-6" />
          <span className="font-medium">Failed to load files</span>
        </div>
        <p className="max-w-md text-center text-sm text-white/40">{error}</p>
        <button
          onClick={handleRefresh}
          className={cn(
            'flex items-center gap-2 rounded-lg px-4 py-2',
            'bg-white/10 text-white/80 hover:bg-white/15 hover:text-white',
            'transition-colors'
          )}
        >
          <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#0a0a10]">
      {/* Toolbar */}
      <div
        className={cn(
          'flex items-center gap-3 px-4 py-2.5',
          'bg-[#0d0d14]/80 backdrop-blur-sm',
          'border-b border-white/5'
        )}
      >
        <div className="flex items-center gap-2">
          <Folder className="h-4 w-4 text-white/40" />
          <span className="text-sm font-medium text-white/90">{project}</span>
        </div>

        <div className="flex-1" />

        {/* Changes summary */}
        {totalChanges > 0 && summary && (
          <div className="flex items-center gap-3 text-xs">
            {summary.modified > 0 && <span className="text-orange-400">M: {summary.modified}</span>}
            {summary.added > 0 && <span className="text-emerald-400">A: {summary.added}</span>}
            {summary.deleted > 0 && <span className="text-red-400">D: {summary.deleted}</span>}
            {summary.untracked > 0 && <span className="text-white/40">?: {summary.untracked}</span>}
            {summary.conflicted > 0 && (
              <span className="text-red-500">C: {summary.conflicted}</span>
            )}
          </div>
        )}

        {/* Refresh button */}
        <button
          onClick={handleRefresh}
          className={cn(
            'rounded-lg p-1.5',
            'text-white/40 hover:bg-white/10 hover:text-white/60',
            'transition-colors'
          )}
          title="Refresh files"
        >
          <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
        </button>
      </div>

      {/* Content area: File tree + Preview */}
      <div className="flex flex-1 overflow-hidden">
        {/* File tree */}
        <div className="min-w-[200px] max-w-[400px] flex-1 overflow-y-auto border-r border-white/5 p-2">
          {files.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-white/30">
              <Folder className="mb-2 h-8 w-8" />
              <span className="text-sm">No files found</span>
            </div>
          ) : (
            renderTree(files)
          )}
        </div>

        {/* Preview panel */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {selectedFile ? (
            <>
              {/* Preview header */}
              <div className="flex items-center justify-between border-b border-white/5 px-4 py-2">
                <div className="flex items-center gap-2">
                  {getFileIcon(selectedFile, false)}
                  <span className="text-sm text-white/70">{selectedFile.name}</span>
                  {getStatusBadge(selectedFile.status)}
                </div>

                <button
                  onClick={openInEditor}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs',
                    'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white',
                    'transition-colors'
                  )}
                  title="Open in local editor"
                >
                  <ExternalLink className="h-3 w-3" />
                  <span>Open</span>
                </button>
              </div>

              {/* Preview content */}
              <div className="flex-1 overflow-auto p-4">
                {loadingContent ? (
                  <div className="flex h-full items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-white/40" />
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap font-mono text-sm text-white/70">
                    {fileContent || '// No content'}
                  </pre>
                )}
              </div>
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-white/30">
              <File className="mb-3 h-12 w-12" />
              <span className="text-sm">Select a file to preview</span>
              {totalChanges > 0 && (
                <span className="mt-1 text-xs text-orange-400">
                  {totalChanges} modified file{totalChanges > 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
