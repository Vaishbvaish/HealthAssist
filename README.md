# NSOffice Live Health Intake Assistant

> **Network Science (NSOFFICE.AI) Internship Assignment**  
> **Project 5: Live Health Intake Assistant — Healthcare**

An end-to-end real-time AI voice intake companion built on the **Gemini Live API**. A patient describes their symptoms out loud before a consultation; the assistant listens attentively, asks natural follow-up questions to fill in clinical diagnostic gaps, and dynamically invokes **clinical tools mid-conversation** to produce an instant, structured SOAP summary note for the consulting physician.

### Models

| Use | Model |
| --- | --- |
| Real-time voice conversation (audio-to-audio, WebSocket) | `gemini-3.1-flash-live-preview` |
| Turn-based SOAP note synthesis | `gemini-3-flash-preview` |

Both run on the Google AI Studio free tier. No billing needs to be enabled.

---

## 🌟 Key Highlights

- **Genuine Live API Voice Dialogue**: Not speech-to-text bolted onto a text model. The browser streams 16 kHz PCM microphone audio over a Live API WebSocket and plays back the model's own 24 kHz speech, with real barge-in — talk over the assistant and it stops mid-sentence. The waveform visualizer is driven by the actual microphone signal.
- **Mid-Conversation Tool Calling (Core Showcase)**: Rather than acting as a static chatbot, the assistant calls structured Gemini tools over the live socket while the patient is still speaking:
  - `record_symptom`: Extracts symptom name, anatomical region, severity rating (1–10), onset, duration, character, and radiation.
  - `flag_triage_red_flag`: Alarms critical emergency symptoms (e.g., crushing chest pain radiating to jaw, severe sudden headache, respiratory distress) with clinical rationale and STAT actions.
  - `record_patient_history`: Captures allergies, active medications, chronic conditions, and past surgeries.
  - `update_clinical_assessment`: Synthesizes provisional impressions and differential diagnoses.
  - `generate_doctor_handoff`: Compiles the finalized clinical SOAP note for physician consultation.
- **Live Clinical Extraction Dashboard**: Side-by-side real-time extractor featuring an **Interactive Anatomical Body Map**, dynamic triage urgency status (Routine / Urgent / Emergency), and severity rating bars.
- **Standardized Doctor Handoff (SOAP Note)**:
  - **S (Subjective)**: Chief Complaint, HPI narrative, symptom review.
  - **O (Objective)**: Observed and reported vitals, distress level, pain score.
  - **A (Assessment)**: Differential diagnoses with clinical probabilities.
  - **P (Plan)**: Suggested diagnostic lab orders (e.g. 12-lead ECG, Troponin, CT, CBC), physician examination checklist.
  - Export to Markdown (EHR format) or Print/PDF.
- **Speaks the Patient's Language, Records in English**: Language is detected
  automatically by the Live API — no picker, no configuration. If a patient
  describes their symptoms in Hindi, Spanish, Arabic or any of the ~24 input
  languages the Live API accepts, the assistant *speaks back in that language*.
  Everything clinical, however, is recorded in English: the system instruction
  forces every tool call (symptom names, anatomical regions, red-flag rationale,
  the SOAP note) into English, because the physician reading the handoff may not
  share the patient's language. The on-screen transcript is normalised to English
  too, via `POST /api/intake/translate`, with the original utterance kept
  underneath it for the record.
- **Mobile-First Responsive**: Built phone-up, not desktop-down. Single-column
  below `lg` and a 12-column split above it; 44px minimum tap targets;
  `svh` units so the iOS URL bar cannot crush the conversation; `text-base`
  inputs so iOS does not zoom on focus; and on the handoff view a sticky action
  bar with the HPI and full SOAP note collapsed by default, so a clinician sees
  chief complaint, red flags and triage without scrolling.
