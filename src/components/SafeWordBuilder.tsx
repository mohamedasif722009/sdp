import React, { useState } from 'react';
import { Check, Copy, RefreshCw, ShieldCheck } from 'lucide-react';

const SAFE_WORD_IDEAS = [
  'Blue Pineapple',
  'Library Staircase',
  'Toaster Tuesday',
  'Cedar Bicycle',
  'Mango Notebook',
  'Silver Backpack',
];

const GROUP_OPTIONS = [
  { id: 'family', label: 'Parents & Family' },
  { id: 'roommates', label: 'Roommates & Friends' },
  { id: 'club', label: 'Study Group / Club' },
];

export const SafeWordBuilder: React.FC = () => {
  const [group, setGroup] = useState<string>('family');
  const [safeWord, setSafeWord] = useState<string>('Blue Pineapple');
  const [copied, setCopied] = useState<boolean>(false);

  const cycleIdea = () => {
    const currentIdx = SAFE_WORD_IDEAS.indexOf(safeWord);
    const next = SAFE_WORD_IDEAS[(currentIdx + 1) % SAFE_WORD_IDEAS.length];
    setSafeWord(next);
    setCopied(false);
  };

  const groupLabel = GROUP_OPTIONS.find((g) => g.id === group)?.label ?? 'Family';

  const shareMessage = `Quick safety check for our ${groupLabel} chat: With AI voice scams getting realistic, if anyone ever calls or sends a voice note asking for urgent money, a favor, or a login code, ask for our safe-word first: "${safeWord.trim() || 'Blue Pineapple'}". If they can't say it, hang up and call each other on our saved number.`;

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(shareMessage);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section id="safe-word" className="max-w-[1200px] mx-auto px-4 sm:px-6 py-14 border-t border-slate-200">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: 3 Golden Prevention Rules */}
        <div className="lg:col-span-5">
          <p className="text-sm font-medium text-[#0284C7] mb-1.5">Prevention Toolkit</p>
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 balance-text">
            3 simple rules that defeat every voice clone
          </h2>
          <p className="mt-2.5 text-sm sm:text-base text-slate-600 leading-relaxed">
            Even if an AI clone sounds 99% identical to someone you love, it cannot survive basic
            out-of-band verification.
          </p>

          <div className="mt-6 divide-y divide-slate-200 border border-slate-200 rounded-xl bg-white">
            <div className="p-4">
              <div className="font-display text-sm font-semibold text-slate-900">
                01. Pause for 10 seconds
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Scammers create panic so you react before thinking. Take a breath whenever someone
                demands instant payment or secrecy.
              </p>
            </div>
            <div className="p-4">
              <div className="font-display text-sm font-semibold text-slate-900">
                02. Hang up and call the saved number
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Never reply to an unknown number or press callback. Open your Contacts app and dial
                the real person directly.
              </p>
            </div>
            <div className="p-4">
              <div className="font-display text-sm font-semibold text-slate-900">
                03. Ask your agreed safe-word
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Agree on a random two-word phrase with your family and roommates that never appears
                on your public social media.
              </p>
            </div>
          </div>
        </div>

        {/* Right: Interactive Safe-Word Protocol Card */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
            <h3 className="font-display text-lg font-bold">
              Build Your Family &amp; Friend Safe-Word Message
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Customize a quick verification note and drop it into your family or roommate group chat.
          </p>

          <div className="mt-5 space-y-4">
            {/* Group Type */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Who is this safe-word for?
              </label>
              <div className="inline-flex flex-wrap gap-1 p-1 bg-slate-100 rounded-lg">
                {GROUP_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setGroup(opt.id);
                      setCopied(false);
                    }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      group === opt.id
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Safe-Word Input */}
            <div>
              <label htmlFor="safeword-input" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Pick or type a private two-word phrase
              </label>
              <div className="flex flex-wrap sm:flex-nowrap gap-2">
                <input
                  id="safeword-input"
                  type="text"
                  maxLength={40}
                  value={safeWord}
                  onChange={(e) => {
                    setSafeWord(e.target.value);
                    setCopied(false);
                  }}
                  placeholder="e.g. Blue Pineapple"
                  className="flex-1 min-w-0 px-3.5 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0284C7] focus:border-[#0284C7]"
                />
                <button
                  type="button"
                  onClick={cycleIdea}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>New Idea</span>
                </button>
              </div>
            </div>

            {/* Preview Message */}
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-xs font-semibold text-slate-500 mb-1.5">
                Ready-to-Send Group Chat Message
              </div>
              <p className="text-sm text-slate-800 leading-relaxed">{shareMessage}</p>
            </div>

            <div className="flex items-center justify-between gap-4">
              <span className="text-xs text-slate-500">
                Tip: Never post your safe-word on social media.
              </span>
              <button
                type="button"
                onClick={copyMessage}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Copied to Clipboard</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy Message</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
