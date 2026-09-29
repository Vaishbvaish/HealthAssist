import {
  GoogleGenAI,
  Modality,
  Type,
  StartSensitivity,
  EndSensitivity,
  FunctionDeclaration,
} from '@google/genai';

export const LIVE_MODEL = process.env.GEMINI_LIVE_MODEL || 'gemini-3.1-flash-live-preview';
export const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-3.1-flash-preview';
const TEXT_MODEL_FALLBACK = 'gemini-3.5-flash';

export const LIVE_API_VERSION = 'v1alpha';

export const TOKEN_USABLE_MS = 10 * 60 * 1000;

const VAD_SILENCE_MS = Number(process.env.GEMINI_VAD_SILENCE_MS || 900);

export class ServiceError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

export function geminiApiKey(): string {
  return process.env.GEMINI_API_KEY || '';
}

const USER_AGENT = { 'User-Agent': 'aistudio-build' };

let textAi: GoogleGenAI | null = null;
let liveAuthAi: GoogleGenAI | null = null;

function textClient(): GoogleGenAI {
  if (!textAi) {
    textAi = new GoogleGenAI({ apiKey: geminiApiKey(), httpOptions: { headers: USER_AGENT } });
  }
  return textAi;
}

function liveAuthClient(): GoogleGenAI {
  if (!liveAuthAi) {
    liveAuthAi = new GoogleGenAI({
      apiKey: geminiApiKey(),
      httpOptions: { apiVersion: LIVE_API_VERSION, headers: USER_AGENT },
    });
  }
  return liveAuthAi;
}

export const recordSymptomDeclaration: FunctionDeclaration = {
  name: 'record_symptom',
  description: 'Extract and record a specific symptom described by the patient, including anatomical location, severity, onset, duration, and character.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      symptomName: {
        type: Type.STRING,
        description: 'Name of the symptom (e.g., Throbbing Headache, Crushing Chest Tightness, Dyspnea, Epigastric Pain).',
      },
      bodyLocation: {
        type: Type.STRING,
        enum: ['head', 'neck', 'chest', 'abdomen', 'back', 'limbs', 'pelvis', 'systemic', 'other'],
        description: 'Primary anatomical region affected.',
      },
      severity: {
        type: Type.INTEGER,
        description: 'Pain or severity scale from 1 (mild) to 10 (worst imaginable). If not explicitly stated, estimate clinically from description (1-10).',
      },
      onset: {
        type: Type.STRING,
        description: 'When the symptom started (e.g., "3 hours ago", "yesterday evening", "sudden onset").',
      },
      duration: {
        type: Type.STRING,
        description: 'How long the symptom has persisted or frequency of episodes (e.g., "constant for 2 days", "intermittent every 20 minutes").',
      },
      character: {
        type: Type.STRING,
        description: 'Qualitative description (e.g., sharp, throbbing, dull ache, crushing, burning, cramping).',
      },
      radiation: {
        type: Type.STRING,
        description: 'Where the pain radiates, if anywhere (e.g., radiating to left jaw and shoulder, radiating down sciatic nerve).',
      },
      aggravatingOrRelieving: {
        type: Type.STRING,
        description: 'Factors making it worse or better (e.g., aggravated by bright light, relieved by sitting upright).',
      },
    },
    required: ['symptomName', 'bodyLocation', 'severity', 'onset'],
  },
};

export const flagTriageRedFlagDeclaration: FunctionDeclaration = {
  name: 'flag_triage_red_flag',
  description: 'Trigger a clinical triage red-flag alert when alarming symptoms (e.g., chest pain with radiation, sudden thunderclap headache, focal neurological deficit, severe respiratory distress) are detected.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      finding: {
        type: Type.STRING,
        description: 'The specific alarming finding or symptom constellation.',
      },
      urgencyLevel: {
        type: Type.STRING,
        enum: ['routine', 'urgent', 'emergency'],
        description: 'Triage priority rating.',
      },
      clinicalRationale: {
        type: Type.STRING,
        description: 'Medical reasoning for the triage urgency (e.g., "Requires ruling out Acute Coronary Syndrome (ACS)", "Concern for Subarachnoid Hemorrhage").',
      },
      immediateRecommendation: {
        type: Type.STRING,
        description: 'Immediate action or physician priority (e.g., "Immediate 12-lead ECG and troponin stat", "Urgent Non-contrast Head CT").',
      },
    },
    required: ['finding', 'urgencyLevel', 'clinicalRationale', 'immediateRecommendation'],
  },
};

