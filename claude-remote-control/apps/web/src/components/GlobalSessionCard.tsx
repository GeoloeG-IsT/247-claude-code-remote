'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock, Monitor, Circle } from 'lucide-react';
import { type SessionWithMachine } from '@/contexts/SessionPollingContext';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/time';

interface GlobalSessionCardProps {
  session: SessionWithMachine;
  onClick: () => void;
}

export function GlobalSessionCard({ session, onClick }: GlobalSessionCardProps) {
  const [, setTick] = useState(0);

  // Update time display every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(interval);
  }, []);

  // Extract readable session name (part after --)
  const displayName = session.name.split('--')[1] || session.name;

  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative w-full rounded-xl p-4 text-left transition-all',
        'border bg-[#12121a]/50 hover:bg-[#12121a]',
        'border-white/5 hover:border-white/10'
      )}
    >
      <div className="flex items-start gap-4">
        {/* Session Icon */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.2 }}
          className={cn(
            'flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl',
            'border border-white/10 bg-white/5'
          )}
        >
          <Circle className="h-6 w-6 text-white/40" />
        </motion.div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Session name */}
          <div className="mb-1 flex items-center gap-2">
            <span className="truncate font-semibold text-white">{displayName}</span>
          </div>

          {/* Project */}
          <div className="mb-2 text-sm text-white/60">{session.project}</div>

          {/* Machine + Created */}
          <div className="flex items-center gap-3 text-xs text-white/40">
            <div className="flex items-center gap-1.5">
              <Monitor className="h-3.5 w-3.5" />
              <span>{session.machineName}</span>
            </div>
            <span className="text-white/20">|</span>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{formatRelativeTime(session.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Arrow indicator on hover */}
        <div
          className="self-center opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden="true"
        >
          <svg
            className="h-5 w-5 text-white/30"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </button>
  );
}
