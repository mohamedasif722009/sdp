import { SignalStats } from '../types';

export interface AnalyzedAudioBuffer {
  stats: SignalStats;
  waveformPeaks: number[];
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Could not read audio data.'));
        return;
      }
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(new Error('Failed to encode audio file.'));
    reader.readAsDataURL(blob);
  });
}

export function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteChars = atob(base64);
  const byteNumbers = new Array<number>(byteChars.length);
  for (let i = 0; i < byteChars.length; i += 1) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

export async function analyzeAudioBlob(blob: Blob): Promise<AnalyzedAudioBuffer> {
  const arrayBuffer = await blob.arrayBuffer();
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();

  try {
    const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const channelData = decoded.getChannelData(0);
    const sampleRate = decoded.sampleRate;
    const durationSec = decoded.duration;

    // Build 84 normalized waveform peaks for static preview
    const barCount = 84;
    const blockSize = Math.max(1, Math.floor(channelData.length / barCount));
    const waveformPeaks: number[] = [];
    for (let i = 0; i < barCount; i += 1) {
      const start = i * blockSize;
      const end = Math.min(channelData.length, start + blockSize);
      let peak = 0;
      for (let j = start; j < end; j += 1) {
        const abs = Math.abs(channelData[j]);
        if (abs > peak) peak = abs;
      }
      waveformPeaks.push(Math.min(1, peak));
    }

    // Frame-level RMS & zero-crossing variance (30ms windows)
    const frameLen = Math.max(256, Math.floor(sampleRate * 0.03));
    const frameRms: number[] = [];
    const frameZcr: number[] = [];

    let totalSq = 0;
    for (let i = 0; i < channelData.length; i += 1) {
      totalSq += channelData[i] * channelData[i];
    }
    const rmsLevel = Math.sqrt(totalSq / Math.max(1, channelData.length));

    let quietFrames = 0;
    const silenceThreshold = Math.max(0.008, rmsLevel * 0.22);

    for (let start = 0; start + frameLen <= channelData.length; start += frameLen) {
      let sq = 0;
      let crossings = 0;
      let prev = channelData[start];
      for (let k = start; k < start + frameLen; k += 1) {
        const val = channelData[k];
        sq += val * val;
        if ((val >= 0 && prev < 0) || (val < 0 && prev >= 0)) {
          crossings += 1;
        }
        prev = val;
      }
      const rms = Math.sqrt(sq / frameLen);
      frameRms.push(rms);
      if (rms < silenceThreshold) {
        quietFrames += 1;
      } else {
        frameZcr.push(crossings / frameLen);
      }
    }

    const pauseRatio = frameRms.length > 0 ? quietFrames / frameRms.length : 0;

    // Compute variance of ZCR on voiced/active frames as a rough prosody/pitch variability signal
    let pitchVariationScore = 0;
    if (frameZcr.length > 1) {
      const meanZcr = frameZcr.reduce((a, b) => a + b, 0) / frameZcr.length;
      const variance =
        frameZcr.reduce((acc, v) => acc + (v - meanZcr) * (v - meanZcr), 0) / frameZcr.length;
      pitchVariationScore = Math.min(100, Math.sqrt(variance) * 900);
    }

    // Compute simple energy flatness (geometric mean / arithmetic mean of frame RMS)
    const activeRms = frameRms.filter((r) => r > 0.0005);
    let spectralFlatness = 0;
    if (activeRms.length > 0) {
      const logSum = activeRms.reduce((acc, v) => acc + Math.log(v), 0);
      const geoMean = Math.exp(logSum / activeRms.length);
      const arithMean = activeRms.reduce((a, b) => a + b, 0) / activeRms.length;
      spectralFlatness = arithMean > 0 ? Math.min(1, geoMean / arithMean) : 0;
    }

    return {
      stats: {
        durationSec,
        rmsLevel,
        pauseRatio,
        pitchVariationScore,
        spectralFlatness,
      },
      waveformPeaks,
    };
  } finally {
    await ctx.close().catch(() => undefined);
  }
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00.0';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const tenths = Math.floor((seconds % 1) * 10);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`;
}
