import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileAudio,
  HelpCircle,
  Loader2,
  Mic,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Square,
  Upload,
  Volume2,
} from 'lucide-react';
import {
  GeneratedSampleResponse,
  SignalStats,
  VoiceAnalysisResult,
} from '../types';
import {
  analyzeAudioBlob,
  base64ToBlob,
  blobToBase64,
  formatDuration,
} from '../utils/audioAnalysis';

type InputMode = 'record' | 'upload' | 'sample';

interface SessionCheckItem {
  id: string;
  label: string;
  source: InputMode;
  verdict: VoiceAnalysisResult['verdict'];
  confidence: number;
  durationSec: number;
  result: VoiceAnalysisResult;
  stats: SignalStats | null;
  waveformPeaks: number[];
  audioUrl: string;
}

const SAMPLE_PROMPTS = [
  "Hey, it's me — can you verify our family safe word before I send anything?",
  'Hi Professor, I wanted to double-check our lab meeting time for tomorrow.',
];

const AI_TEST_SCENARIOS = [
  {
    id: 'friend_emergency',
    title: 'Fake Friend Emergency',
    detail: 'Urgent cash request claiming dead phone battery',
  },
  {
    id: 'campus_aid',
    title: 'Fake Financial Aid Desk',
    detail: 'Demands portal one-time passcode within 10 minutes',
  },
  {
    id: 'parent_check',
    title: 'Fake Parent Travel Call',
    detail: 'Claims bank card failed at airport terminal',
  },
];

