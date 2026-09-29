import React from 'react';
import { Activity, ShieldAlert, FileText, Sparkles, Mic, Menu } from 'lucide-react';
import { TriageUrgency } from '../types/clinical';

interface HeaderProps {
  activeView: 'intake' | 'handoff';
  setActiveView: (view: 'intake' | 'handoff') => void;
  triageLevel: TriageUrgency;
  extractedSymptomCount: number;
  redFlagCount: number;
  sessionDuration: string;
  hasHandoff: boolean;
  viewingPastSession: boolean;
  onToggleSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeView,
  setActiveView,
  triageLevel,
  extractedSymptomCount,
  redFlagCount,
  sessionDuration,
  hasHandoff,
  viewingPastSession,
  onToggleSidebar,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/[0.08] bg-canvas/80 backdrop-blur-2xl">
      <div className="px-3 sm:px-6 min-h-14 sm:h-16 py-2 sm:py-0 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
          <button
            onClick={onToggleSidebar}
            className="lg:hidden w-9 h-9 shrink-0 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-ink-soft hover:text-white hover:border-accent/40 transition-all"
            title="Toggle sessions"
          >
            <Menu className="w-4.5 h-4.5" />
          </button>
          <div className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-tr from-accent-deep to-accent flex items-center justify-center shadow-lg shadow-accent/20 border border-white/20">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[13px] font-bold tracking-tight text-white font-mono truncate">NSOFFICE.AI</span>
              <span className="hidden sm:inline text-ink-dim text-xs">/</span>
              <span className="hidden sm:inline text-xs font-semibold text-ink-muted truncate">Healthcare</span>
            </div>
            <div className="hidden sm:block text-[11px] text-ink-soft font-medium truncate">
              Live Health Intake Assistant
            </div>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-4 text-xs font-medium text-ink-soft">
          {viewingPastSession ? (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/30 text-accent-tint">
              <span className="w-2 h-2 rounded-full bg-accent/50" />
              <span className="font-medium">Viewing past session</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.06]">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              <span className="font-mono text-[11px] text-ink-muted">{sessionDuration}</span>
              <span className="text-ink-faint">·</span>
              <span className="text-ink-soft">{extractedSymptomCount} symptoms</span>
            </div>
          )}

          {redFlagCount > 0 ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-critical/10 border border-critical/30 text-critical">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>{redFlagCount} Alert{redFlagCount !== 1 ? 's' : ''} Flagged</span>
            </div>
          ) : !viewingPastSession ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 border border-accent/30 text-accent-tint">
              <Sparkles className="w-3.5 h-3.5 text-accent" />
              <span>Real-time Gemini Tool Calling</span>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center p-1 rounded-xl bg-white/[0.04] border border-white/[0.08]">
            <button
              onClick={() => setActiveView('intake')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 min-h-11 rounded-lg text-xs font-medium transition-all ${
                activeView === 'intake'
                  ? 'bg-accent text-white shadow-md shadow-accent/30'
                  : 'text-ink-soft hover:text-white'
              }`}
            >
              <Mic className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Live Voice Intake</span>
              <span className="sm:hidden">Intake</span>
            </button>

            <button
              onClick={() => setActiveView('handoff')}
              className={`relative flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 min-h-11 rounded-lg text-xs font-medium transition-all ${
                activeView === 'handoff'
                  ? 'bg-accent text-white shadow-md shadow-accent/30'
                  : 'text-ink-soft hover:text-white'
              }`}
            >
              <FileText className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Doctor Handoff</span>
              <span className="sm:hidden">Handoff</span>
              {hasHandoff && (
                <span className="w-2 h-2 rounded-full bg-accent" />
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
