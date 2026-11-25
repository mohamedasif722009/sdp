import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, RotateCcw } from 'lucide-react';

interface QuizScenario {
  id: string;
  caller: string;
  channel: string;
  message: string;
  isScam: boolean;
  reason: string;
  rule: string;
}

const SCENARIOS: QuizScenario[] = [
  {
    id: 'roommate_venmo',
    caller: 'Roommate (Unknown New Number)',
    channel: 'WhatsApp Voice Note · 11:42 PM',
    message:
      '"Hey! My phone cracked so I\'m texting from a friend\'s phone. Can you Zelle me $120 for the Uber back to the dorm right now? Please don\'t call my old number."',
    isScam: true,
    reason:
      'Classic urgency + new number + "don\'t call my old number" trap. Even if the 7-second voice note sounds exactly like your roommate, attackers clone short clips from social media.',
    rule: 'Always call their saved contact number or ask a question only your roommate knows.',
  },
  {
    id: 'bursar_otp',
    caller: 'University Financial Aid Office',
    channel: 'Incoming Phone Call · Caller ID Spoofed',
    message:
      '"Your semester scholarship is on hold due to a verification error. Read back the 6-digit login code we just texted to your phone so we can release the funds."',
    isScam: true,
    reason:
      'University offices never ask for your 6-digit one-time passcode over the phone. Scammers spoof campus phone numbers and use polished AI voices to steal student logins.',
    rule: 'Hang up and check your official student portal directly—never read a 2FA code aloud.',
  },
  {
    id: 'study_partner',
    caller: 'Lab Partner (Saved Contact)',
    channel: 'Voice Memo · 3:15 PM',
    message:
      '"Hey, I\'m in the library basement—uh, wait—can you bring the printed lab worksheet? No rush, I\'ll be at table four near the stairs."',
    isScam: false,
    reason:
      'Natural hesitation ("uh, wait"), realistic background room context, zero financial urgency, and no request for secrets or codes.',
    rule: 'Normal requests with zero pressure and verifiable details are safe to answer normally.',
  },
  {
    id: 'professor_giftcard',
    caller: 'Department Chair / Professor',
    channel: 'Voice Message · Email Attachment',
    message:
      '"I\'m stuck in a faculty conference and need a quick favor for a guest speaker. Buy three $100 digital gift cards and send me the codes before 4 PM—keep this quiet as a surprise."',
    isScam: true,
    reason:
      'Requesting gift cards + secrecy ("keep this quiet") + urgency ("before 4 PM") is a textbook impersonation attack targeting students and teaching assistants.',
    rule: 'No professor asks students to buy gift cards or keep financial favors secret.',
  },
];

export const ScamQuiz: React.FC = () => {
  const [answers, setAnswers] = useState<Record<string, boolean>>({});

  const answeredCount = Object.keys(answers).length;
  const correctCount = SCENARIOS.filter((s) => answers[s.id] === s.isScam).length;

  const choose = (scenarioId: string, guessedScam: boolean) => {
    setAnswers((prev) => ({ ...prev, [scenarioId]: guessedScam }));
  };

  return (
    <section id="spot-scam" className="max-w-[1200px] mx-auto px-4 sm:px-6 py-14 border-t border-slate-200">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-[#0284C7] mb-1.5">Real-World Practice</p>
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 balance-text">
            Can you spot the voice impersonation scam?
          </h2>
          <p className="mt-2.5 text-sm sm:text-base text-slate-600 leading-relaxed">
            Test your instincts on four common campus voice scenarios before an attacker calls.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-sm text-slate-700 font-mono tabular-nums">
            {correctCount} / {SCENARIOS.length} correct
          </div>
          {answeredCount > 0 && (
            <button
              type="button"
              onClick={() => setAnswers({})}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Quiz</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {SCENARIOS.map((item) => {
          const userAnswer = answers[item.id];
          const hasAnswered = userAnswer !== undefined;
          const isCorrect = hasAnswered && userAnswer === item.isScam;

          return (
            <article
              key={item.id}
              className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4"
            >
              <div>
                <div className="text-xs text-slate-500">
                  <span className="font-semibold text-slate-800">{item.caller}</span>
                  <span className="mx-1.5" aria-hidden="true">
                    ·
                  </span>
                  <span>{item.channel}</span>
                </div>

                <p className="mt-3 text-sm sm:text-base text-slate-900 leading-relaxed">
                  {item.message}
                </p>
              </div>

              {!hasAnswered ? (
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => choose(item.id, false)}
                    className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Likely Safe
                  </button>
                  <button
                    type="button"
                    onClick={() => choose(item.id, true)}
                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Impersonation Scam
                  </button>
                </div>
              ) : (
                <div
                  className={`p-4 rounded-lg border text-xs leading-relaxed ${
                    isCorrect
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                      : 'bg-red-50/70 border-red-200 text-red-950'
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold mb-1.5">
                    {isCorrect ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                    )}
                    <span>
                      {isCorrect ? 'Correct' : 'Watch Out'} —{' '}
                      {item.isScam ? 'This is an Impersonation Scam' : 'This Message is Normal'}
                    </span>
                  </div>
                  <p className="text-slate-700">{item.reason}</p>
                  <p className="mt-2 font-semibold text-slate-900">Rule: {item.rule}</p>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
};
