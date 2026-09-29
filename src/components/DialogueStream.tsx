import React, { useRef, useEffect, useState } from 'react';
import {
  Mic,
  MicOff,
  Send,
  Volume2,
  VolumeX,
  Code2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ShieldAlert,
  CheckCircle2,
  Stethoscope,
  Info,
} from 'lucide-react';
import { ChatMessage, ToolCallExecution } from '../types/clinical';
import { VoiceVisualizer } from './VoiceVisualizer';
import { CLINICAL_SCENARIOS, ClinicalScenario } from '../data/clinicalScenarios';

interface DialogueStreamProps {
  messages: ChatMessage[];
  
  isListening: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
  isConnecting: boolean;
  
  micActive: boolean;
  
  micLevel: number;
  interimTranscript: string;
  onToggleListening: () => void;
  onSendMessage: (text: string) => void;
  onSelectScenario: (scenario: ClinicalScenario) => void;
  onGenerateHandoff: () => void;
  onStopAudio: () => void;
  
  onPrewarm: () => void;
  hasEnoughDataForHandoff: boolean;
  disabled?: boolean;
}

export const DialogueStream: React.FC<DialogueStreamProps> = ({
  messages,
  isListening,
  isSpeaking,
  isProcessing,
  isConnecting,
  micActive,
  micLevel,
  interimTranscript,
  onToggleListening,
  onSendMessage,
  onSelectScenario,
  onGenerateHandoff,
  onStopAudio,
  onPrewarm,
  hasEnoughDataForHandoff,
  disabled = false,
}) => {
  const [inputText, setInputText] = useState('');
  const [expandedToolId, setExpandedToolId] = useState<string | null>(null);
  const [activeScenario, setActiveScenario] = useState<ClinicalScenario | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const handoffIsPrimary = hasEnoughDataForHandoff && !isListening;

  const scrollToBottom = () => {
    const end = messagesEndRef.current;
    const list = end?.parentElement;
    if (!list) return;
    list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, interimTranscript, isProcessing]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isProcessing) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const handleScenarioPick = (scenario: ClinicalScenario) => {
    setActiveScenario(scenario);
    onSelectScenario(scenario);
  };

  const handleSendPresetReply = (reply: string) => {
    onSendMessage(reply);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 rounded-2xl glass-panel border border-white/[0.08] overflow-hidden">
      <div className="p-3 sm:p-4 border-b border-white/[0.06] bg-canvas/60">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 mb-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
            <span className="text-xs font-semibold text-ink">Real-Time Voice Intake</span>
            <span className="text-ink-dim text-xs">·</span>
            <span className="text-[11px] text-ink-soft">Gemini Live API · Audio-to-Audio</span>
          </div>

          <div className="text-[11px] text-ink-soft font-mono flex items-center gap-1.5">
            {isConnecting ? (
              <span className="text-accent font-medium flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 animate-spin" />
                Opening live session...
              </span>
            ) : isSpeaking ? (
              <span className="text-accent font-medium flex items-center gap-1">
                <Volume2 className="w-3.5 h-3.5 animate-pulse" />
                Assistant Speaking
              </span>
            ) : isListening && micActive ? (
              <span className="text-accent font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                Microphone Live
              </span>
            ) : isListening ? (
              <span className="text-ink-soft font-medium flex items-center gap-1">
                <MicOff className="w-3.5 h-3.5" />
                Session Live · Text-only
              </span>
            ) : isProcessing ? (
              <span className="text-accent font-medium flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 animate-spin" />
                Working...
              </span>
            ) : (
              <span>Standby / Ready</span>
            )}
          </div>
        </div>

        <VoiceVisualizer
          isListening={isListening}
          isSpeaking={isSpeaking}
          isProcessing={isProcessing}
          micLevel={micLevel}
        />

        <div className="mt-3 pt-3 border-t border-white/[0.04]">
          <div className="flex items-center justify-between text-[11px] text-ink-soft mb-2">
            <span className="font-medium">Preloaded Clinical Case Studies:</span>
            <span className="text-[10px] text-ink-dim">Click to simulate patient utterance</span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {CLINICAL_SCENARIOS.map((sc) => {
              const isSelected = activeScenario?.id === sc.id;
              return (
                <button
                  key={sc.id}
                  onClick={() => handleScenarioPick(sc)}
                  className={`flex-shrink-0 px-3 min-h-11 flex items-center rounded-lg text-xs font-medium transition-all ${
                    isSelected
                      ? 'bg-accent/20 text-white border border-accent'
                      : 'bg-white/[0.03] text-ink-soft hover:text-ink hover:bg-white/[0.07] border border-white/[0.06]'
                  }`}
                >
                  <span className="truncate max-w-[170px] inline-block">{sc.title}</span>
                </button>
              );
            })}
          </div>

          {activeScenario && (
            <div className="mt-2.5 p-2 rounded-xl bg-accent/10 border border-accent/20 text-xs">
              <div className="text-[10px] font-semibold text-accent-tint uppercase tracking-wide mb-1.5 flex items-center justify-between">
                <span>Patient Scenario Follow-Up Responses:</span>
                <button
                  onClick={() => setActiveScenario(null)}
                  className="text-ink-soft hover:text-white text-[10px]"
                >
                  Clear
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {activeScenario.followUpResponses.map((resText, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendPresetReply(resText)}
                    className="text-left text-[11px] bg-white/[0.04] hover:bg-accent/20 text-ink-muted hover:text-white px-2.5 min-h-9 rounded-md border border-white/5 transition-all truncate max-w-full"
                  >
                    "{resText}"
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-ink-soft">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center mb-3 text-accent">
              <Stethoscope className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">
              Live Clinical Intake Companion
            </h3>
            <p className="text-xs text-ink-soft max-w-sm mb-4 leading-relaxed">
              Describe your symptoms aloud in plain speech. The assistant will listen in real time, ask targeted clinical follow-ups, and extract structured diagnostic data via mid-conversation tool calls.
            </p>
            <div className="flex items-center gap-2 text-xs text-ink-dim">
              <span>Press the Electric Blue mic below</span>
              <span>·</span>
              <span>Or choose a test case above</span>
            </div>
          </div>
        )}

        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-full`}
            >
              <div className="flex items-center gap-2 mb-1 px-1">
                <span className="text-[11px] font-semibold text-ink-soft">
                  {isUser ? 'Patient (Spoken/Input)' : 'NSOffice Intake Assistant'}
                </span>
                <span className="text-[10px] text-ink-faint font-mono">{msg.timestamp}</span>
              </div>

              <div
                className={`group relative p-3.5 rounded-2xl max-w-[85%] sm:max-w-[78%] text-sm leading-relaxed transition-all ${
                  isUser
                    ? 'bg-accent text-white rounded-tr-sm shadow-lg shadow-accent/20 font-medium'
                    : 'bg-surface-raised/90 text-ink rounded-tl-sm border border-white/[0.08] shadow-md'
                }`}
              >
                <div>{msg.content}</div>

                {!isUser && (
                  <div className="mt-2 pt-2 border-t border-white/[0.08] space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Volume2 className="w-3.5 h-3.5 text-accent shrink-0" />
                      <span className="text-[10px] text-ink-dim font-mono">
                        {msg.spokenAs ? 'Spoken in the patient’s language' : 'Spoken live by Gemini'}
                      </span>
                    </div>
                    {msg.spokenAs && (
                      <p className="text-[11px] leading-relaxed text-ink-soft italic">
                        {msg.spokenAs}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="mt-2 w-full max-w-[85%] sm:max-w-[78%] space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-ink-soft px-1">
                    <Sparkles className="w-3 h-3 text-accent" />
                    <span>Gemini Mid-Conversation Tool Invocation ({msg.toolCalls.length})</span>
                  </div>

                  {msg.toolCalls.map((tc: ToolCallExecution) => {
                    const isExpanded = expandedToolId === tc.id;
                    const isRedFlag = tc.toolName === 'flag_triage_red_flag';
                    const isHandoff = tc.toolName === 'generate_doctor_handoff';

                    return (
                      <div
                        key={tc.id}
                        className={`rounded-xl border transition-all text-xs overflow-hidden ${
                          isRedFlag
                            ? 'bg-critical/10 border-critical/30 text-critical'
                            : isHandoff
                            ? 'bg-accent/10 border-accent/30 text-accent'
                            : 'bg-white/[0.03] border-white/[0.08] text-ink-muted'
                        }`}
                      >
                        <div
                          onClick={() => setExpandedToolId(isExpanded ? null : tc.id)}
                          className="p-2.5 flex items-center justify-between cursor-pointer hover:bg-white/[0.03]"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                            {isRedFlag ? (
                              <ShieldAlert className="w-4 h-4 text-critical flex-shrink-0" />
                            ) : isHandoff ? (
                              <CheckCircle2 className="w-4 h-4 text-accent flex-shrink-0" />
                            ) : (
                              <Code2 className="w-4 h-4 text-accent flex-shrink-0" />
                            )}
                            <div className="min-w-0 truncate">
                              <span className="font-mono font-semibold text-[11px] text-white">
                                {tc.toolName}()
                              </span>
                              <span className="mx-1.5 text-ink-dim">·</span>
                              <span className="text-[11px] text-ink-soft truncate">
                                {tc.summary}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 text-ink-soft flex-shrink-0">
                            <span className="text-[10px] font-mono text-ink-dim">{tc.timestamp}</span>
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="p-3 bg-black/40 border-t border-white/[0.06] font-mono text-[11px] overflow-x-auto text-ink-muted">
                            <div className="text-[10px] text-ink-dim mb-1 uppercase tracking-wider font-sans font-medium">
                              Exact Function Parameters:
                            </div>
                            <pre className="text-ink-muted">
                              {JSON.stringify(tc.arguments, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {isListening && interimTranscript && (
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-accent font-medium mb-1 animate-pulse">
              Listening live...
            </span>
            <div className="p-3 rounded-2xl max-w-[80%] bg-accent/20 border border-accent/40 text-ink text-sm italic">
              {interimTranscript} ...
            </div>
          </div>
        )}

        {isProcessing && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs text-ink-soft">
            <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <span>
              {isConnecting
                ? 'Opening the Gemini Live API session...'
                : 'Synthesizing the physician SOAP note...'}
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {!disabled && (
      <div className="p-3 sm:p-4 border-t border-white/[0.08] bg-canvas/80">
        {hasEnoughDataForHandoff && (
          <div className="mb-3">
            <button
              onClick={onGenerateHandoff}
              className={`w-full min-h-11 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.99] ${
                handoffIsPrimary ? 'ns-btn-primary' : 'ns-btn-secondary'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Generate Structured Doctor Handoff Note</span>
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex items-center gap-2 sm:gap-2">
          <button
            type="button"
            onClick={onToggleListening}
            onPointerEnter={onPrewarm}
            onFocus={onPrewarm}
            disabled={isConnecting}
            className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-all disabled:opacity-60 ${
              handoffIsPrimary ? 'ns-btn-secondary' : 'ns-btn-primary'
            } ${isListening ? 'animate-pulse' : 'hover:scale-[1.02]'}`}
            title={
              isConnecting
                ? 'Connecting to the Live API...'
                : isListening
                  ? 'End live session'
                  : 'Start live voice session'
            }
          >
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {isSpeaking && (
            <button
              type="button"
              onClick={onStopAudio}
              className="ns-btn-ghost flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all"
              title="Interrupt the assistant"
            >
              <VolumeX className="w-4 h-4" />
            </button>
          )}

          <div className="relative flex-1">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                isListening
                  ? 'Listening — or type instead...'
                  : 'Press the microphone to start a live session'
              }
              disabled={isProcessing}
              className="w-full bg-surface-raised border border-white/[0.1] rounded-xl px-3 sm:px-4 py-3 text-base sm:text-sm text-ink placeholder-ink-dim focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={!inputText.trim() || isProcessing}
            className="ns-btn-ghost w-11 h-11 rounded-xl disabled:opacity-40 flex items-center justify-center transition-all"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

        <div className="hidden sm:flex items-center justify-between text-[11px] text-ink-dim mt-2 px-1">
          <span>Speak naturally or type your responses</span>
        </div>
      </div>
      )}
    </div>
  );
};
