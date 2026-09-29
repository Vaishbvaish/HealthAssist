


import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Header } from './components/Header';
import { DialogueStream } from './components/DialogueStream';
import { ClinicalExtractionPanel } from './components/ClinicalExtractionPanel';
import { DoctorHandoffView } from './components/DoctorHandoffView';
import { SessionSidebar } from './components/SessionSidebar';
import { LiveIntakeSession, prewarmLiveToken, type LiveStatus } from './utils/liveClient';
import { formatToolCallSummary } from './utils/toolSummary';
import { looksEnglish, toEnglish } from './utils/language';
import {
  generateSessionId,
  deriveLabel,
  saveSession,
  loadSession,
  type SavedSession,
} from './utils/sessionStore';
import {
  ChatMessage,
  SymptomRecord,
  RedFlagAlert,
  PatientHistory,
  ClinicalAssessment,
  DoctorHandoffNote,
  TriageUrgency,
  ToolCallExecution,
} from './types/clinical';
import { ClinicalScenario } from './data/clinicalScenarios';

const URGENCY_RANK: Record<TriageUrgency, number> = {
  routine: 0,
  urgent: 1,
  emergency: 2,
};

const clockTime = () =>
  new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function readableError(value: unknown, fallback: string): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return fallback;
  if (raw.startsWith('{') || raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw);
      const inner = parsed?.error?.message ?? parsed?.message;
      if (typeof inner === 'string' && inner.trim()) return inner.trim();
    } catch {
      return fallback;
    }
    return fallback;
  }
  return raw;
}

const WELCOME_MESSAGE: ChatMessage = {
  id: 'msg_welcome',
  role: 'assistant',
  content:
    "Hello, I am your NSOffice Live Health Intake Assistant. Press the microphone to start a live voice consultation, and describe what symptoms brought you in today.",
  timestamp: clockTime(),
};

const EMPTY_HISTORY: PatientHistory = {
  allergies: [],
  conditions: [],
  medications: [],
  surgicalHistory: [],
};

