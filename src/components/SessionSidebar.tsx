import React, { useState, useSyncExternalStore } from 'react';
import {
  Plus,
  Trash2,
  MessageSquare,
  ShieldAlert,
  Clock,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { type SavedSession, listSessions, deleteSession } from '../utils/sessionStore';

const LG = 1024;
const lgQuery = window.matchMedia(`(min-width: ${LG}px)`);
function useIsDesktop() {
  return useSyncExternalStore(
    (cb) => { lgQuery.addEventListener('change', cb); return () => lgQuery.removeEventListener('change', cb); },
    () => lgQuery.matches,
  );
}

interface SessionSidebarProps {
  isOpen: boolean;
  currentSessionId: string | null;
  onToggle: () => void;
  onNewSession: () => void;
  onLoadSession: (id: string) => void;
}

export const SessionSidebar: React.FC<SessionSidebarProps> = ({
  isOpen,
  currentSessionId,
  onToggle,
  onNewSession,
  onLoadSession,
}) => {
  const isDesktop = useIsDesktop();
  const [sessions, setSessions] = useState<SavedSession[]>(() => listSessions());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const refreshList = () => setSessions(listSessions());

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteSession(id);
    refreshList();
    setConfirmDeleteId(null);
  };

  const handleConfirmDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setConfirmDeleteId(id);
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDeleteId(null);
  };

  React.useEffect(() => {
    if (isOpen) refreshList();
  }, [isOpen]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
  };

  const triageColor = (level: string) => {
    switch (level) {
      case 'emergency': return 'bg-critical/20 text-critical border-critical/40';
      case 'urgent': return 'bg-caution/20 text-caution border-caution/40';
      default: return 'bg-accent/15 text-accent-tint border-accent/30';
    }
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && !isDesktop && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={onToggle}
        />
      )}

      {/* Sidebar wrapper — always visible on desktop, overlay on mobile */}
      <div
        className="top-0 h-screen shrink-0"
        style={{
          position: isDesktop ? 'relative' : 'fixed',
          zIndex: isDesktop ? 30 : 50,
          width: isDesktop ? (isOpen ? 256 : 48) : 256,
          left: isDesktop ? undefined : (isOpen ? 0 : -256),
        }}
      >
        <div
          className="h-full flex flex-col bg-[#0a0e1a] border-r border-white/[0.08]"
        >
          {/* Top bar */}
          <div className={`flex items-center shrink-0 border-b border-white/[0.08] ${isOpen ? 'justify-between px-3 py-2.5' : 'justify-center py-2.5'}`}>
            {isOpen ? (
              <>
                <span className="text-[11px] font-bold text-ink-muted uppercase tracking-wider">Sessions</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { onNewSession(); refreshList(); }}
                    className="ns-btn-primary flex items-center gap-1 px-2 min-h-7 rounded-lg text-[11px] font-semibold"
                    title="New session"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New</span>
                  </button>
                  <button
                    onClick={onToggle}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-ink-soft hover:text-white hover:bg-white/[0.06] transition-colors"
                    title="Collapse sidebar"
                  >
                    <PanelLeftClose className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={onToggle}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-soft hover:text-white hover:bg-white/[0.06] transition-colors"
                title="Expand sidebar"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Collapsed rail — icon buttons for recent sessions */}
          {!isOpen && isDesktop && (
            <div className="flex flex-col items-center gap-1.5 pt-2">
              <button
                onClick={() => { onNewSession(); onToggle(); }}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-soft hover:text-accent hover:bg-accent/10 transition-colors"
                title="New session"
              >
                <Plus className="w-4 h-4" />
              </button>
              {sessions.slice(0, 6).map((s) => (
                <button
                  key={s.id}
                  onClick={() => onLoadSession(s.id)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    s.id === currentSessionId
                      ? 'text-accent bg-accent/15'
                      : 'text-ink-faint hover:text-ink-soft hover:bg-white/[0.05]'
                  }`}
                  title={s.label}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                </button>
              ))}
            </div>
          )}

          {/* Expanded session list */}
          {isOpen && (
            <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
              {sessions.length === 0 && (
                <div className="py-10 text-center px-3">
                  <Clock className="w-6 h-6 mx-auto mb-2 text-ink-faint/50" />
                  <p className="text-[11px] text-ink-dim">No sessions yet</p>
                  <p className="text-[10px] text-ink-faint mt-0.5">
                    Conversations will appear here
                  </p>
                </div>
              )}

              {sessions.map((s) => {
                const isCurrent = s.id === currentSessionId;
                return (
                  <div
                    key={s.id}
                    onClick={() => { if (!isCurrent) onLoadSession(s.id); }}
                    className={`group relative p-2 rounded-lg cursor-pointer transition-all text-xs ${
                      isCurrent
                        ? 'bg-accent/15 border border-accent/30'
                        : 'hover:bg-white/[0.05] border border-transparent'
                    }`}
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      <MessageSquare className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${isCurrent ? 'text-accent' : 'text-ink-faint'}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium truncate leading-tight ${isCurrent ? 'text-white' : 'text-ink-muted'}`}>
                          {s.label}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1 text-[10px] text-ink-dim">
                          <span>{formatDate(s.updatedAt)}</span>
                          <span className="text-ink-faint">·</span>
                          <span>{s.symptoms.length} sym</span>
                          {s.redFlags.length > 0 && (
                            <>
                              <span className="text-ink-faint">·</span>
                              <span className="text-critical flex items-center gap-0.5">
                                <ShieldAlert className="w-2.5 h-2.5" />
                                {s.redFlags.length}
                              </span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${triageColor(s.triageLevel)}`}>
                            {s.triageLevel}
                          </span>
                          {s.handoff && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-accent/15 text-accent-tint border border-accent/25">
                              SOAP
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {!isCurrent && (
                      <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {confirmDeleteId === s.id ? (
                          <div className="flex items-center gap-1 bg-[#0a0e1a] rounded-lg p-0.5">
                            <button
                              onClick={(e) => handleDelete(e, s.id)}
                              className="px-2 min-h-6 rounded bg-critical/20 text-critical text-[10px] font-semibold hover:bg-critical/30"
                            >
                              Delete
                            </button>
                            <button
                              onClick={handleCancelDelete}
                              className="px-1.5 min-h-6 rounded text-ink-soft text-[10px] hover:text-white"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => handleConfirmDelete(e, s.id)}
                            className="w-6 h-6 rounded-md flex items-center justify-center text-ink-faint hover:text-critical hover:bg-critical/10 transition-all"
                            title="Delete session"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
};