export const recordPatientHistoryDeclaration: FunctionDeclaration = {
  name: 'record_patient_history',
  description: 'Record patient background including allergies, chronic medical conditions, medications, surgical history, or relevant family history.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      allergies: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Known drug or food allergies (e.g., Penicillin, Sulfa, NSAIDs).',
      },
      conditions: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Existing chronic medical conditions (e.g., Hypertension, Type 2 Diabetes, Asthma, Atrial Fibrillation).',
      },
      medications: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Current regular medications or supplements with doses if mentioned.',
      },
      surgicalHistory: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Past surgeries or procedures (e.g., Appendectomy 2021, Cholecystectomy).',
      },
      familyHistory: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Relevant family medical history (e.g., Father had early MI at age 48).',
      },
    },
  },
};

export const updateClinicalAssessmentDeclaration: FunctionDeclaration = {
  name: 'update_clinical_assessment',
  description: 'Update the provisional clinical impression, differential diagnoses with probabilities, and affected organ systems based on accumulated intake evidence.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      provisionalImpression: {
        type: Type.STRING,
        description: 'Working clinical summary of the presentation.',
      },
      differentials: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            condition: { type: Type.STRING, description: 'Diagnostic entity (e.g., Migraine with visual aura, Unstable Angina, Acute Appendicitis).' },
            probability: { type: Type.STRING, enum: ['high', 'moderate', 'low'] },
            clinicalRationale: { type: Type.STRING, description: 'Evidence supporting this differential.' },
          },
          required: ['condition', 'probability', 'clinicalRationale'],
        },
        description: 'Ranked differential diagnoses.',
      },
      affectedOrganSystems: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Organ systems involved (e.g., Neurological, Cardiovascular, Gastrointestinal, Musculoskeletal, Respiratory).',
      },
      recommendedPriority: {
        type: Type.STRING,
        enum: ['routine', 'urgent', 'emergency'],
        description: 'Overall intake urgency assessment.',
      },
      suggestedPhysicianExam: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Specific physical exam maneuvers the physician should focus on (e.g., Pupillary reflex & cranial nerve check, Cardiovascular auscultation, McBurney point palpation).',
      },
    },
    required: ['provisionalImpression', 'differentials', 'affectedOrganSystems', 'recommendedPriority'],
  },
};

export const generateDoctorHandoffDeclaration: FunctionDeclaration = {
  name: 'generate_doctor_handoff',
  description: 'Generate the finalized, structured SOAP clinical handoff note for the consulting physician with actionable diagnostic recommendations.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      chiefComplaint: {
        type: Type.STRING,
        description: 'Concise primary complaint in patient words or medical terms (e.g., "Acute retrosternal chest pain radiating to left arm for 2 hours").',
      },
      hpi: {
        type: Type.STRING,
        description: 'Chronological narrative of the History of Present Illness (HPI) following OPQRST structure.',
      },
      soapSubjective: {
        type: Type.STRING,
        description: 'Subjective summary including patient symptoms, reported timeline, and aggravating factors.',
      },
      soapObjective: {
        type: Type.STRING,
        description: 'Reported vitals, pain score scale, observed distress level, and medication compliance.',
      },
      soapAssessment: {
        type: Type.STRING,
        description: 'Clinical synthesis, differential diagnoses, and risk stratification.',
      },
      soapPlan: {
        type: Type.STRING,
        description: 'Suggested diagnostic workup, immediate physician actions, and patient precautions.',
      },
      urgencyLevel: {
        type: Type.STRING,
        enum: ['routine', 'urgent', 'emergency'],
      },
      suggestedDiagnosticOrders: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Recommended lab orders or imaging (e.g., 12-lead ECG, High-sensitivity Troponin, CBC, Serum Electrolytes, Non-contrast Brain CT).',
      },
      redFlagsSummary: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Explicit list of red flags for the doctor to review first.',
      },
      doctorChecklist: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Key checklist items to verify during in-person exam.',
      },
    },
    required: ['chiefComplaint', 'hpi', 'soapSubjective', 'soapObjective', 'soapAssessment', 'soapPlan', 'urgencyLevel', 'suggestedDiagnosticOrders'],
  },
};