export const VoiceChecker: React.FC = () => {
  const [mode, setMode] = useState<InputMode>('record');

  // Audio clip state
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [clipLabel, setClipLabel] = useState<string>('');
  const [clipNote, setClipNote] = useState<string>('');
  const [waveformPeaks, setWaveformPeaks] = useState<number[]>([]);
  const [signalStats, setSignalStats] = useState<SignalStats | null>(null);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [playProgress, setPlayProgress] = useState(0);

  // Analysis & sample generation state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingSample, setIsGeneratingSample] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [result, setResult] = useState<VoiceAnalysisResult | null>(null);
  const [history, setHistory] = useState<SessionCheckItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const recordTimerRef = useRef<number | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const stopRecordingResources = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (recordTimerRef.current !== null) {
      window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => undefined);
      audioCtxRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopRecordingResources();
    };
  }, [stopRecordingResources]);

  // Draw live oscilloscope while recording
  const drawLiveWaveform = useCallback((analyser: AnalyserNode) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      analyser.getByteTimeDomainData(dataArray);
      const width = canvas.width;
      const height = canvas.height;

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);

      // Subtle center baseline
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      // Waveform line
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#0284C7';
      ctx.beginPath();

      const sliceWidth = width / bufferLength;
      let x = 0;
      for (let i = 0; i < bufferLength; i += 1) {
        const v = dataArray[i] / 128.0;
        const y = (v * height) / 2;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();
  }, []);

  const runAnalysis = useCallback(
    async (
      blobToAnalyze: Blob,
      label: string,
      sourceMode: InputMode,
      computedStats: SignalStats | null,
      peaks: number[],
      urlForHistory: string
    ) => {
      setIsAnalyzing(true);
      setAnalysisError(null);
      setResult(null);

      try {
        const audioBase64 = await blobToBase64(blobToAnalyze);
        const response = await fetch('/api/analyze-voice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioBase64,
            mimeType: blobToAnalyze.type || 'audio/webm',
            signalStats: computedStats,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Could not analyze audio clip.');
        }

        const analyzed = data as VoiceAnalysisResult;
        setResult(analyzed);

        setHistory((prev) => [
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            label,
            source: sourceMode,
            verdict: analyzed.verdict,
            confidence: analyzed.confidence,
            durationSec: computedStats?.durationSec ?? 0,
            result: analyzed,
            stats: computedStats,
            waveformPeaks: peaks,
            audioUrl: urlForHistory,
          },
          ...prev.slice(0, 4),
        ]);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Analysis failed. Please try again.';
        setAnalysisError(msg);
      } finally {
        setIsAnalyzing(false);
      }
    },
    []
  );

  const loadAudioClip = useCallback(
    async (
      blob: Blob,
      label: string,
      note: string,
      sourceMode: InputMode,
      autoAnalyze: boolean
    ) => {
      if (audioElRef.current) {
        audioElRef.current.pause();
      }
      setIsPlaying(false);
      setPlayProgress(0);
      setAnalysisError(null);
      setResult(null);

      const url = URL.createObjectURL(blob);
      setAudioBlob(blob);
      setAudioUrl(url);
      setClipLabel(label);
      setClipNote(note);

      let stats: SignalStats | null = null;
      let peaks: number[] = [];

      try {
        const decoded = await analyzeAudioBlob(blob);
        stats = decoded.stats;
        peaks = decoded.waveformPeaks;
        setSignalStats(stats);
        setWaveformPeaks(peaks);
      } catch {
        // Some browser/file formats may not decode cleanly via decodeAudioData;
        // still allow server-side Gemini audio inspection.
        const fallbackPeaks = Array.from({ length: 84 }, (_, idx) =>
          0.18 + Math.abs(Math.sin(idx * 0.45)) * 0.45
        );
        peaks = fallbackPeaks;
        setWaveformPeaks(fallbackPeaks);
        setSignalStats(null);
      }

      if (autoAnalyze) {
        await runAnalysis(blob, label, sourceMode, stats, peaks, url);
      }
    },
    [runAnalysis]
  );

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    stopRecordingResources();
  }, [stopRecordingResources]);

  const startRecording = async () => {
    setMicError(null);
    setAnalysisError(null);
    setResult(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setMicError('Microphone recording is not supported in this browser. Try uploading an audio file or testing an AI sample.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const AudioCtx =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);

      const preferredTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
      const mimeType = preferredTypes.find((t) => MediaRecorder.isTypeSupported(t)) || '';
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      recordedChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(recordedChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        if (blob.size > 0) {
          await loadAudioClip(
            blob,
            'Live Microphone Recording',
            'Captured directly from your device microphone',
            'record',
            true
          );
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(200);
      setIsRecording(true);
      setRecordingSeconds(0);

      const startTime = Date.now();
      recordTimerRef.current = window.setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        setRecordingSeconds(elapsed);
        if (elapsed >= 30) {
          stopRecording();
        }
      }, 100);

      requestAnimationFrame(() => drawLiveWaveform(analyser));
    } catch {
      setMicError(
        'Microphone access was blocked or unavailable. Allow microphone permission in your browser, or upload an audio clip instead.'
      );
      stopRecordingResources();
    }
  };

  const handleFileSelected = async (file: File) => {
    setMicError(null);
    if (!file.type.startsWith('audio/') && !/\.(wav|mp3|webm|ogg|m4a|aac|flac)$/i.test(file.name)) {
      setAnalysisError('Please choose an audio file (.wav, .mp3, .webm, .ogg, or .m4a).');
      return;
    }
    if (file.size > 18 * 1024 * 1024) {
      setAnalysisError('Audio file is larger than 18 MB. Please upload a shorter clip (under 60 seconds).');
      return;
    }
    await loadAudioClip(
      file,
      file.name,
      `Uploaded audio file · ${(file.size / 1024).toFixed(0)} KB`,
      'upload',
      true
    );
  };

  const handleGenerateSample = async (scenarioId: string) => {
    setMicError(null);
    setAnalysisError(null);
    setIsGeneratingSample(scenarioId);

    try {
      const response = await fetch('/api/generate-sample', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not generate AI voice sample.');
      }

      const sample = data as GeneratedSampleResponse;
      const blob = base64ToBlob(sample.audioBase64, sample.mimeType);
      await loadAudioClip(blob, sample.title, sample.contextNote, 'sample', true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate test clip.';
      setAnalysisError(msg);
    } finally {
      setIsGeneratingSample(null);
    }
  };

  const togglePlay = () => {
    const el = audioElRef.current;
    if (!el || !audioUrl) return;
    if (isPlaying) {
      el.pause();
      setIsPlaying(false);
    } else {
      el.play().catch(() => undefined);
      setIsPlaying(true);
    }
  };

  const resetClip = () => {
    if (isRecording) {
      stopRecording();
    }
    if (audioElRef.current) {
      audioElRef.current.pause();
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setClipLabel('');
    setClipNote('');
    setWaveformPeaks([]);
    setSignalStats(null);
    setResult(null);
    setAnalysisError(null);
    setMicError(null);
    setIsPlaying(false);
    setPlayProgress(0);
  };

  const loadFromHistory = (item: SessionCheckItem) => {
    if (audioElRef.current) {
      audioElRef.current.pause();
    }
    setIsPlaying(false);
    setPlayProgress(0);
    setMode(item.source);
    setAudioUrl(item.audioUrl);
    setClipLabel(item.label);
    setClipNote('Loaded from this session history');
    setWaveformPeaks(item.waveformPeaks);
    setSignalStats(item.stats);
    setResult(item.result);
    setAnalysisError(null);
  };

  const handleModeChange = (nextMode: InputMode) => {
    if (isRecording) {
      stopRecording();
    }
    setMode(nextMode);
    setMicError(null);
    setAnalysisError(null);
  };

  const verdictUi = (() => {
    if (!result) return null;
    if (result.verdict === 'REAL_HUMAN') {
      return {
        container: 'bg-emerald-50/70 border-emerald-200',
        titleColor: 'text-emerald-900',
        badgeText: 'REAL HUMAN VOICE',
        badgeColor: 'text-emerald-700',
        icon: <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0" />,
      };
    }
    if (result.verdict === 'LIKELY_FAKE') {
      return {
        container: 'bg-red-50/70 border-red-200',
        titleColor: 'text-red-900',
        badgeText: 'LIKELY AI CLONE / FAKE',
        badgeColor: 'text-red-700',
        icon: <AlertTriangle className="w-6 h-6 text-red-600 shrink-0" />,
      };
    }
    return {
      container: 'bg-amber-50/70 border-amber-200',
      titleColor: 'text-amber-900',
      badgeText: 'NEEDS VERIFICATION',
      badgeColor: 'text-amber-700',
      icon: <HelpCircle className="w-6 h-6 text-amber-600 shrink-0" />,
    };
  })();

  return (
    <section id="checker" className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-8 pb-16">
      {/* Focused Educational Hero Intro */}
      <div className="max-w-3xl mb-8">
        <p className="text-sm font-medium text-[#0284C7] mb-2">
          Student Voice Safety Lab · Real-Time Audio Check
        </p>
        <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 balance-text leading-[1.12]">
          Check if a voice is real or an AI clone
        </h1>
        <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl">
          Record a live voice or upload a suspicious voice note. VoiceShield listens for natural
          breathing, pitch stability, and scam urgency phrases to tell you in plain English whether
          it sounds human or AI-generated.
        </p>
      </div>

      {/* Two-Zone Sandbox Layout (65% Stage / 35% Inspector Deck) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT / PRIMARY STAGE */}
        <div className="lg:col-span-7 xl:col-span-8 bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
          {/* Segmented Mode Control */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-200">
            <div
              className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg"
              role="tablist"
              aria-label="Voice input method"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'record'}
                onClick={() => handleModeChange('record')}
                className={`inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  mode === 'record'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Mic className="w-4 h-4" />
                <span>Record Live Voice</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'upload'}
                onClick={() => handleModeChange('upload')}
                className={`inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  mode === 'upload'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Upload className="w-4 h-4" />
                <span>Upload Audio File</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'sample'}
                onClick={() => handleModeChange('sample')}
                className={`inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  mode === 'sample'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Volume2 className="w-4 h-4" />
                <span>Try AI Test Clip</span>
              </button>
            </div>

            {(audioUrl || result) && !isRecording && (
              <button
                type="button"
                onClick={resetClip}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Clear Clip</span>
              </button>
            )}
          </div>

          {/* MODE 1: RECORD LIVE VOICE */}
          {mode === 'record' && (
            <div className="pt-5">
              {!isRecording ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 border border-slate-200 rounded-lg p-5">
                  <div>
                    <h2 className="font-display text-base font-semibold text-slate-900">
                      Speak for 4 to 10 seconds
                    </h2>
                    <p className="text-sm text-slate-600 mt-1">
                      Read a test sentence aloud or hold your phone near the mic to check a voice note.
                    </p>
                    <p className="text-xs text-slate-500 mt-2">
                      Try saying: &ldquo;{SAMPLE_PROMPTS[0]}&rdquo;
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={startRecording}
                    disabled={isAnalyzing}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Mic className="w-4 h-4" />
                    <span>Start Recording</span>
                  </button>
                </div>
              ) : (
                <div className="bg-sky-50/60 border border-sky-200 rounded-lg p-5">
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                    <div className="flex items-center gap-2.5">
                      <Mic className="w-5 h-5 text-[#0284C7]" />
                      <span className="font-display text-base font-semibold text-slate-900">
                        Listening to microphone
                      </span>
                    </div>
                    <div className="font-mono text-sm font-semibold text-slate-900 tabular-nums">
                      {formatDuration(recordingSeconds)} / 00:30.0
                    </div>
                  </div>

                  <canvas
                    ref={canvasRef}
                    width={680}
                    height={96}
                    className="w-full h-24 rounded-md border border-slate-200 bg-white mb-4"
                  />

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-slate-600">
                      Tip: Speak naturally for at least 4 seconds so breathing and tone can be measured.
                    </p>
                    <button
                      type="button"
                      onClick={stopRecording}
                      className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>Stop &amp; Check Voice</span>
                    </button>
                  </div>
                </div>
              )}

              {micError && (
                <div className="mt-4 p-4 rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-900 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">{micError}</p>
                    <div className="mt-2 flex flex-wrap gap-4">
                      <button
                        type="button"
                        onClick={() => handleModeChange('upload')}
                        className="text-xs font-semibold text-sky-700 hover:underline cursor-pointer"
                      >
                        Switch to Upload Audio File
                      </button>
                      <button
                        type="button"
                        onClick={() => handleModeChange('sample')}
                        className="text-xs font-semibold text-sky-700 hover:underline cursor-pointer"
                      >
                        Try an AI Test Clip
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MODE 2: UPLOAD AUDIO FILE */}
          {mode === 'upload' && (
            <div className="pt-5">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const droppedFile = e.dataTransfer.files?.[0];
                  if (droppedFile) handleFileSelected(droppedFile);
                }}
                className={`border border-dashed rounded-lg p-6 text-center transition-colors ${
                  isDragging
                    ? 'border-[#0284C7] bg-sky-50/70'
                    : 'border-slate-300 bg-slate-50 hover:border-slate-400'
                }`}
              >
                <FileAudio className="w-8 h-8 text-slate-400 mx-auto mb-3" />
                <h2 className="font-display text-base font-semibold text-slate-900">
                  Drop a voice message or audio file here
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                  Supports WAV, MP3, WEBM, OGG, and M4A clips up to 18 MB
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => {
                    const selected = e.target.files?.[0];
                    if (selected) handleFileSelected(selected);
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isAnalyzing}
                  className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>Choose Audio File</span>
                </button>
              </div>
            </div>
          )}

          {/* MODE 3: TRY AI TEST CLIP */}
          {mode === 'sample' && (
            <div className="pt-5">
              <p className="text-sm text-slate-600 mb-3">
                Don&apos;t have a suspicious audio file handy? Generate a real AI-synthesized scam
                call below to hear how convincing synthetic voices sound and test the detector.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {AI_TEST_SCENARIOS.map((item) => {
                  const busy = isGeneratingSample === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={Boolean(isGeneratingSample) || isAnalyzing}
                      onClick={() => handleGenerateSample(item.id)}
                      className="text-left p-4 rounded-lg border border-slate-200 bg-slate-50 hover:bg-white hover:border-[#0284C7] disabled:opacity-60 transition-colors cursor-pointer flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="font-display text-sm font-semibold text-slate-900">
                          {item.title}
                        </div>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">{item.detail}</p>
                      </div>
                      <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0284C7]">
                        {busy ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Generating &amp; checking...</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3.5 h-3.5" />
                            <span>Generate &amp; Check</span>
                          </>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* LOADED AUDIO WAVEFORM & TELEMETRY */}
          {audioUrl && !isRecording && (
            <div className="mt-6 pt-6 border-t border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div>
                  <h3 className="font-display text-sm font-semibold text-slate-900">{clipLabel}</h3>
                  {clipNote && <p className="text-xs text-slate-500 mt-0.5">{clipNote}</p>}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={togglePlay}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    <span>{isPlaying ? 'Pause' : 'Play Clip'}</span>
                  </button>

                  {audioBlob && (
                    <button
                      type="button"
                      disabled={isAnalyzing}
                      onClick={() =>
                        runAnalysis(
                          audioBlob,
                          clipLabel || 'Voice Clip',
                          mode,
                          signalStats,
                          waveformPeaks,
                          audioUrl
                        )
                      }
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Checking...</span>
                        </>
                      ) : (
                        <span>Re-Check Voice</span>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Hidden native audio element driving playback */}
              <audio
                ref={audioElRef}
                src={audioUrl}
                onTimeUpdate={(e) => {
                  const el = e.currentTarget;
                  if (el.duration > 0) {
                    setPlayProgress(el.currentTime / el.duration);
                  }
                }}
                onEnded={() => {
                  setIsPlaying(false);
                  setPlayProgress(0);
                }}
                className="hidden"
              />

              {/* Waveform Bar Visualizer */}
              <div
                className="h-20 px-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center gap-[3px]"
                aria-label="Audio waveform visualization"
              >
                {waveformPeaks.map((peak, index) => {
                  const barRatio = index / Math.max(1, waveformPeaks.length);
                  const isPlayed = isPlaying && barRatio <= playProgress;
                  const heightPct = Math.max(12, Math.round(peak * 92));
                  return (
                    <div
                      key={index}
                      className={`flex-1 rounded-sm transition-colors ${
                        isPlayed ? 'bg-[#0284C7]' : 'bg-slate-300'
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                  );
                })}
              </div>

              {/* Tabular Measured Signal Telemetry (Zero Pills) */}
              {signalStats && (
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100 text-xs">
                  <div>
                    <div className="text-slate-500">Clip Duration</div>
                    <div className="font-mono text-sm font-semibold text-slate-900 tabular-nums mt-0.5">
                      {signalStats.durationSec.toFixed(1)}s
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Breath &amp; Pauses</div>
                    <div className="font-mono text-sm font-semibold text-slate-900 tabular-nums mt-0.5">
                      {Math.round(signalStats.pauseRatio * 100)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Pitch Variation</div>
                    <div className="font-mono text-sm font-semibold text-slate-900 tabular-nums mt-0.5">
                      {signalStats.pitchVariationScore.toFixed(1)} / 100
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Signal Flatness</div>
                    <div className="font-mono text-sm font-semibold text-slate-900 tabular-nums mt-0.5">
                      {signalStats.spectralFlatness.toFixed(2)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* LOADING STATE */}
          {isAnalyzing && (
            <div className="mt-6 p-5 rounded-lg border border-slate-200 bg-slate-50 flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-[#0284C7] animate-spin shrink-0" />
              <div>
                <p className="font-display text-sm font-semibold text-slate-900">
                  Checking vocal patterns and scam triggers...
                </p>
                <p className="text-xs text-slate-600 mt-0.5">
                  Inspecting breathing pauses, tone consistency, and spoken words.
                </p>
              </div>
            </div>
          )}

          {/* ERROR STATE */}
          {analysisError && !isAnalyzing && (
            <div className="mt-6 p-4 rounded-lg border border-red-200 bg-red-50 flex items-start gap-3 text-sm text-red-900">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Could not complete voice check</p>
                <p className="mt-1 text-red-800">{analysisError}</p>
              </div>
            </div>
          )}

          {/* ANALYSIS RESULT */}
          {result && verdictUi && !isAnalyzing && (
            <div className="mt-6 space-y-5">
              {/* Verdict Banner */}
              <div className={`p-5 rounded-xl border ${verdictUi.container}`}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    {verdictUi.icon}
                    <div>
                      <div className={`text-xs font-bold tracking-wide ${verdictUi.badgeColor}`}>
                        {verdictUi.badgeText}
                        <span className="mx-2 text-slate-400" aria-hidden="true">
                          ·
                        </span>
                        <span className="font-mono tabular-nums">
                          {result.confidence}% confidence
                        </span>
                      </div>
                      <h3 className={`font-display text-xl font-bold mt-1 ${verdictUi.titleColor}`}>
                        {result.headline}
                      </h3>
                    </div>
                  </div>

                  <div className="text-xs font-medium text-slate-700">
                    Scam Risk:{' '}
                    <span className="font-mono font-semibold text-slate-900">
                      {result.impersonationRisk}
                    </span>
                  </div>
                </div>

                <p className="mt-3 text-sm text-slate-800 leading-relaxed">{result.summary}</p>
              </div>

              {/* Transcript */}
              <div className="p-4 rounded-lg border border-slate-200 bg-slate-50">
                <div className="text-xs font-semibold text-slate-500 mb-1.5">What Was Said</div>
                <p className="text-sm text-slate-900 leading-relaxed">
                  &ldquo;{result.transcript}&rdquo;
                </p>
              </div>

              {/* Acoustic Clues */}
              <div>
                <h4 className="font-display text-sm font-semibold text-slate-900 mb-3">
                  Acoustic Clues Observed
                </h4>
                <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg bg-white">
                  {result.acousticClues.map((clue, idx) => (
                    <div key={idx} className="p-3.5 flex items-start gap-3">
                      {clue.status === 'human' && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      )}
                      {clue.status === 'suspicious' && (
                        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      )}
                      {clue.status === 'neutral' && (
                        <HelpCircle className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900">
                          {clue.title}
                          <span className="mx-2 text-slate-300" aria-hidden="true">
                            ·
                          </span>
                          <span
                            className={`text-xs font-medium ${
                              clue.status === 'human'
                                ? 'text-emerald-700'
                                : clue.status === 'suspicious'
                                  ? 'text-red-700'
                                  : 'text-slate-500'
                            }`}
                          >
                            {clue.status === 'human'
                              ? 'Human Sign'
                              : clue.status === 'suspicious'
                                ? 'AI Warning'
                                : 'Neutral'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                          {clue.observation}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Scam Triggers & Prevention Steps */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border border-slate-200 bg-white">
                  <h4 className="font-display text-sm font-semibold text-slate-900 mb-2">
                    Scam Language Signals
                  </h4>
                  {result.scamSignals.length > 0 ? (
                    <ul className="space-y-2 text-xs text-slate-700">
                      {result.scamSignals.map((sig, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                          <span>{sig}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-600">
                      No urgent money requests, passcode demands, or secrecy triggers were detected
                      in the spoken words.
                    </p>
                  )}
                </div>

                <div className="p-4 rounded-lg border border-slate-200 bg-white">
                  <h4 className="font-display text-sm font-semibold text-slate-900 mb-2">
                    What to Do Next
                  </h4>
                  <ol className="space-y-2 text-xs text-slate-700">
                    {result.preventionSteps.map((step, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="font-mono font-semibold text-[#0284C7] shrink-0">
                          {i + 1}.
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT / INSPECTOR & SESSION DECK */}
        <aside className="lg:col-span-5 xl:col-span-4 space-y-5">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="font-display text-base font-semibold text-slate-900">
              What VoiceShield Listens For
            </h2>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Even convincing AI clones leave subtle audio and behavioral footprints.
            </p>

            <div className="mt-4 divide-y divide-slate-200">
              <div className="py-3 first:pt-0">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-900">
                  <span>1. Natural Breathing &amp; Pauses</span>
                  <span className="font-mono tabular-nums text-slate-500">
                    {signalStats ? `${Math.round(signalStats.pauseRatio * 100)}% pauses` : 'Waiting'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Humans inhale, hesitate, and vary rhythm. AI voices often rush smoothly without
                  real lung breaths.
                </p>
              </div>

              <div className="py-3">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-900">
                  <span>2. Pitch Micro-Variation</span>
                  <span className="font-mono tabular-nums text-slate-500">
                    {signalStats ? `${signalStats.pitchVariationScore.toFixed(0)}/100` : 'Waiting'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Real vocal cords wobble slightly on every vowel. Cloned voices can sound flat or
                  over-smoothed.
                </p>
              </div>

              <div className="py-3">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-900">
                  <span>3. Room Sound Consistency</span>
                  <span className="font-mono tabular-nums text-slate-500">
                    {signalStats ? `${signalStats.spectralFlatness.toFixed(2)} flat` : 'Waiting'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Synthetic generators sometimes create sterile silence between words or metallic
                  high-frequency ringing.
                </p>
              </div>

              <div className="py-3 last:pb-0">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-900">
                  <span>4. Impersonation Pressure</span>
                  <span className="font-mono text-slate-500">
                    {result ? `${result.impersonationRisk} risk` : 'Waiting'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Scammers pair fake voices with urgency, secrecy, payment links, or login-code
                  requests so you panic.
                </p>
              </div>
            </div>
          </div>

          {/* Session Checks History */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-slate-900">
                Recent Checks
              </h2>
              <span className="font-mono text-xs text-slate-500 tabular-nums">
                {history.length} tested
              </span>
            </div>

            {history.length === 0 ? (
              <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                Record your own voice, upload a clip, or generate an AI test clip to compare real
                and fake voices side-by-side.
              </p>
            ) : (
              <div className="mt-3 divide-y divide-slate-200">
                {history.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => loadFromHistory(item)}
                    className="w-full py-3 first:pt-1 last:pb-0 text-left hover:bg-slate-50 rounded transition-colors cursor-pointer flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900 truncate">
                        {item.label}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {item.verdict === 'REAL_HUMAN'
                          ? 'Real Human'
                          : item.verdict === 'LIKELY_FAKE'
                            ? 'Likely AI Fake'
                            : 'Uncertain'}
                        <span className="mx-1.5" aria-hidden="true">
                          ·
                        </span>
                        <span className="font-mono tabular-nums">{item.confidence}%</span>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-[#0284C7] shrink-0">View</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
};