export default function App() {
  const [activeView, setActiveView] = useState<'intake' | 'handoff'>('intake');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [viewingPastSession, setViewingPastSession] = useState(false);

  const [sessionId, setSessionId] = useState<string>(() => generateSessionId());

  const [status, setStatus] = useState<LiveStatus>('idle');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [streamingReply, setStreamingReply] = useState('');
  const [micLevel, setMicLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sessionSeconds, setSessionSeconds] = useState(0);

  const sessionRef = useRef<LiveIntakeSession | null>(null);

  const pendingToolCallsRef = useRef<ToolCallExecution[]>([]);

  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [symptoms, setSymptoms] = useState<SymptomRecord[]>([]);
  const [redFlags, setRedFlags] = useState<RedFlagAlert[]>([]);
  const [history, setHistory] = useState<PatientHistory>(EMPTY_HISTORY);
  const [assessment, setAssessment] = useState<ClinicalAssessment | null>(null);
  const [handoff, setHandoff] = useState<DoctorHandoffNote | null>(null);
  const [allToolCalls, setAllToolCalls] = useState<ToolCallExecution[]>([]);
  const [triageLevel, setTriageLevel] = useState<TriageUrgency>('routine');

  const isLive = status === 'live';

  useEffect(() => {
    if (!isLive) return;
    const timer = setInterval(() => setSessionSeconds((prev) => prev + 1), 1000);
    return () => clearInterval(timer);
  }, [isLive]);

  useEffect(() => {
    prewarmLiveToken();
  }, []);

  useEffect(() => {
    return () => {
      void sessionRef.current?.stop();
      sessionRef.current = null;
    };
  }, []);

  // Auto-save: only save sessions that have real content, and never save when viewing a past session
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (viewingPastSession) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const hasContent = messages.length > 1 || symptoms.length > 0;
      if (!hasContent) return;
      const session: SavedSession = {
        id: sessionId,
        createdAt: loadSession(sessionId)?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        label: deriveLabel(messages, symptoms, handoff),
        triageLevel,
        messages,
        symptoms,
        redFlags,
        history,
        assessment,
        handoff,
        allToolCalls,
        sessionSeconds,
      };
      saveSession(session);
    }, 800);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [viewingPastSession, sessionId, messages, symptoms, redFlags, history, assessment, handoff, allToolCalls, triageLevel, sessionSeconds]);

  const resetToFreshState = useCallback(() => {
    void sessionRef.current?.stop();
    sessionRef.current = null;
    setSessionId(generateSessionId());
    setActiveView('intake');
    setViewingPastSession(false);
    setStatus('idle');
    setMessages([{ ...WELCOME_MESSAGE, timestamp: clockTime() }]);
    setSymptoms([]);
    setRedFlags([]);
    setHistory(EMPTY_HISTORY);
    setAssessment(null);
    setHandoff(null);
    setAllToolCalls([]);
    setTriageLevel('routine');
    setSessionSeconds(0);
    setError(null);
    setSidebarOpen(false);
  }, []);

  const handleLoadSession = useCallback((id: string) => {
    const saved = loadSession(id);
    if (!saved) return;
    void sessionRef.current?.stop();
    sessionRef.current = null;
    setSessionId(id);
    setActiveView('intake');
    setViewingPastSession(true);
    setStatus('idle');
    setMessages(saved.messages);
    setSymptoms(saved.symptoms);
    setRedFlags(saved.redFlags);
    setHistory(saved.history);
    setAssessment(saved.assessment);
    setHandoff(saved.handoff);
    setAllToolCalls(saved.allToolCalls);
    setTriageLevel(saved.triageLevel);
    setSessionSeconds(saved.sessionSeconds);
    setError(null);
    setSidebarOpen(false);
    if (saved.handoff) setActiveView('handoff');
  }, []);

  const formatTimer = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };


  const escalateTriage = useCallback((level?: TriageUrgency) => {
    if (!level || !(level in URGENCY_RANK)) return;
    setTriageLevel((prev) => (URGENCY_RANK[level] > URGENCY_RANK[prev] ? level : prev));
  }, []);


  const processIncomingToolCalls = useCallback(
    (toolCalls: ToolCallExecution[]) => {
      toolCalls.forEach((tc) => {
        const { toolName, arguments: args } = tc;

        if (toolName === 'record_symptom' && args.symptomName) {
          const newSym: SymptomRecord = {
            id: `sym_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            name: args.symptomName,
            location: args.bodyLocation || 'other',
            severity: typeof args.severity === 'number' ? args.severity : 5,
            onset: args.onset || 'recent',
            duration: args.duration || 'ongoing',
            character: args.character,
            radiation: args.radiation,
            aggravatingOrRelieving: args.aggravatingOrRelieving,
            extractedAt: tc.timestamp,
          };

          setSymptoms((prev) => {
            const exists = prev.some(
              (p) =>
                p.name.toLowerCase() === newSym.name.toLowerCase() &&
                p.location === newSym.location
            );
            if (exists) return prev;
            return [newSym, ...prev];
          });
        }

        if (toolName === 'flag_triage_red_flag' && args.finding) {
          const newFlag: RedFlagAlert = {
            id: `rf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            level: args.urgencyLevel || 'urgent',
            finding: args.finding,
            rationale: args.clinicalRationale || 'Alarms clinical criteria',
            immediateRecommendation: args.immediateRecommendation || 'Urgent evaluation',
            timestamp: tc.timestamp,
          };

          setRedFlags((prev) => [newFlag, ...prev]);
          escalateTriage(args.urgencyLevel);
        }

        if (toolName === 'record_patient_history') {
          setHistory((prev) => ({
            allergies: Array.from(new Set([...prev.allergies, ...(args.allergies || [])])),
            conditions: Array.from(new Set([...prev.conditions, ...(args.conditions || [])])),
            medications: Array.from(new Set([...prev.medications, ...(args.medications || [])])),
            surgicalHistory: Array.from(
              new Set([...prev.surgicalHistory, ...(args.surgicalHistory || [])])
            ),
          }));
        }

        if (toolName === 'update_clinical_assessment') {
          setAssessment({
            provisionalImpression: args.provisionalImpression || 'Pending',
            differentials: args.differentials || [],
            affectedOrganSystems: args.affectedOrganSystems || [],
            recommendedPriority: args.recommendedPriority || 'routine',
            suggestedPhysicianExam: args.suggestedPhysicianExam || [],
          });
          escalateTriage(args.recommendedPriority);
        }

        if (toolName === 'generate_doctor_handoff') {
          setHandoff({
            chiefComplaint: args.chiefComplaint || 'Consultation intake',
            hpi: args.hpi || '',
            soapSubjective: args.soapSubjective || '',
            soapObjective: args.soapObjective || '',
            soapAssessment: args.soapAssessment || '',
            soapPlan: args.soapPlan || '',
            urgencyLevel: args.urgencyLevel || 'routine',
            suggestedDiagnosticOrders: args.suggestedDiagnosticOrders || [],
            redFlagsSummary: args.redFlagsSummary || [],
            generatedAt: clockTime(),
            doctorChecklist: args.doctorChecklist || [],
          });
          escalateTriage(args.urgencyLevel);
        }
      });
    },
    [escalateTriage]
  );


  const buildSession = useCallback(() => {
    return new LiveIntakeSession({
      onStatus: (next) => {
        setStatus(next);
        setIsProcessing(next === 'connecting');
        if (next === 'idle' || next === 'closed' || next === 'error') {
          setInterimTranscript('');
          setMicLevel(0);
        }
      },

      onUserTranscript: (text, isFinal) => {
        if (!isFinal) {
          setInterimTranscript(text);
          return;
        }
        setInterimTranscript('');
        setMessages((prev) => [
          ...prev,
          {
            id: `msg_${Date.now()}_u`,
            role: 'user',
            content: text,
            timestamp: clockTime(),
          },
        ]);
      },

      onAssistantTranscript: (text, isFinal) => {
        if (!isFinal) {
          setStreamingReply(text);
          return;
        }
        setStreamingReply('');
        const attached = pendingToolCallsRef.current;
        pendingToolCallsRef.current = [];
        const id = `msg_${Date.now()}_a`;
        setMessages((prev) => [
          ...prev,
          {
            id,
            role: 'assistant',
            content: text,
            timestamp: clockTime(),
            toolCalls: attached.length ? attached : undefined,
          },
        ]);

        if (!looksEnglish(text)) {
          void toEnglish(text).then((english) => {
            if (english === text) return;
            setMessages((prev) =>
              prev.map((m) => (m.id === id ? { ...m, content: english, spokenAs: text } : m))
            );
          });
        }
      },

      onToolCalls: (calls) => {
        const executions: ToolCallExecution[] = calls.map((call) => ({
          id: call.id || `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          toolName: call.name || 'unknown_tool',
          arguments: (call.args as Record<string, any>) || {},
          timestamp: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
          summary: formatToolCallSummary(call.name || '', (call.args as Record<string, any>) || {}),
        }));

        pendingToolCallsRef.current = [...pendingToolCallsRef.current, ...executions];
        setAllToolCalls((prev) => [...prev, ...executions]);
        processIncomingToolCalls(executions);
      },

      onSpeakingChange: setIsSpeaking,
      onMicState: setMicActive,
      onLevel: setMicLevel,
      onError: (message) => setError(message),
    });
  }, [processIncomingToolCalls]);


  const handleToggleListening = async () => {
    if (viewingPastSession) return;
    if (isLive || status === 'connecting') {
      await sessionRef.current?.stop();
      sessionRef.current = null;
      return;
    }

    setError(null);
    setSessionSeconds(0);

    const session = buildSession();
    sessionRef.current = session;
    await session.start();
  };


  const handleSendMessage = (text: string) => {
    if (viewingPastSession) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    if (!sessionRef.current?.isLive) {
      setError('Start the live session first — press the microphone button to connect.');
      return;
    }

    setMessages((prev) => [
      ...prev,
      {
        id: `msg_${Date.now()}_u`,
        role: 'user',
        content: trimmed,
        timestamp: clockTime(),
      },
    ]);

    sessionRef.current.sendText(trimmed);
  };

  const handleGenerateHandoff = async () => {
    if (viewingPastSession) return;
    setIsProcessing(true);
    setError(null);
    try {
      const response = await fetch('/api/intake/handoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: messages, symptoms, redFlags, history }),
      });

      const data = await response.json();

      if (!response.ok || !data.handoff) {
        setError(readableError(data?.error, 'Could not generate the SOAP handoff note.'));
        return;
      }

      setHandoff({ ...data.handoff, generatedAt: clockTime() });
      setActiveView('handoff');
    } catch (e) {
      setError(
        readableError(
          e instanceof Error ? e.message : '',
          'Could not reach the server to generate the handoff.'
        )
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSelectScenario = (scenario: ClinicalScenario) => {
    if (viewingPastSession) return;
    handleSendMessage(scenario.initialUtterance);
  };


  const handleStopAudio = () => {
    sessionRef.current?.interrupt();
  };

  const visibleMessages: ChatMessage[] = streamingReply
    ? [
        ...messages,
        {
          id: 'msg_streaming',
          role: 'assistant',
          content: streamingReply,
          timestamp: clockTime(),
        },
      ]
    : messages;

  return (
    <div className="min-h-screen flex bg-canvas text-ink selection:bg-accent/30">
      <SessionSidebar
        isOpen={sidebarOpen}
        currentSessionId={viewingPastSession ? null : sessionId}
        onToggle={() => setSidebarOpen((v) => !v)}
        onNewSession={resetToFreshState}
        onLoadSession={handleLoadSession}
      />

      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        <Header
          activeView={activeView}
          setActiveView={setActiveView}
          triageLevel={triageLevel}
          extractedSymptomCount={symptoms.length}
          redFlagCount={redFlags.length}
          sessionDuration={formatTimer(sessionSeconds)}
          hasHandoff={!!handoff}
          viewingPastSession={viewingPastSession}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
        />

        {error && (
          <div className="max-w-7xl w-full mx-auto px-3 sm:px-6 pt-3 sm:pt-4">
            <div className="flex items-start gap-3 rounded-2xl border border-critical/40 bg-critical/10 px-4 py-3 backdrop-blur-xl">
              <AlertTriangle className="w-4 h-4 text-critical mt-0.5 shrink-0" />
              <p className="flex-1 text-[13px] leading-relaxed text-ink">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-ink-soft hover:text-white transition-colors"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {viewingPastSession && (
          <div className="max-w-7xl w-full mx-auto px-3 sm:px-6 pt-3 sm:pt-4">
            <div className="flex items-center gap-3 rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 backdrop-blur-xl">
              <span className="text-[13px] font-medium text-accent-tint flex-1">
                Viewing a past session (read-only). Voice and text input are disabled.
              </span>
              <button
                onClick={resetToFreshState}
                className="ns-btn-primary px-3 min-h-9 rounded-lg text-xs font-semibold shrink-0"
              >
                New Session
              </button>
            </div>
          </div>
        )}

        <main className="flex-1 w-full max-w-7xl mx-auto p-3 sm:p-5 lg:p-6 lg:overflow-hidden">
          {activeView === 'intake' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 lg:h-[calc(100vh-6.5rem)]">
              <div className="lg:col-span-7 flex flex-col min-h-[68svh] lg:min-h-0 lg:h-full">
                <DialogueStream
                  messages={visibleMessages}
                  isListening={isLive}
                  isSpeaking={isSpeaking}
                  isProcessing={isProcessing}
                  isConnecting={status === 'connecting'}
                  micActive={micActive}
                  onPrewarm={prewarmLiveToken}
                  micLevel={micLevel}
                  interimTranscript={interimTranscript}
                  onToggleListening={handleToggleListening}
                  onSendMessage={handleSendMessage}
                  onSelectScenario={handleSelectScenario}
                  onGenerateHandoff={handleGenerateHandoff}
                  onStopAudio={handleStopAudio}
                  hasEnoughDataForHandoff={symptoms.length > 0 || messages.length >= 3}
                  disabled={viewingPastSession}
                />
              </div>

              <div className="lg:col-span-5 flex flex-col min-h-0 lg:h-full">
                <ClinicalExtractionPanel
                  symptoms={symptoms}
                  redFlags={redFlags}
                  history={history}
                  assessment={assessment}
                  triageLevel={triageLevel}
                  allToolCalls={allToolCalls}
                />
              </div>
            </div>
          ) : (
            <div className="lg:h-full lg:overflow-y-auto">
              <DoctorHandoffView
                handoff={handoff}
                symptoms={symptoms}
                redFlags={redFlags}
                history={history}
                onReturnToIntake={() => setActiveView('intake')}
                onGenerateHandoffAgain={handleGenerateHandoff}
                isGenerating={isProcessing}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
