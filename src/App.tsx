import React from 'react';
import { Header } from './components/Header';
import { HowCloningWorks } from './components/HowCloningWorks';
import { SafeWordBuilder } from './components/SafeWordBuilder';
import { ScamQuiz } from './components/ScamQuiz';
import { VoiceChecker } from './components/VoiceChecker';

export default function App() {
  const scrollToChecker = () => {
    const el = document.getElementById('checker');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div id="top" className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A]">
      <Header onCheckVoiceClick={scrollToChecker} />

      <main className="flex-1">
        <VoiceChecker />
        <HowCloningWorks />
        <ScamQuiz />
        <SafeWordBuilder />
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            VoiceShield — Educational Voice Authenticity &amp; Impersonation Prevention Lab
          </div>
          <div className="flex items-center gap-4">
            <a href="#checker" className="hover:text-slate-900 transition-colors">
              Voice Checker
            </a>
            <a href="#how-it-works" className="hover:text-slate-900 transition-colors">
              How Clones Work
            </a>
            <a href="#spot-scam" className="hover:text-slate-900 transition-colors">
              Spot the Scam
            </a>
            <a href="#safe-word" className="hover:text-slate-900 transition-colors">
              Safe-Word Lab
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