- **NSOffice Glass UI System** — all tokens live in one place, the `@theme`
  block at the top of [`src/index.css`](src/index.css). No component references
  a raw Tailwind palette colour or a hex literal.
  - **One accent colour**: Electric Blue (`#0062FF`). Every interactive,
    branded or emphasised element uses it — buttons, tabs, focus rings, the
    waveform, links, success ticks and the routine triage state.
  - **Status colours are signal, never style**: `critical` and `caution`
    (Apple's dark-mode system red/amber) appear *only* on clinical severity —
    red-flag findings, triage urgency, high symptom scores, allergy warnings —
    and on system failure. They never touch chrome. A routine, low-severity
    state is Electric Blue, because "nothing is wrong" is not a warning.
  - **Typography**: DM Sans throughout, with JetBrains Mono reserved for
    tabular data (timestamps, tool names, IDs).
  - **Spacing**: Apple-style breathing room, liquid-glass frosted panels
    (`backdrop-blur-xl`) via the `.glass-panel` family.
  - **One primary action per view**: enforced by the `.ns-btn-primary` /
    `.ns-btn-secondary` / `.ns-btn-ghost` primitives. In the intake view the
    microphone is primary while the session runs and the handoff button is
    secondary; once the session ends with data, the two swap, so exactly one
    filled button is ever on screen.
  - **JS-drawn surfaces** (the anatomical SVG and the canvas waveform) read the
    same tokens at runtime through [`src/utils/theme.ts`](src/utils/theme.ts),
    so the palette has a single source of truth.

---

## 🚀 Quick Start (Local Setup)

### 1. Prerequisites
- **Node.js** v20 or newer
- **npm**
- A **Gemini API key** from [Google AI Studio](https://aistudio.google.com/) (free tier; no billing required)
- **Chrome** — the live voice path needs `AudioWorklet` and `getUserMedia`

### 2. Clone and install
```bash
git clone https://github.com/Vaishbvaish/Live-Health-Intake-Assistant.git
cd Live-Health-Intake-Assistant
npm install
```

### 3. Configure environment variables
```bash
cp .env.example .env
```

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `GEMINI_API_KEY` | **yes** | — | Server-side key. Never sent to the browser. |
| `GEMINI_VAD_SILENCE_MS` | no | `900` | Silence before the assistant decides the patient finished speaking. Lower is snappier; too low and it talks over people. |
| `GEMINI_LIVE_MODEL` | no | `gemini-3.1-flash-live-preview` | Live API model for the voice conversation. |
| `GEMINI_TEXT_MODEL` | no | `gemini-3-flash-preview` | Turn-based model for SOAP synthesis. |
| `PORT` | no | `3000` | Local dev server port. |

> `.env` is matched by `.gitignore` and is never committed.

### 4. Run it
```bash
npm run dev
```
Open <http://localhost:3000>, click the microphone, and wait for the status pill
to read **Microphone Live** before speaking.

Other commands:
```bash
npm run build   # production build into dist/
npm run lint    # typecheck (tsc --noEmit)
```

---

## ☁️ Deployment (Vercel, free tier)

The app is deliberately structured so it needs **no always-on server**. The
realtime connection is browser-to-Gemini over a WebSocket, authorised by a
short-lived token, so the only backend is two stateless functions:

```
api/live/token.ts       mints the single-use Live API ephemeral token
api/intake/handoff.ts   compiles the physician SOAP note
api/intake/translate.ts normalises a non-English assistant turn to English
                        for the on-screen transcript
api/health.ts           deployment diagnostics (see below)
lib/clinical.ts         tool declarations + system prompt, shared by both
                        the functions and the local dev server
```

`server.ts` is local development only — Vercel never runs it.

1. **Push to GitHub** (the repo must be public for the assignment):
   ```bash
   git add .
   git commit -m "feat: NSOffice Live Health Intake Assistant"
   git push origin main
   ```
2. **Import the repo** at [vercel.com/new](https://vercel.com/new). The Vite
   preset and `api/` functions are picked up from `vercel.json`; no build
   settings need changing.
3. **Add the environment variable** under **Settings → Environment Variables**:
   - `GEMINI_API_KEY` = your AI Studio key (apply to Production, Preview and Development)
4. **Deploy.** Then open the URL, click the microphone and grant access —
   `getUserMedia` requires HTTPS, which Vercel provides automatically.

> If the build fails on function duration, lower `functions["api/**/*.ts"].maxDuration`
> in `vercel.json` to whatever your plan allows. SOAP synthesis usually
> finishes in 10-20s.

### Checking a deployment

`GET /api/health` answers without calling Gemini, so it separates a runtime
problem from an upstream one:

```bash
curl https://<your-app>.vercel.app/api/health
curl "https://<your-app>.vercel.app/api/health?probe=1"   # also mints a real token
```

| Result | Meaning |
| --- | --- |
| `/api/health` times out | The function runtime itself is failing — check the Vercel function logs. |
| `keyPresent: false` | `GEMINI_API_KEY` is missing for this environment; add it and redeploy. |
| `probe: "failed"` | Runtime is fine, the Gemini call is not. `probeError` says why. |
| `probe: "ok"` | Everything the server does is working. |

No secret is ever returned — only whether a key is present and its length.

---

## 🩺 Preloaded Clinical Test Scenarios

To help reviewers and clients test immediately even without a microphone:
1. **Acute Crushing Chest Pain (Cardiovascular / ACS Rule-Out)**
2. **Severe Throbbing Migraine with Visual Aura (Neurological)**
3. **Acute Right Lower Quadrant Pain (Gastrointestinal / Appendicitis Rule-Out)**
4. **Acute Dyspnea & Bronchospasm (Respiratory / Asthma Flare)**
5. **Lumbar Strain with Sciatic Radiculopathy (Musculoskeletal)**

Press the microphone button once to open the live session, then click any
scenario at the top of the conversation stream to send it as a patient turn.
If the microphone is unavailable or denied, the session still opens in
text-only mode so the scenarios and the typed input remain usable.

---

## 📂 Project Architecture

```
├── api/                        # Vercel serverless functions (production backend)
│   ├── live/token.ts               # Mints the single-use Live API ephemeral token
│   ├── intake/handoff.ts           # Compiles the physician SOAP note
│   ├── intake/translate.ts         # Normalises a non-English turn to English
│   └── health.ts                   # Deployment diagnostics, no secret returned
├── lib/
│   └── clinical.ts             # Tool declarations, system prompt & service calls,
│                               # shared by the functions and the dev server
├── server.ts                   # Local dev only: Vite middleware + the same routes
├── vercel.json                 # Vite preset, function config, SPA rewrite
├── src/
│   ├── components/
│   │   ├── Header.tsx                 # NSOffice branded header & triage status
│   │   ├── DialogueStream.tsx         # Voice dialogue, tool call badges, & mic toggle
│   │   ├── ClinicalExtractionPanel.tsx # Live auto-updating clinical feed & vitals
│   │   ├── AnatomicalMap.tsx          # Interactive SVG anatomical symptom locator
│   │   ├── VoiceVisualizer.tsx        # Canvas waveform driven by real mic amplitude
│   │   └── DoctorHandoffView.tsx      # Standardized SOAP note & physician sign-off
│   ├── data/
│   │   └── clinicalScenarios.ts       # Clinical test cases & prompt presets
│   ├── types/
│   │   └── clinical.ts                # TypeScript clinical data models & schemas
│   ├── utils/
│   │   ├── liveClient.ts              # Gemini Live API session: mic, playback, tools
│   │   ├── audio.ts                   # PCM16 encode/decode, capture worklet, playback queue
│   │   ├── language.ts                # English detection + transcript translation
│   │   ├── theme.ts                   # Reads the CSS design tokens for JS-drawn surfaces
│   │   └── toolSummary.ts             # Human-readable tool-call badge text
│   ├── App.tsx                        # Main state orchestrator
│   ├── index.css                      # NSOffice glass UI tokens & DM Sans configuration
│   └── main.tsx                       # React application root
├── index.html                  # HTML entry point with DM Sans & SEO metadata
├── metadata.json               # AI Studio application metadata
└── package.json                # Project dependencies and full-stack scripts
```

---

## 🔒 Security & Privacy

- `GEMINI_API_KEY` never reaches the browser. The Live API needs a direct
  WebSocket from the client, so `POST /api/live/token` mints a **single-use
  ephemeral token** (2-minute window to connect, 30-minute session cap) with the
  model, system instruction and clinical tool declarations locked in server-side.
  The browser can speak to the session but cannot change its clinical behaviour.
- The turn-based SOAP synthesis and translation calls run entirely server-side
  (`api/intake/*` on Vercel, the same handlers behind `server.ts` locally). The
  raw key is read only there, never serialised into a response.
- If the key is missing or a call fails, the UI shows the error. It never
  substitutes invented clinical content for a real model response.
