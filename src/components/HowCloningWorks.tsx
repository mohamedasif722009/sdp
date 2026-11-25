import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, Mic, ShieldAlert, Volume2, Waves } from 'lucide-react';

interface Stage {
  id: number;
  label: string;
  title: string;
  summary: string;
  example: string;
  defenseTip: string;
  accent: string;
}

const STAGES: Stage[] = [
  {
    id: 0,
    label: '01. Short Audio Harvest',
    title: 'An attacker grabs 3–10 seconds of your voice',
    summary:
      'Modern voice models do not need hours of studio audio. A public TikTok video, Instagram reel, class presentation, or voicemail greeting is enough to capture vocal tone.',
    example: 'Example: A 6-second campus vlog clip or outgoing voicemail greeting.',
    defenseTip: 'Keep social video accounts private or set a default carrier voicemail greeting.',
    accent: 'text-[#0284C7]',
  },
  {
    id: 1,
    label: '02. Neural Voiceprint',
    title: 'AI extracts pitch, timbre, and speaking rhythm',
    summary:
      'A neural encoder converts the short sample into a digital speaker profile. That profile lets the attacker type any new sentence and render it in the copied voice.',
    example: 'Example: Typing "Send $150 to this Venmo right now" and outputting realistic speech.',
    defenseTip: 'Watch for sudden tone shifts, flat pacing, or missing background room noise.',
    accent: 'text-amber-700',
  },
  {
    id: 2,
    label: '03. Impersonation Attack',
    title: 'Scammers pair the cloned voice with artificial panic',
    summary:
      'Voice cloning almost always arrives with a time crunch: a fake car accident, a locked dorm account, or a scholarship deadline designed to stop you from thinking clearly.',
    example: 'Example: "My phone is at 1%, do not call Mom, just send the code."',
    defenseTip: 'Urgency + secrecy + money or passcodes is the universal impersonation signature.',
    accent: 'text-red-700',
  },
  {
    id: 3,
    label: '04. Real-Time Detection',
    title: 'Acoustic checks + callback rules stop the scam',
    summary:
      'Detectors inspect breathing pauses, pitch micro-tremors, and vocoder artifacts. Even more reliably, hanging up and calling the person on their saved number breaks the attack.',
    example: 'Example: Asking for your pre-agreed family safe-word stops 100% of scripted clones.',
    defenseTip: 'Never trust caller ID alone—caller numbers can be spoofed just as easily as voices.',
    accent: 'text-emerald-700',
  },
];

export const HowCloningWorks: React.FC = () => {
  const [activeStage, setActiveStage] = useState<number>(0);
  const current = STAGES[activeStage];

  return (
    <section id="how-it-works" className="max-w-[1200px] mx-auto px-4 sm:px-6 py-14 border-t border-slate-200">
      <div className="max-w-2xl mb-8">
        <p className="text-sm font-medium text-[#0284C7] mb-1.5">Interactive Visual Guide</p>
        <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 balance-text">
          How a 5-second voice clone attack actually works
        </h2>
        <p className="mt-2.5 text-sm sm:text-base text-slate-600 leading-relaxed">
          Select each stage below to follow the audio signal from a public clip to an impersonation
          call, and see where verification stops it.
        </p>
      </div>

      {/* Stage Selector Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {STAGES.map((stage) => {
          const isActive = stage.id === activeStage;
          return (
            <button
              key={stage.id}
              type="button"
              onClick={() => setActiveStage(stage.id)}
              className={`text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                isActive
                  ? 'bg-white border-[#0284C7] shadow-sm'
                  : 'bg-slate-50 border-slate-200 hover:bg-white hover:border-slate-300'
              }`}
            >
              <div className={`text-xs font-semibold ${isActive ? 'text-[#0284C7]' : 'text-slate-500'}`}>
                {stage.label}
              </div>
              <div className="font-display text-sm font-semibold text-slate-900 mt-1 leading-snug">
                {stage.title}
              </div>
            </button>
          );
        })}
      </div>

      {/* Interactive Signal Flow Diagram + Stage Detail */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
        {/* Visual Flow Track */}
        <div className="grid grid-cols-1 md:grid-cols-7 items-center gap-3 pb-6 border-b border-slate-200">
          <button
            type="button"
            onClick={() => setActiveStage(0)}
            className={`md:col-span-1 p-3 rounded-lg border text-center cursor-pointer transition-colors ${
              activeStage === 0 ? 'border-[#0284C7] bg-sky-50' : 'border-slate-200 bg-slate-50'
            }`}
          >
            <Mic className="w-5 h-5 mx-auto text-slate-700 mb-1" />
            <div className="text-xs font-semibold text-slate-900">5s Clip</div>
          </button>

          <div className="hidden md:flex justify-center text-slate-400">
            <ArrowRight className="w-4 h-4" />
          </div>

          <button
            type="button"
            onClick={() => setActiveStage(1)}
            className={`md:col-span-1 p-3 rounded-lg border text-center cursor-pointer transition-colors ${
              activeStage === 1 ? 'border-[#0284C7] bg-sky-50' : 'border-slate-200 bg-slate-50'
            }`}
          >
            <Waves className="w-5 h-5 mx-auto text-slate-700 mb-1" />
            <div className="text-xs font-semibold text-slate-900">Voiceprint</div>
          </button>

          <div className="hidden md:flex justify-center text-slate-400">
            <ArrowRight className="w-4 h-4" />
          </div>

          <button
            type="button"
            onClick={() => setActiveStage(2)}
            className={`md:col-span-1 p-3 rounded-lg border text-center cursor-pointer transition-colors ${
              activeStage === 2 ? 'border-[#0284C7] bg-sky-50' : 'border-slate-200 bg-slate-50'
            }`}
          >
            <Volume2 className="w-5 h-5 mx-auto text-slate-700 mb-1" />
            <div className="text-xs font-semibold text-slate-900">Fake Call</div>
          </button>

          <div className="hidden md:flex justify-center text-slate-400">
            <ArrowRight className="w-4 h-4" />
          </div>

          <button
            type="button"
            onClick={() => setActiveStage(3)}
            className={`md:col-span-1 p-3 rounded-lg border text-center cursor-pointer transition-colors ${
              activeStage === 3 ? 'border-[#0284C7] bg-sky-50' : 'border-slate-200 bg-slate-50'
            }`}
          >
            <ShieldAlert className="w-5 h-5 mx-auto text-slate-700 mb-1" />
            <div className="text-xs font-semibold text-slate-900">Blocked</div>
          </button>
        </div>

        {/* Active Stage Explanation */}
        <div className="pt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7">
            <div className={`text-xs font-semibold ${current.accent}`}>{current.label}</div>
            <h3 className="font-display text-xl font-bold text-slate-900 mt-1">{current.title}</h3>
            <p className="text-sm sm:text-base text-slate-600 mt-2 leading-relaxed">
              {current.summary}
            </p>
            <p className="text-xs text-slate-500 mt-3">{current.example}</p>
          </div>

          <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Student Defense Rule</span>
            </div>
            <p className="text-sm text-slate-700 mt-2 leading-relaxed">{current.defenseTip}</p>

            <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
              <span className="font-mono text-xs text-slate-500 tabular-nums">
                Stage {activeStage + 1} of {STAGES.length}
              </span>
              <button
                type="button"
                onClick={() => setActiveStage((prev) => (prev + 1) % STAGES.length)}
                className="text-xs font-semibold text-[#0284C7] hover:underline cursor-pointer whitespace-nowrap shrink-0"
              >
                {activeStage < STAGES.length - 1 ? 'Next Stage' : 'Restart Guide'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
