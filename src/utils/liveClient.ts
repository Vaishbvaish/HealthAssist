

import { GoogleGenAI, type FunctionCall, type LiveServerMessage, type Session } from '@google/genai';
import {
  LIVE_INPUT_SAMPLE_RATE,
  PcmPlayer,
  decodePcm16,
  encodePcm16,
  loadMicWorklet,
} from './audio';

export type LiveStatus = 'idle' | 'connecting' | 'live' | 'closed' | 'error';

export interface LiveIntakeCallbacks {
  
  onStatus: (status: LiveStatus) => void;
  
  onUserTranscript: (text: string, isFinal: boolean) => void;
  
  onAssistantTranscript: (text: string, isFinal: boolean) => void;
  
  onToolCalls: (calls: FunctionCall[]) => void;
  
  onSpeakingChange: (speaking: boolean) => void;
  
  onMicState: (active: boolean) => void;
  
  onLevel: (level: number) => void;
  
  onError: (message: string) => void;
}

interface TokenResponse {
  token: string;
  model: string;
  apiVersion: string;
  
  usableUntil: number;
}


let pending: Promise<TokenResponse> | null = null;
let cached: TokenResponse | null = null;


const TOKEN_GUARD_MS = 20_000;

async function fetchToken(): Promise<TokenResponse> {
  const response = await fetch('/api/live/token', { method: 'POST' });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `Could not mint a Live API token (HTTP ${response.status}). ` +
        `Check that GEMINI_API_KEY is set on the server. ${body}`.trim()
    );
  }

  const data = (await response.json()) as Partial<TokenResponse> & { usableForMs?: number };
  if (!data.token || !data.model) {
    throw new Error('Token endpoint returned an incomplete response.');
  }

  return {
    token: data.token,
    model: data.model,
    apiVersion: data.apiVersion ?? 'v1alpha',
    usableUntil: Date.now() + (data.usableForMs ?? 120_000),
  };
}


export function prewarmLiveToken(): void {
  if (pending) return;
  if (cached && cached.usableUntil - Date.now() > TOKEN_GUARD_MS) return;

  pending = fetchToken()
    .then((t) => {
      cached = t;
      return t;
    })
    .catch(() => {
      cached = null;
      throw new Error('prewarm failed');
    })
    .finally(() => {
      pending = null;
    });

  pending.catch(() => undefined);
}

export class LiveIntakeSession {
  private callbacks: LiveIntakeCallbacks;
  private session: Session | null = null;
  private player: PcmPlayer;

  private micStream: MediaStream | null = null;
  private micContext: AudioContext | null = null;
  private micNode: AudioWorkletNode | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;

  private status: LiveStatus = 'idle';
  private speaking = false;

  private userTurn = '';
  private assistantTurn = '';

  constructor(callbacks: LiveIntakeCallbacks) {
    this.callbacks = callbacks;
    this.player = new PcmPlayer(() => this.setSpeaking(false));
  }

  get isLive(): boolean {
    return this.status === 'live';
  }

  private setStatus(status: LiveStatus): void {
    this.status = status;
    this.callbacks.onStatus(status);
  }

  private setSpeaking(speaking: boolean): void {
    if (this.speaking === speaking) return;
    this.speaking = speaking;
    this.callbacks.onSpeakingChange(speaking);
  }

  
  async start(): Promise<void> {
    if (this.status === 'connecting' || this.status === 'live') return;
    this.setStatus('connecting');

    try {
      void this.startMicrophone().then(
        () => {
          this.callbacks.onMicState(true);
        },
        (micError: unknown) => {
          this.callbacks.onMicState(false);
          const reason = micError instanceof Error ? micError.message : String(micError);
          this.callbacks.onError(
            `Microphone unavailable (${reason}). Continuing in text-only mode — ` +
              'you can still type or run a preset clinical scenario.'
          );
        }
      );

      const [{ token, model, apiVersion }] = await Promise.all([
        this.mintToken(),
        this.player.unlock(),
      ]);

      const ai = new GoogleGenAI({
        apiKey: token,
        httpOptions: { apiVersion },
      });

      this.session = await ai.live.connect({
        model,
        callbacks: {
          onopen: () => undefined,
          onmessage: (message) => this.handleMessage(message),
          onerror: (event) => {
            this.callbacks.onError(
              `Live API connection error: ${event?.message ?? 'unknown transport failure'}`
            );
            this.setStatus('error');
            void this.stop();
          },
          onclose: () => {
            if (this.status !== 'error') this.setStatus('closed');
            void this.stop();
          },
        },
      });
    } catch (error) {
      await this.teardownAudio();
      const detail = error instanceof Error ? error.message : String(error);
      this.callbacks.onError(detail);
      this.setStatus('error');
    }
  }

  
  private async mintToken(): Promise<TokenResponse> {
    if (cached && cached.usableUntil - Date.now() > TOKEN_GUARD_MS) {
      const token = cached;
      cached = null;
      return token;
    }

    if (pending) {
      try {
        const token = await pending;
        cached = null;
        if (token.usableUntil - Date.now() > TOKEN_GUARD_MS) return token;
      } catch {
      }
    }

    return fetchToken();
  }

