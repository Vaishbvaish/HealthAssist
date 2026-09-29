export const LIVE_INPUT_SAMPLE_RATE = 16000;
export const LIVE_OUTPUT_SAMPLE_RATE = 24000;

const FRAME_SIZE = 512;

const MIC_WORKLET_SOURCE = `
class MicCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = new Float32Array(${FRAME_SIZE});
    this._offset = 0;
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel) return true;

    for (let i = 0; i < channel.length; i++) {
      this._buffer[this._offset++] = channel[i];

      if (this._offset === this._buffer.length) {
        let peak = 0;
        for (let j = 0; j < this._buffer.length; j++) {
          const abs = this._buffer[j] < 0 ? -this._buffer[j] : this._buffer[j];
          if (abs > peak) peak = abs;
        }
        this.port.postMessage({ samples: this._buffer.slice(0), level: peak });
        this._offset = 0;
      }
    }
    return true;
  }
}
registerProcessor('mic-capture', MicCaptureProcessor);
`;

let workletUrl: string | null = null;

export async function loadMicWorklet(ctx: AudioContext): Promise<void> {
  if (!workletUrl) {
    workletUrl = URL.createObjectURL(
      new Blob([MIC_WORKLET_SOURCE], { type: 'application/javascript' })
    );
  }
  await ctx.audioWorklet.addModule(workletUrl);
}

export function encodePcm16(samples: Float32Array): string {
  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    pcm[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }

  const bytes = new Uint8Array(pcm.buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export function decodePcm16(base64: string): Float32Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const pcm = new Int16Array(bytes.buffer, 0, bytes.length >> 1);
  const samples = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) {
    samples[i] = pcm[i] / 0x8000;
  }
  return samples;
}

export class PcmPlayer {
  private ctx: AudioContext | null = null;
  private cursor = 0;
  private active = new Set<AudioBufferSourceNode>();
  private onIdle: (() => void) | null = null;

  constructor(onIdle?: () => void) {
    this.onIdle = onIdle ?? null;
  }

  private context(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext({ sampleRate: LIVE_OUTPUT_SAMPLE_RATE });
    }
    return this.ctx;
  }

  async unlock(): Promise<void> {
    const ctx = this.context();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
  }

  enqueue(samples: Float32Array<ArrayBuffer>): void {
    if (samples.length === 0) return;

    const ctx = this.context();
    const buffer = ctx.createBuffer(1, samples.length, LIVE_OUTPUT_SAMPLE_RATE);
    buffer.copyToChannel(samples, 0);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    this.cursor = Math.max(this.cursor, ctx.currentTime);
    source.start(this.cursor);
    this.cursor += buffer.duration;

    this.active.add(source);
    source.onended = () => {
      this.active.delete(source);
      if (this.active.size === 0) this.onIdle?.();
    };
  }

  stop(): void {
    for (const source of this.active) {
      source.onended = null;
      try {
        source.stop();
      } catch {
      }
    }
    this.active.clear();
    this.cursor = 0;
    this.onIdle?.();
  }

  get isPlaying(): boolean {
    return this.active.size > 0;
  }

  async close(): Promise<void> {
    this.stop();
    if (this.ctx) {
      await this.ctx.close();
      this.ctx = null;
    }
  }
}
