import { SignalStats } from '../types';

export interface AnalyzedAudioBuffer {
  stats: SignalStats;
  waveformPeaks: number[];
  wavFallbackBlob: Blob | null;
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

export function inferAudioMimeType(fileName: string, rawType: string): string {
  const cleaned = rawType.split(';')[0].trim().toLowerCase();
  if (cleaned && cleaned !== 'application/octet-stream') {
    if (cleaned === 'audio/x-wav' || cleaned === 'audio/wave') return 'audio/wav';
    if (cleaned === 'audio/mpeg' || cleaned === 'audio/mp3') return 'audio/mp3';
    if (cleaned === 'audio/x-m4a' || cleaned === 'audio/m4a' || cleaned === 'video/mp4') {
      return 'audio/mp4';
    }
    if (cleaned === 'video/webm') return 'audio/webm';
    if (cleaned.startsWith('audio/')) return cleaned;
  }
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.mp3') || lower.endsWith('.mpeg')) return 'audio/mp3';
  if (lower.endsWith('.ogg') || lower.endsWith('.opus')) return 'audio/ogg';
  if (lower.endsWith('.webm')) return 'audio/webm';
  if (lower.endsWith('.flac')) return 'audio/flac';
  if (lower.endsWith('.aac')) return 'audio/aac';
  if (lower.endsWith('.m4a') || lower.endsWith('.mp4') || lower.endsWith('.mov')) return 'audio/mp4';
  return 'audio/wav';
}

function encodeAudioBufferToWav(
  decoded: AudioBuffer,
  maxDurationSec = 20,
  startSec = 0,
  endSec?: number
): Blob {
  const targetRate = Math.min(16000, decoded.sampleRate);
  const clampedStart = Math.max(0, Math.min(startSec, Math.max(0, decoded.duration - 0.2)));
  const rawEnd = endSec !== undefined ? Math.min(endSec, decoded.duration) : decoded.duration;
  const usableDuration = Math.min(Math.max(0.2, rawEnd - clampedStart), maxDurationSec);
  const startSample = Math.floor(clampedStart * decoded.sampleRate);
  const inputLength = Math.max(1, Math.floor(usableDuration * decoded.sampleRate));
  const outputLength = Math.max(1, Math.floor(usableDuration * targetRate));
  const numChannels = Math.max(1, decoded.numberOfChannels);

  // Mix down to mono from clampedStart
  const mono = new Float32Array(inputLength);
  for (let ch = 0; ch < numChannels; ch += 1) {
    const chData = decoded.getChannelData(ch);
    for (let i = 0; i < inputLength; i += 1) {
      const srcIdx = Math.min(chData.length - 1, startSample + i);
      mono[i] += chData[srcIdx] / numChannels;
    }
  }

  // Resample to targetRate
  const ratio = inputLength / outputLength;
  const dataSize = outputLength * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i += 1) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, targetRate, true);
  view.setUint32(28, targetRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < outputLength; i += 1) {
    const pos = i * ratio;
    const idx = Math.floor(pos);
    const frac = pos - idx;
    const s0 = mono[idx] ?? 0;
    const s1 = mono[Math.min(idx + 1, inputLength - 1)] ?? s0;
    const sample = Math.max(-1, Math.min(1, s0 + (s1 - s0) * frac));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

export async function trimAudioBlobToWav(
  blob: Blob,
  startSec: number,
  endSec: number
): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  try {
    const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
    return encodeAudioBufferToWav(decoded, 30, startSec, endSec);
  } finally {
    await ctx.close().catch(() => undefined);
  }
}

export async function analyzeAudioBlob(blob: Blob): Promise<AnalyzedAudioBuffer> {
  const arrayBuffer = await blob.arrayBuffer();
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();

  try {
    const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const channelData = decoded.getChannelData(0);
    const sampleRate = decoded.sampleRate;
    const durationSec = decoded.duration;

    // Build 84 normalized waveform peaks across the whole clip (strided for instant speed)
    const barCount = 84;
    const blockSize = Math.max(1, Math.floor(channelData.length / barCount));
    const stride = Math.max(1, Math.floor(blockSize / 64));
    const waveformPeaks: number[] = [];
    for (let i = 0; i < barCount; i += 1) {
      const start = i * blockSize;
      const end = Math.min(channelData.length, start + blockSize);
      let peak = 0;
      for (let j = start; j < end; j += stride) {
        const abs = Math.abs(channelData[j]);
        if (abs > peak) peak = abs;
      }
      waveformPeaks.push(Math.min(1, peak));
    }

    // Analyze up to first 25s for sub-10ms local telemetry computation
    const analyzeLength = Math.min(channelData.length, Math.floor(sampleRate * 25));
    const frameLen = Math.max(256, Math.floor(sampleRate * 0.03));
    const frameRms: number[] = [];
    const frameZcr: number[] = [];

    let totalSq = 0;
    for (let i = 0; i < analyzeLength; i += 2) {
      totalSq += channelData[i] * channelData[i];
    }
    const rmsLevel = Math.sqrt(totalSq / Math.max(1, Math.ceil(analyzeLength / 2)));

    let quietFrames = 0;
    const silenceThreshold = Math.max(0.008, rmsLevel * 0.22);

    for (let start = 0; start + frameLen <= analyzeLength; start += frameLen) {
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

    let pitchVariationScore = 0;
    if (frameZcr.length > 1) {
      const meanZcr = frameZcr.reduce((a, b) => a + b, 0) / frameZcr.length;
      const variance =
        frameZcr.reduce((acc, v) => acc + (v - meanZcr) * (v - meanZcr), 0) / frameZcr.length;
      pitchVariationScore = Math.min(100, Math.sqrt(variance) * 900);
    }

    const activeRms = frameRms.filter((r) => r > 0.0005);
    let spectralFlatness = 0;
    if (activeRms.length > 0) {
      const logSum = activeRms.reduce((acc, v) => acc + Math.log(v), 0);
      const geoMean = Math.exp(logSum / activeRms.length);
      const arithMean = activeRms.reduce((a, b) => a + b, 0) / activeRms.length;
      spectralFlatness = arithMean > 0 ? Math.min(1, geoMean / arithMean) : 0;
    }

    let wavFallbackBlob: Blob | null = null;
    try {
      wavFallbackBlob = encodeAudioBufferToWav(decoded, 20);
    } catch {
      wavFallbackBlob = null;
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
      wavFallbackBlob,
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
