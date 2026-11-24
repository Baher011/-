import { useEffect, useState } from 'react';
import { ArrowLeft, Flame } from 'lucide-react';

interface KickboxingIntroSplashProps {
  onComplete: () => void;
}

export function KickboxingIntroSplash({ onComplete }: KickboxingIntroSplashProps) {
  const [fadingOut, setFadingOut] = useState(false);

  const finishIntro = () => {
    setFadingOut(true);
    setTimeout(() => {
      onComplete();
    }, 320);
  };

  useEffect(() => {
    const fadeTimer = setTimeout(() => {
      setFadingOut(true);
    }, 2450);

    const doneTimer = setTimeout(() => {
      onComplete();
    }, 2800);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-50 bg-[#0A0B0E] text-white flex flex-col justify-between p-4 sm:p-6 transition-opacity duration-300 select-none ${
        fadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      role="status"
      aria-label="أكاديمية البوب للفنون القتالية — شاشة الترحيب"
    >
      {/* Subtle Ambient Combat Backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(212,168,67,0.16),rgba(185,28,28,0.08)_45%,transparent_75%)]"
      />

      {/* Top Bar */}
      <div className="relative z-10 max-w-4xl w-full mx-auto flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-900/90 border border-[#D4A843]/40 rounded-lg text-[11px] font-bold text-[#D4A843]">
          <Flame className="w-3.5 h-3.5 text-[#B91C1C]" />
          <span>AL-BOOB ACADEMY · KICKBOXING</span>
        </div>

        <button
          type="button"
          onClick={finishIntro}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-bold text-zinc-200 rounded-lg transition-colors"
        >
          <span>دخول مباشر</span>
          <ArrowLeft className="w-3.5 h-3.5 text-[#D4A843]" />
        </button>
      </div>

      {/* Center Animated Kickboxing Ring Scene */}
      <div className="relative z-10 max-w-2xl w-full mx-auto flex flex-col items-center text-center space-y-5 my-auto">
        <div className="w-full max-w-[390px] sm:max-w-[440px] bg-[#111318]/90 border border-[#D4A843]/30 rounded-2xl p-3 sm:p-4 shadow-2xl overflow-hidden">
          <svg
            viewBox="0 0 420 235"
            className="w-full h-auto block"
            aria-label="رسوم متحركة قتالية لرياضة الكيك بوكسينج"
          >
            <defs>
              <linearGradient id="kbGold" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#F3D078" />
                <stop offset="50%" stopColor="#D4A843" />
                <stop offset="100%" stopColor="#9C721A" />
              </linearGradient>
              <linearGradient id="kbRed" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#EF4444" />
                <stop offset="100%" stopColor="#991B1B" />
              </linearGradient>
              <linearGradient id="kbMat" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#1B1F27" />
                <stop offset="100%" stopColor="#0E1015" />
              </linearGradient>
            </defs>

            {/* Ring Corner Ropes & Mat */}
            <rect x="20" y="34" width="6" height="162" rx="3" fill="#272A34" />
            <rect x="394" y="34" width="6" height="162" rx="3" fill="#272A34" />
            <line x1="24" y1="62" x2="396" y2="62" stroke="#D4A843" strokeOpacity="0.22" strokeWidth="2" />
            <line x1="24" y1="100" x2="396" y2="100" stroke="#B91C1C" strokeOpacity="0.32" strokeWidth="2.2" />
            <line x1="24" y1="138" x2="396" y2="138" stroke="#D4A843" strokeOpacity="0.22" strokeWidth="2" />
            <polygon points="10,192 410,192 420,232 0,232" fill="url(#kbMat)" />
            <line x1="16" y1="192" x2="404" y2="192" stroke="url(#kbGold)" strokeOpacity="0.45" strokeWidth="2" />

            {/* Hanging Heavy Kickboxing Bag (Right) */}
            <g className="kb-bag-swing">
              {/* Chain */}
              <line x1="308" y1="8" x2="308" y2="42" stroke="#9CA3AF" strokeWidth="3" strokeDasharray="4 3" />
              <line x1="292" y1="42" x2="308" y2="30" stroke="#9CA3AF" strokeWidth="2.5" />
              <line x1="324" y1="42" x2="308" y2="30" stroke="#9CA3AF" strokeWidth="2.5" />
              {/* Heavy Bag Body */}
              <rect x="282" y="42" width="52" height="118" rx="12" fill="#181B22" stroke="#D4A843" strokeWidth="2" />
              <rect x="284" y="54" width="48" height="12" fill="url(#kbRed)" />
              <rect x="284" y="136" width="48" height="10" fill="url(#kbGold)" opacity="0.85" />
              <text
                x="308"
                y="102"
                textAnchor="middle"
                fill="#D4A843"
                fontSize="11"
                fontWeight="800"
                fontFamily="Cairo, sans-serif"
              >
                AL-BOOB
              </text>
              <text
                x="308"
                y="116"
                textAnchor="middle"
                fill="#A1A1AA"
                fontSize="8"
                fontWeight="700"
                fontFamily="Cairo, sans-serif"
              >
                KICKBOXING
              </text>
            </g>

            {/* Kinetic Kick Trail Arc */}
            <g className="kb-arc-flash">
              <path
                d="M 155 150 Q 222 146 276 82"
                fill="none"
                stroke="url(#kbGold)"
                strokeWidth="5"
                strokeLinecap="round"
              />
              <path
                d="M 168 164 Q 230 156 280 96"
                fill="none"
                stroke="url(#kbRed)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeOpacity="0.85"
              />
            </g>

            {/* Impact Burst Star on Heavy Bag */}
            <g className="kb-impact-pulse">
              <polygon
                points="276,86 283,74 288,85 300,82 291,92 299,102 287,98 282,109 277,97 265,99 274,90 266,80"
                fill="url(#kbGold)"
              />
              <circle cx="282" cy="91" r="19" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeDasharray="6 4" />
            </g>

            {/* Animated Kickboxer Fighter (Left) */}
            <g className="kb-stance-bob">
              {/* Shadow on Mat */}
              <ellipse cx="145" cy="196" rx="46" ry="7" fill="#000000" opacity="0.6" />

              {/* Support Standing Leg */}
              <path
                d="M 134 128 L 122 166 L 114 192"
                fill="none"
                stroke="#E4E4E7"
                strokeWidth="13"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <ellipse cx="110" cy="192" rx="11" ry="5" fill="url(#kbGold)" />

              {/* Kicking Leg (High Roundhouse Kick) */}
              <g className="kb-high-kick">
                <path
                  d="M 154 126 L 204 114 L 256 96"
                  fill="none"
                  stroke="#F4F4F5"
                  strokeWidth="13"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Shin Guard */}
                <path
                  d="M 208 113 L 254 96"
                  fill="none"
                  stroke="url(#kbRed)"
                  strokeWidth="14"
                  strokeLinecap="round"
                />
                <ellipse cx="262" cy="94" rx="11" ry="6" transform="rotate(-18 262 94)" fill="url(#kbGold)" />
              </g>

              {/* Martial Arts Shorts */}
              <path d="M 122 110 L 164 110 L 168 134 L 146 132 L 120 134 Z" fill="#181B22" stroke="url(#kbGold)" strokeWidth="2" />
              <rect x="122" y="106" width="42" height="7" rx="2" fill="url(#kbGold)" />

              {/* Fighter Torso */}
              <path
                d="M 125 68 Q 146 62 162 72 L 160 107 L 126 107 Z"
                fill="#F4F4F5"
                stroke="#D4D4D8"
                strokeWidth="1.5"
              />
              {/* Black-Gold Sash / Vest Accent */}
              <path d="M 135 67 L 154 106" stroke="url(#kbRed)" strokeWidth="5" strokeLinecap="round" />

              {/* Head + Headgear Band */}
              <circle cx="146" cy="46" r="15" fill="#F4F4F5" />
              <rect x="131" y="38" width="30" height="6" rx="2" fill="url(#kbRed)" />
              <path d="M 130 41 L 120 45" stroke="#EF4444" strokeWidth="3" strokeLinecap="round" />

              {/* Back Guard Arm + Boxing Glove */}
              <path
                d="M 128 76 L 114 92 L 126 70"
                fill="none"
                stroke="#E4E4E7"
                strokeWidth="9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <rect x="120" y="57" width="17" height="15" rx="6" fill="url(#kbRed)" stroke="#D4A843" strokeWidth="1.5" />

              {/* Lead Punching Jab Arm + Boxing Glove */}
              <g className="kb-punch-jab">
                <path
                  d="M 157 74 L 184 78 L 204 68"
                  fill="none"
                  stroke="#F4F4F5"
                  strokeWidth="9.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <rect x="197" y="57" width="21" height="17" rx="7" fill="url(#kbRed)" stroke="#D4A843" strokeWidth="1.8" />
                <rect x="194" y="61" width="6" height="11" rx="2" fill="url(#kbGold)" />
              </g>
            </g>
          </svg>
        </div>

        {/* Academy Crest & Title */}
        <div className="flex flex-col items-center space-y-2.5">
          <div className="flex items-center gap-3">
            <img
              src="/alboob-logo.png"
              alt="شعار أكاديمية البوب"
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl object-contain bg-[#111315] border border-[#D4A843]/60 shadow-lg"
            />
            <div className="text-right">
              <h1 className="text-xl sm:text-2xl font-extrabold text-white leading-tight">
                أكاديمية البوب للفنون القتالية
              </h1>
              <div className="text-xs sm:text-sm font-bold text-[#D4A843]">
                كيك بوكسينج · كونغ فو · MMA · ميت غمر
              </div>
            </div>
          </div>
          <p className="text-xs text-zinc-400">
            إشراف كابتن باهر مراد · الإثنين والأربعاء والجمعة الساعة 5:00 مساءً
          </p>
        </div>

        {/* Smooth Progress Indicator (No rounded-full pill) */}
        <div className="w-full max-w-xs space-y-1.5">
          <div className="w-full h-2 bg-zinc-900 border border-zinc-800 rounded-md overflow-hidden">
            <div className="h-full bg-gradient-to-l from-[#D4A843] to-[#B91C1C] rounded-md kb-progress-fill" />
          </div>
          <div className="text-[11px] font-medium text-zinc-400">
            جاري دخول المنصة وبوابة أولياء الأمور...
          </div>
        </div>
      </div>

      {/* Bottom Legal / Location Tag */}
      <div className="relative z-10 text-center text-[11px] text-zinc-500">
        ميت غمر — محافظة الدقهلية · هاتف وواتساب:{' '}
        <span className="font-mono text-zinc-300" dir="ltr">
          01080486524
        </span>
      </div>
    </div>
  );
}
