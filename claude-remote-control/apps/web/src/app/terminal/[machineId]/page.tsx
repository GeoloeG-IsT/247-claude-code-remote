'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Terminal } from '@/components/Terminal';

interface Machine {
  id: string;
  name: string;
  status: string;
  config?: {
    projects: string[];
    agentUrl?: string;
  };
}

export default function TerminalPage() {
  const params = useParams();
  const machineId = params.machineId as string;

  const [machine, setMachine] = useState<Machine | null>(null);
  const [projects, setProjects] = useState<string[]>([]);
  const [sessions, setSessions] = useState<string[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedSession, setSelectedSession] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Default to localhost for v0 testing
  const agentUrl = machine?.config?.agentUrl || 'localhost:4678';

  useEffect(() => {
    fetch(`/api/machines/${machineId}`)
      .then((r) => r.json())
      .then(setMachine)
      .finally(() => setLoading(false));
  }, [machineId]);

  useEffect(() => {
    if (!machine) return;

    const url = machine.config?.agentUrl || 'localhost:4678';
    const protocol = url.includes('localhost') ? 'http' : 'https';

    // Fetch projects from agent
    fetch(`${protocol}://${url}/api/projects`)
      .then((r) => r.json())
      .then((p: string[]) => {
        setProjects(p);
        if (p.length > 0) setSelectedProject(p[0]);
      })
      .catch(console.error);

    // Fetch active tmux sessions
    fetch(`${protocol}://${url}/api/sessions`)
      .then((r) => r.json())
      .then((s: string[]) => setSessions(s))
      .catch(() => setSessions([]));
  }, [machine]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  if (!machine) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-red-400">Machine not found</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      <header className="p-4 bg-gray-800 flex items-center gap-4 border-b border-gray-700">
        <a href="/" className="text-gray-400 hover:text-white">
          &larr; Back
        </a>
        <h1 className="text-xl font-bold">{machine.name}</h1>

        <select
          value={selectedProject}
          onChange={(e) => {
            setSelectedProject(e.target.value);
            setSelectedSession(''); // Reset session when changing project
          }}
          className="bg-gray-700 text-white px-3 py-1 rounded border border-gray-600"
        >
          {projects.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        {sessions.length > 0 && (
          <>
            <span className="text-gray-500">|</span>
            <select
              value={selectedSession}
              onChange={(e) => setSelectedSession(e.target.value)}
              className="bg-gray-700 text-white px-3 py-1 rounded border border-gray-600"
            >
              <option value="">New session</option>
              {sessions.map((s) => (
                <option key={s} value={s}>
                  Reconnect: {s}
                </option>
              ))}
            </select>
          </>
        )}
      </header>

      {selectedProject && (
        <Terminal
          agentUrl={agentUrl}
          project={selectedProject}
          sessionName={selectedSession || `${selectedProject}-${Date.now()}`}
        />
      )}
    </div>
  );
}