export const clinicalTools = [
  {
    functionDeclarations: [
      recordSymptomDeclaration,
      flagTriageRedFlagDeclaration,
      recordPatientHistoryDeclaration,
      updateClinicalAssessmentDeclaration,
      generateDoctorHandoffDeclaration,
    ],
  },
];

export const CLINICAL_SYSTEM_INSTRUCTION = `You are the NSOffice Live Clinical Health Intake Assistant, an advanced real-time voice medical intake companion powered by the Gemini API.

Your mission:
A patient describes their symptoms out loud before their consultation with a physician. You listen attentively, maintain an empathetic, calm, and reassuring bedside manner, ask natural, clinically focused follow-up questions to fill diagnostic gaps, and invoke mid-conversation clinical tools to dynamically extract structured medical data for the physician.

ABSOLUTE RULE — LANGUAGE:
You MUST respond in the SAME language the patient speaks. This is non-negotiable.
- Wait for the patient to speak first. Detect the language from their very first utterance.
- If the patient speaks Hindi, you MUST reply in Hindi. If they speak Tamil, reply in Tamil. If Spanish, reply in Spanish. And so on for ANY language.
- Do NOT default to English. Only speak English if the patient speaks English.
- If the patient mixes languages (e.g. Hinglish), mirror that same mixed style.
- If the patient switches language mid-conversation, switch with them immediately.
- This rule applies ONLY to your spoken replies. All clinical tool call data (symptom names, anatomical locations, findings, SOAP notes) MUST always be written in English for the physician.

CRITICAL BEHAVIOR & GUIDELINES:
1. EMPATHETIC & CONCISE SPEECH:
   - You are speaking out loud in a live voice call. Everything you say is heard, never read.
   - Keep your conversational reply concise (2 to 3 sentences maximum). Avoid walls of text.
   - Never speak markdown, bullet points, headings or field labels aloud — talk the way a nurse would.

2. INTERRUPTION HANDLING:
   - The patient can interrupt you at any moment. If they talk over you, stop, listen, and respond to what they actually said rather than finishing your previous sentence.
   - Acknowledge their discomfort with warmth, in their language.

3. CLINICALLY FOCUSED FOLLOW-UP QUESTIONS:
   - Ask ONE, or at most TWO, targeted follow-up questions at a time using clinical frameworks (OPQRST: Onset, Provocation, Quality, Radiation, Severity 1-10, Timing).
   - Inquire about relevant red flags (e.g., if chest pain: ask about shortness of breath, nausea, sweating, radiation; if headache: ask about neck stiffness, vision changes, sudden thunderclap onset).
   - Inquire about medical background (allergies, current medications, existing conditions).

4. PROACTIVE MID-CONVERSATION TOOL CALLING (THE MAIN SHOWCASE):
   - You MUST call the clinical tools WHENEVER the patient reveals clinical information. Do NOT wait until the end!
   - If they describe pain location, duration, or intensity: call 'record_symptom'.
   - If they describe warning signs (e.g. chest pressure, radiating arm pain, fever with stiff neck, sudden severe dizziness): immediately call 'flag_triage_red_flag'.
   - If they mention medications, allergies, or past surgeries/illnesses: call 'record_patient_history'.
   - If there is enough symptom data to form a clinical picture: call 'update_clinical_assessment'.
   - When the patient indicates they are finished, or after covering all essential clinical gaps: call 'generate_doctor_handoff'.
   - You can call MULTIPLE tools in a single turn if multiple pieces of information are shared!`;