  private async startMicrophone(): Promise<void> {
    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    this.micContext = new AudioContext({ sampleRate: LIVE_INPUT_SAMPLE_RATE });
    if (this.micContext.state === 'suspended') {
      await this.micContext.resume();
    }

    await loadMicWorklet(this.micContext);

    this.micSource = this.micContext.createMediaStreamSource(this.micStream);
    this.micNode = new AudioWorkletNode(this.micContext, 'mic-capture');

    this.micNode.port.onmessage = (event: MessageEvent) => {
      const { samples, level } = event.data as { samples: Float32Array; level: number };
      this.callbacks.onLevel(level);

      if (!this.session || this.status !== 'live') return;
      this.session.sendRealtimeInput({
        audio: {
          data: encodePcm16(samples),
          mimeType: `audio/pcm;rate=${LIVE_INPUT_SAMPLE_RATE}`,
        },
      });
    };

    this.micSource.connect(this.micNode);
    this.micNode.connect(this.micContext.destination);
  }

  private handleMessage(message: LiveServerMessage): void {
    if (message.setupComplete) {
      this.setStatus('live');
      this.sendLanguagePrimer();
    }

    const content = message.serverContent;

    if (content?.interrupted) {
      this.player.stop();
      this.setSpeaking(false);
      if (this.assistantTurn.trim()) {
        this.callbacks.onAssistantTranscript(this.assistantTurn.trim(), true);
        this.assistantTurn = '';
      }
    }

    const interim = content?.interimInputTranscription?.text;
    if (interim) {
      this.callbacks.onUserTranscript(interim, false);
    }

    const userText = content?.inputTranscription?.text;
    if (userText) {
      this.userTurn += userText;
      this.callbacks.onUserTranscript(this.userTurn, false);
    }

    const assistantText = content?.outputTranscription?.text;
    if (assistantText) {
      this.assistantTurn += assistantText;
      this.callbacks.onAssistantTranscript(this.assistantTurn, false);
    }

    for (const part of content?.modelTurn?.parts ?? []) {
      const audio = part.inlineData?.data;
      if (audio) {
        this.player.enqueue(decodePcm16(audio));
        this.setSpeaking(true);
      }
    }

    if (message.toolCall?.functionCalls?.length) {
      this.handleToolCalls(message.toolCall.functionCalls);
    }

    if (content?.generationComplete || content?.turnComplete) {
      this.flushTurns();
    }
  }

  
  private flushTurns(): void {
    if (this.userTurn.trim()) {
      this.callbacks.onUserTranscript(this.userTurn.trim(), true);
      this.userTurn = '';
    }
    if (this.assistantTurn.trim()) {
      this.callbacks.onAssistantTranscript(this.assistantTurn.trim(), true);
      this.assistantTurn = '';
    }
  }

  
  private handleToolCalls(calls: FunctionCall[]): void {
    this.callbacks.onToolCalls(calls);

    this.session?.sendToolResponse({
      functionResponses: calls.map((call) => ({
        id: call.id,
        name: call.name,
        response: { status: 'recorded', recordedAt: new Date().toISOString() },
      })),
    });
  }

  
  private sendLanguagePrimer(): void {
    if (!this.session) return;
    this.session.sendClientContent({
      turns: [
        {
          role: 'user',
          parts: [
            {
              text: '[SYSTEM: The patient has not spoken yet. Do NOT greet them yet. Wait silently for the patient to speak first. When they do, detect their language from their very first words and respond ONLY in that language. If they speak Hindi, greet and respond in Hindi. If they speak English, respond in English. If they speak any other language, respond in that language. Never default to English unless the patient speaks English.]',
            },
          ],
        },
        {
          role: 'model',
          parts: [
            {
              text: '[Understood. I will wait for the patient to speak and then respond in their language.]',
            },
          ],
        },
      ],
      turnComplete: true,
    });
  }

  sendText(text: string): void {
    if (!this.session) return;
    this.player.stop();
    this.setSpeaking(false);
    this.session.sendClientContent({
      turns: [{ role: 'user', parts: [{ text }] }],
      turnComplete: true,
    });
  }

  
  interrupt(): void {
    this.player.stop();
    this.setSpeaking(false);
  }

  async stop(): Promise<void> {
    await this.teardownAudio();

    if (this.session) {
      try {
        this.session.close();
      } catch {
      }
      this.session = null;
    }

    this.flushTurns();
    this.setSpeaking(false);

    if (this.status !== 'error') this.setStatus('idle');
  }

  private async teardownAudio(): Promise<void> {
    this.player.stop();

    if (this.micNode) {
      this.micNode.port.onmessage = null;
      this.micNode.disconnect();
      this.micNode = null;
    }
    if (this.micSource) {
      this.micSource.disconnect();
      this.micSource = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }
    if (this.micContext) {
      await this.micContext.close().catch(() => undefined);
      this.micContext = null;
    }

    this.callbacks.onLevel(0);
    this.callbacks.onMicState(false);
  }
}
