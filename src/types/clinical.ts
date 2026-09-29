

export type BodyLocation = 
  | 'head'
  | 'neck'
  | 'chest'
  | 'abdomen'
  | 'back'
  | 'limbs'
  | 'pelvis'
  | 'systemic'
  | 'other';

export type TriageUrgency = 'routine' | 'urgent' | 'emergency';

export interface SymptomRecord {
  id: string;
  name: string;
  location: BodyLocation;
  onset: string;
  duration: string;
  severity: number;
  character?: string;
  radiation?: string;
  aggravatingOrRelieving?: string;
  extractedAt: string;
}

export interface RedFlagAlert {
  id: string;
  level: TriageUrgency;
  finding: string;
  rationale: string;
  immediateRecommendation: string;
  timestamp: string;
}

export interface PatientHistory {
  allergies: string[];
  conditions: string[];
  medications: string[];
  surgicalHistory: string[];
  familyHistory?: string[];
  lifestyleFactors?: string[];
}

export interface DifferentialItem {
  condition: string;
  probability: 'high' | 'moderate' | 'low';
  clinicalRationale: string;
}

export interface ClinicalAssessment {
  provisionalImpression: string;
  differentials: DifferentialItem[];
  affectedOrganSystems: string[];
  recommendedPriority: TriageUrgency;
  suggestedPhysicianExam: string[];
}

export interface DoctorHandoffNote {
  chiefComplaint: string;
  hpi: string;
  soapSubjective: string;
  soapObjective: string;
  soapAssessment: string;
  soapPlan: string;
  urgencyLevel: TriageUrgency;
  suggestedDiagnosticOrders: string[];
  redFlagsSummary: string[];
  generatedAt: string;
  doctorChecklist: string[];
}

export interface ToolCallExecution {
  id: string;
  toolName: string;
  arguments: Record<string, any>;
  timestamp: string;
  summary: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  toolCalls?: ToolCallExecution[];
  spokenAs?: string;
}

export interface ClinicalIntakeState {
  sessionId: string;
  patientName: string;
  patientAge?: string;
  patientGender?: string;
  symptoms: SymptomRecord[];
  redFlags: RedFlagAlert[];
  history: PatientHistory;
  assessment: ClinicalAssessment | null;
  handoff: DoctorHandoffNote | null;
  triageLevel: TriageUrgency;
  messages: ChatMessage[];
  allToolCalls: ToolCallExecution[];
}
