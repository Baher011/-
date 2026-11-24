import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { Home, LogIn, LogOut, Shield, UserCheck, UserPlus } from 'lucide-react';
import { AuthModal, type AuthModalTab } from './components/AuthModal';
import { CoachDashboard } from './components/CoachDashboard';
import { KickboxingIntroSplash } from './components/KickboxingIntroSplash';
import { LandingView } from './components/LandingView';
import { OfflineIndicator } from './components/OfflineIndicator';
import { ParentOnboarding } from './components/ParentOnboarding';
import { ParentPortal } from './components/ParentPortal';
import { syncPushSubscriptionIfGranted } from './lib/fcm';
import { auth } from './lib/firebase';
import {
  ensureCoachProfile,
  fetchUserProfile,
  isCoachUser,
  signOutAccount,
} from './lib/firestoreApi';
import type { UserProfile } from './types';

type AppView = 'home' | 'parent' | 'coach';

export default function App() {
  const [fbUser, setFbUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [view, setView] = useState<AppView>('home');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<AuthModalTab>('register_parent');
  const [prefillUsername, setPrefillUsername] = useState('');
  const [showIntroSplash, setShowIntroSplash] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      return window.sessionStorage.getItem('alboob_intro_seen') !== '1';
    } catch {
      return true;
    }
  });

  const handleCloseIntro = () => {
    setShowIntroSplash(false);
    try {
      window.sessionStorage.setItem('alboob_intro_seen', '1');
    } catch {
      // ignore storage errors
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const loginMode = params.get('login');
    const userParam = (params.get('u') || '').trim();
    if (userParam) {
      setPrefillUsername(userParam);
    }
    if (loginMode === 'parent' || userParam) {
      setAuthModalTab('login_parent');
      setAuthModalOpen(true);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setFbUser(nextUser);
      if (!nextUser) {
        setProfile(null);
        setAuthReady(true);
        return;
      }

      try {
        if (isCoachUser(nextUser)) {
          const coachProf = await ensureCoachProfile(nextUser);
          setProfile(coachProf);
          setView('coach');
          setAuthModalOpen(false);
        } else {
          const parentProf = await fetchUserProfile(nextUser.uid);
          setProfile(parentProf);
          setView('parent');
          setAuthModalOpen(false);
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
      } finally {
        setAuthReady(true);
      }
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (profile) {
      void syncPushSubscriptionIfGranted(profile);
    }
  }, [profile]);

  const openAuth = (tab: AuthModalTab) => {
    setAuthModalTab(tab);
    setAuthModalOpen(true);
  };

  const handleLogout = async () => {
    await signOutAccount();
    setProfile(null);
    setFbUser(null);
    setView('home');
  };

  const handleNavigateParent = () => {
    if (!fbUser) {
      openAuth('login_parent');
      return;
    }
    setView('parent');
  };

  const handleNavigateCoach = () => {
    if (!fbUser || !isCoachUser(fbUser)) {
      openAuth('login_coach');
      return;
    }
    setView('coach');
  };

  const handleNavigatePrograms = () => {
    setView('home');
    setTimeout(() => {
      const el = document.getElementById('programs-section');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 60);
  };

  const handleNavigateRegister = () => {
    setView('home');
    setTimeout(() => {
      const el = document.getElementById('academy-register-section');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 60);
  };

  return (
    <div className="relative min-h-screen flex flex-col bg-[#F8F8F6] text-[#111315] overflow-x-hidden">
      {showIntroSplash && <KickboxingIntroSplash onComplete={handleCloseIntro} />}
      {/* Fixed App-Wide Academy Logo Background Watermark */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none"
      >
        <img
          src="/assets/aistudio/IMG_________________a6567e8f.jpg"
          alt=""
          className="w-full h-full object-cover opacity-[0.045]"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <img
            src="/alboob-logo.png"
            alt=""
            className="w-[300px] sm:w-[440px] h-[300px] sm:h-[440px] object-contain opacity-[0.07]"
          />
        </div>
      </div>

      {/* Cohesive Dark Obsidian Header */}
      <header className="sticky top-0 z-30 bg-[#0D0F12]/95 backdrop-blur-md text-white border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Zone 1: Brand Emblem + Wordmark */}
          <button
            type="button"
            onClick={() => setView('home')}
            className="inline-flex items-center gap-3 text-right hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
          >
            <img
              src="/alboob-logo.png"
              alt="شعار أكاديمية البوب"
              className="w-10 h-10 rounded-lg object-contain bg-[#111315] border border-[#D4A843]/50 shrink-0"
            />
            <div>
              <div className="text-base sm:text-lg font-extrabold tracking-tight text-white leading-tight">
                أكاديمية البوب
              </div>
              <div className="text-[10px] font-medium text-[#D4A843] leading-tight">
                كابتن باهر مراد · ميت غمر
              </div>
            </div>
          </button>

          {/* Zone 2: Clean 4-Item Desktop Navigation */}
          <nav className="hidden md:flex items-center bg-[#16191D] border border-zinc-800 rounded-lg p-1 gap-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setView('home')}
              className={`px-3.5 py-2 rounded-md transition-colors whitespace-nowrap ${
                view === 'home'
                  ? 'bg-[#D4A843] text-[#111315] font-bold'
                  : 'text-zinc-300 hover:text-white hover:bg-zinc-800/70'
              }`}
            >
              الرئيسية
            </button>
            <button
              type="button"
              onClick={handleNavigatePrograms}
              className="px-3.5 py-2 rounded-md text-zinc-300 hover:text-white hover:bg-zinc-800/70 transition-colors whitespace-nowrap"
            >
              البرامج والكتالوج
            </button>
            <button
              type="button"
              onClick={handleNavigateRegister}
              className="px-3.5 py-2 rounded-md text-zinc-300 hover:text-white hover:bg-zinc-800/70 transition-colors whitespace-nowrap"
            >
              التسجيل بالأكاديمية
            </button>
            <button
              type="button"
              onClick={handleNavigateParent}
              className={`px-3.5 py-2 rounded-md transition-colors whitespace-nowrap ${
                view === 'parent'
                  ? 'bg-[#D4A843] text-[#111315] font-bold'
                  : 'text-zinc-300 hover:text-white hover:bg-zinc-800/70'
              }`}
            >
              بوابة ولي الأمر
            </button>
          </nav>

          {/* Zone 3: Crisp Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleNavigateCoach}
              className={`hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap ${
                view === 'coach'
                  ? 'bg-[#D4A843] text-[#111315] border-[#D4A843]'
                  : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border-zinc-700'
              }`}
            >
              <Shield className="w-3.5 h-3.5 text-[#D4A843]" />
              <span>لوحة المدرب</span>
            </button>

            {fbUser ? (
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#B91C1C] hover:bg-[#991B1B] rounded-lg transition-colors whitespace-nowrap"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>خروج</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => openAuth('login_parent')}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-[#111315] bg-[#D4A843] hover:bg-[#c59834] rounded-lg transition-colors whitespace-nowrap"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>دخول البوابة</span>
              </button>
            )}
          </div>
        </div>

        {/* Balanced 4-Column Mobile App Navigation Bar */}
        <div className="md:hidden grid grid-cols-4 divide-x divide-x-reverse divide-zinc-800 border-t border-zinc-800 bg-[#121519] text-[11px] font-semibold">
          <button
            type="button"
            onClick={() => setView('home')}
            className={`py-2.5 flex items-center justify-center gap-1 transition-colors ${
              view === 'home' ? 'text-[#D4A843] bg-zinc-900/70' : 'text-zinc-300'
            }`}
          >
            <Home className="w-3.5 h-3.5" />
            <span>الرئيسية</span>
          </button>
          <button
            type="button"
            onClick={handleNavigateRegister}
            className="py-2.5 flex items-center justify-center gap-1 text-zinc-200 hover:text-[#D4A843] transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5 text-[#D4A843]" />
            <span>سجّل الآن</span>
          </button>
          <button
            type="button"
            onClick={handleNavigateParent}
            className={`py-2.5 flex items-center justify-center gap-1 transition-colors ${
              view === 'parent' ? 'text-[#D4A843] bg-zinc-900/70' : 'text-zinc-300'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>ولي الأمر</span>
          </button>
          <button
            type="button"
            onClick={handleNavigateCoach}
            className={`py-2.5 flex items-center justify-center gap-1 transition-colors ${
              view === 'coach' ? 'text-[#D4A843] bg-zinc-900/70' : 'text-zinc-300'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>المدرب</span>
          </button>
        </div>
      </header>

      {/* Main Viewport */}
      <main className="relative z-10 flex-1">
        {!authReady ? (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center text-sm text-zinc-500">
            جاري تهيئة المنصة...
          </div>
        ) : view === 'coach' && fbUser && isCoachUser(fbUser) && profile?.role === 'coach' ? (
          <CoachDashboard profile={profile} />
        ) : view === 'parent' && fbUser ? (
          profile ? (
            <ParentPortal profile={profile} emailVerified={fbUser.emailVerified} />
          ) : (
            <ParentOnboarding
              fbUser={fbUser}
              onComplete={(newProfile) => {
                setProfile(newProfile);
                setView('parent');
              }}
            />
          )
        ) : (
          <LandingView onOpenAuth={openAuth} />
        )}
      </main>

      {/* Quiet Footer */}
      <footer className="relative z-10 bg-white/95 backdrop-blur-sm border-t border-zinc-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <div>
            أكاديمية البوب للفنون القتالية (AL-BOOB ACADEMY) · ميت غمر، محافظة الدقهلية · كابتن باهر مراد ·{' '}
            <span className="font-mono" dir="ltr">
              01080486524
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <a
              href="https://maps.app.goo.gl/VXBhEwgYCcf5Nio27"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#111315] font-semibold transition-colors"
            >
              اللوكيشن (ميت غمر)
            </a>
            <a
              href="https://wa.me/201080486524"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-[#15803D] hover:bg-[#166534] text-white font-semibold rounded-md transition-colors"
            >
              واتساب: 01080486524
            </a>
            <button
              type="button"
              onClick={handleNavigateParent}
              className="hover:text-[#111315] transition-colors"
            >
              متابعة ولي الأمر
            </button>
            <button
              type="button"
              onClick={handleNavigateCoach}
              className="hover:text-[#111315] transition-colors"
            >
              دخول المدرب
            </button>
          </div>
        </div>
      </footer>

      <AuthModal
        isOpen={authModalOpen}
        initialTab={authModalTab}
        initialUsername={prefillUsername}
        onClose={() => setAuthModalOpen(false)}
        onAuthenticated={() => setAuthModalOpen(false)}
      />

      <OfflineIndicator />
    </div>
  );
}
