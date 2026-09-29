import {
  ChatMessage,
  SymptomRecord,
  RedFlagAlert,
  PatientHistory,
  ClinicalAssessment,
  DoctorHandoffNote,
  TriageUrgency,
  ToolCallExecution,
} from '../types/clinical';

export interface SavedSession {
  id: string;
  createdAt: string;
  updatedAt: string;
  label: string;
  triageLevel: TriageUrgency;
  messages: ChatMessage[];
  symptoms: SymptomRecord[];
  redFlags: RedFlagAlert[];
  history: PatientHistory;
  assessment: ClinicalAssessment | null;
  handoff: DoctorHandoffNote | null;
  allToolCalls: ToolCallExecution[];
  sessionSeconds: number;
}

const SESSIONS_KEY = 'nsoffice_sessions';
const MAX_SESSIONS = 50;

function readAll(): SavedSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeAll(sessions: SavedSession[]): void {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions.slice(0, MAX_SESSIONS)));
}

export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export function deriveLabel(
  messages: ChatMessage[],
  symptoms: SymptomRecord[],
  handoff: DoctorHandoffNote | null,
): string {
  if (handoff?.chiefComplaint) return handoff.chiefComplaint;
  if (symptoms.length > 0) return symptoms.map((s) => s.name).join(', ');
  const firstUser = messages.find((m) => m.role === 'user');
  if (firstUser) {
    const text = firstUser.content;
    return text.length > 80 ? text.slice(0, 77) + '...' : text;
  }
  return 'New intake session';
}

export function saveSession(session: SavedSession): void {
  const all = readAll();
  const idx = all.findIndex((s) => s.id === session.id);
  if (idx >= 0) {
    all[idx] = session;
  } else {
    all.unshift(session);
  }
  writeAll(all);
}

export function listSessions(): SavedSession[] {
  return readAll().sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function loadSession(id: string): SavedSession | null {
  return readAll().find((s) => s.id === id) ?? null;
}

export function deleteSession(id: string): void {
  writeAll(readAll().filter((s) => s.id !== id));
}