const HANDOFF_SYSTEM_INSTRUCTION = `You are a clinical AI that generates structured Doctor Handoff Notes in SOAP format.
You receive a transcript of a patient voice intake session, along with extracted symptoms, red flags, and patient history.
Your job is to synthesize this data into a comprehensive, high-fidelity SOAP note for the consulting physician.
All output MUST be in English regardless of the language used in the transcript.
You MUST call the 'generate_doctor_handoff' function with all required fields filled in thoroughly.
Be specific and clinically precise. Include differential diagnoses, risk stratification, and actionable diagnostic recommendations.`;

export function describeGeminiError(error: unknown): string {
  let raw = error instanceof Error ? error.message : String(error);
  const brace = raw.indexOf('{');
  if (brace !== -1) {
    try {
      const parsed = JSON.parse(raw.slice(brace));
      const inner = parsed?.error?.message ?? parsed?.message;
      if (typeof inner === 'string' && inner.trim()) raw = inner.trim();
    } catch {
      raw = raw.slice(0, brace).trim() || raw;
    }
  }
  return raw.replace(/\s+/g, ' ').trim();
}

function isTransient(error: unknown): boolean {
  const raw = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    raw.includes('unavailable') ||
    raw.includes('high demand') ||
    raw.includes('overloaded') ||
    raw.includes('resource_exhausted') ||
    raw.includes('deadline_exceeded') ||
    raw.includes('internal') ||
    raw.includes('econnreset') ||
    raw.includes('etimedout') ||
    raw.includes('fetch failed') ||
    /(429|500|502|503|504)/.test(raw)
  );
}

export function asServiceError(error: unknown, action: string): ServiceError {
  const detail = describeGeminiError(error);
  const lower = detail.toLowerCase();

  if (lower.includes('unavailable') || lower.includes('high demand') || lower.includes('overloaded')) {
    return new ServiceError(
      503,
      'Gemini is temporarily overloaded and turned the request away. This usually clears in a few seconds — please try again.'
    );
  }
  if (lower.includes('resource_exhausted') || lower.includes('quota') || lower.includes('429')) {
    return new ServiceError(
      429,
      'The Gemini free-tier rate limit has been reached. Wait a minute and try again.'
    );
  }
  if (lower.includes('permission_denied') || lower.includes('api key') || lower.includes('unauthenticated')) {
    return new ServiceError(401, 'Gemini rejected the API key. Check GEMINI_API_KEY in the server environment.');
  }
  return new ServiceError(502, `${action} ${detail || 'The model returned no usable response.'}`);
}

