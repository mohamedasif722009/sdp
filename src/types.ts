export type VerdictType = 'REAL_HUMAN' | 'LIKELY_FAKE' | 'UNCERTAIN';

export type ImpersonationRisk = 'LOW' | 'MEDIUM' | 'HIGH';

export type ClueStatus = 'human' | 'suspicious' | 'neutral';

export interface AcousticClue {
  title: string;
  observation: string;
  status: ClueStatus;
}

export interface SignalStats {
  durationSec: number;
  rmsLevel: number;
  pauseRatio: number;
  pitchVariationScore: number;
  spectralFlatness: number;
}

export interface VoiceAnalysisResult {
  verdict: VerdictType;
  confidence: number;
  headline: string;
  summary: string;
  transcript: string;
  impersonationRisk: ImpersonationRisk;
  scamSignals: string[];
  acousticClues: AcousticClue[];
  preventionSteps: string[];
}

export interface GeneratedSampleResponse {
  audioBase64: string;
  mimeType: string;
  title: string;
  contextNote: string;
  expectedType: string;
}