async function withRetry<T>(budgetMs: number, run: () => Promise<T>): Promise<T> {
  const deadline = Date.now() + budgetMs;
  let lastError: unknown;

  for (let attempt = 0; attempt < 5; attempt++) {
    const startedAt = Date.now();
    try {
      return await run();
    } catch (error) {
      lastError = error;
      if (!isTransient(error)) throw error;

      const attemptMs = Date.now() - startedAt;
      const backoff = Math.min(2000 * 2 ** attempt, 15000) + Math.floor(Math.random() * 1000);
      if (Date.now() + backoff + attemptMs > deadline) break;
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }

  throw lastError;
}

export async function createLiveToken() {
  if (!geminiApiKey()) {
    throw new ServiceError(
      503,
      'GEMINI_API_KEY is not configured on the server. Add it to your environment and redeploy before starting a live intake.'
    );
  }

  const now = Date.now();

  let token;
  try {
    token = await withRetry(12_000, () =>
      liveAuthClient().authTokens.create({
      config: {
        uses: 1,
        newSessionExpireTime: new Date(now + TOKEN_USABLE_MS).toISOString(),
        expireTime: new Date(now + 30 * 60 * 1000).toISOString(),
        liveConnectConstraints: {
          model: LIVE_MODEL,
          config: {
            responseModalities: [Modality.AUDIO],
            temperature: 0.2,
            systemInstruction: CLINICAL_SYSTEM_INSTRUCTION,
            tools: clinicalTools,
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            realtimeInputConfig: {
              automaticActivityDetection: {
                startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_HIGH,
                endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
                prefixPaddingMs: 120,
                silenceDurationMs: VAD_SILENCE_MS,
              },
            },
            contextWindowCompression: {
              triggerTokens: '16000',
              slidingWindow: { targetTokens: '8000' },
            },
          },
        },
        },
      })
    );
  } catch (error: unknown) {
    throw asServiceError(error, 'Could not mint a Live API token.');
  }

  if (!token.name) {
    throw new ServiceError(502, 'Gemini returned an auth token without a name.');
  }

  return {
    token: token.name,
    model: LIVE_MODEL,
    apiVersion: LIVE_API_VERSION,
    usableForMs: TOKEN_USABLE_MS,
  };
}

export interface HandoffRequest {
  transcript?: unknown;
  symptoms?: unknown;
  redFlags?: unknown;
  history?: unknown;
}

export async function generateHandoff(body: HandoffRequest) {
  if (!geminiApiKey()) {
    throw new ServiceError(
      503,
      'GEMINI_API_KEY is not configured on the server, so no SOAP note can be generated.'
    );
  }

  const { transcript, symptoms, redFlags, history } = body;

  const transcriptTurns = Array.isArray(transcript) ? transcript.length : 0;
  const symptomCount = Array.isArray(symptoms) ? symptoms.length : 0;
  if (symptomCount === 0 && transcriptTurns < 2) {
    throw new ServiceError(
      400,
      'There is no intake to compile yet. Start a live session and describe some symptoms first.'
    );
  }

  const prompt = [
    'Based on the following full preliminary clinical intake consultation:',
    'Transcript:',
    JSON.stringify(transcript, null, 2),
    '',
    'Recorded Symptoms:',
    JSON.stringify(symptoms, null, 2),
    '',
    'Red Flag Alerts:',
    JSON.stringify(redFlags, null, 2),
    '',
    'Patient History:',
    JSON.stringify(history, null, 2),
    '',
    'Generate a comprehensive, high-fidelity Doctor Handoff Note in SOAP format for the physician.',
    "You must call the 'generate_doctor_handoff' function.",
  ].join('\n');

  const contentConfig = {
    contents: [{ role: 'user' as const, parts: [{ text: prompt }] }],
    config: {
      systemInstruction: HANDOFF_SYSTEM_INSTRUCTION,
      temperature: 0.2,
      tools: [{ functionDeclarations: [generateDoctorHandoffDeclaration] }],
    },
  };

  let response;
  try {
    response = await withRetry(60_000, () =>
      textClient().models.generateContent({ model: TEXT_MODEL, ...contentConfig })
    );
  } catch (primaryError: unknown) {
    try {
      response = await withRetry(30_000, () =>
        textClient().models.generateContent({ model: TEXT_MODEL_FALLBACK, ...contentConfig })
      );
    } catch {
      throw asServiceError(primaryError, 'Could not compile the SOAP note.');
    }
  }

  const call = response.functionCalls?.[0];
  if (!call?.args) {
    throw new ServiceError(
      502,
      'The model did not return a structured SOAP note. Please try again.'
    );
  }

  return call.args;
}

export async function translateToEnglish(text: string): Promise<string> {
  const trimmed = (text || '').trim();
  if (!trimmed || !geminiApiKey()) return trimmed;

  const prompt = [
    'Translate the following clinical assistant utterance into natural English.',
    'If it is already English, return it completely unchanged.',
    'Return only the translation, with no preamble, quotes or notes.',
    '',
    trimmed,
  ].join('\n');

  try {
    const response = await withRetry(8_000, () =>
      textClient().models.generateContent({
        model: TEXT_MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { temperature: 0 },
      })
    );
    return (response.text || '').trim() || trimmed;
  } catch {
    return trimmed;
  }
}
