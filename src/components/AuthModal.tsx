import { useEffect, useState } from 'react';
import { Eye, EyeOff, KeyRound, X } from 'lucide-react';
import { COACH_ADMIN_EMAIL } from '../lib/firebase';
import {
  isCoachUser,
  signInParentWithCredentials,
  signInWithGoogle,
  signOutAccount,
} from '../lib/firestoreApi';

export type AuthModalTab = 'login_parent' | 'register_parent' | 'login_coach';

interface AuthModalProps {
  isOpen: boolean;
  initialTab: AuthModalTab;
  initialUsername?: string;
  onClose: () => void;
  onAuthenticated: () => void;
}

export function AuthModal({
  isOpen,
  initialTab,
  initialUsername = '',
  onClose,
  onAuthenticated,
}: AuthModalProps) {
  const [tab, setTab] = useState<AuthModalTab>(initialTab);
  const [username, setUsername] = useState(initialUsername);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setTab(initialTab);
      setError('');
      setPassword('');
      if (initialUsername) {
        setUsername(initialUsername);
      }
    }
  }, [isOpen, initialTab, initialUsername]);

  if (!isOpen) return null;

  const switchTab = (next: AuthModalTab) => {
    setTab(next);
    setError('');
  };

  const handleParentCredentialsLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const fbUser = await signInParentWithCredentials(username, password);
      if (isCoachUser(fbUser)) {
        await signOutAccount();
        setError('للدخول كمدرب يرجى استخدام تبويب «حساب المدرب».');
        return;
      }
      onAuthenticated();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'تعذر تسجيل الدخول. يرجى التحقق من اسم المستخدم وكلمة المرور.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError('');
    setLoading(true);
    try {
      const fbUser = await signInWithGoogle();
      if (tab === 'login_coach' && !isCoachUser(fbUser)) {
        await signOutAccount();
        setError(
          `لوحة المدرب مخصصة لحساب كابتن باهر مراد المعتمد (${COACH_ADMIN_EMAIL}). للدخول كولي أمر اختر «دخول ولي الأمر».`
        );
        return;
      }
      onAuthenticated();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('popup-closed-by-user')) {
        setError('تم إغلاق نافذة تسجيل الدخول قبل إتمام الخطوة.');
      } else if (msg.includes('popup-blocked')) {
        setError('يرجى السماح بالنوافذ المنبثقة (Popups) في المتصفح لإتمام تسجيل الدخول بحساب Google.');
      } else {
        setError('تعذر إتمام تسجيل الدخول بحساب Google. يرجى المحاولة مرة أخرى.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="w-full max-w-lg bg-white/95 border border-zinc-200 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 bg-[#111315] text-white border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <img
              src="/alboob-logo.png"
              alt="شعار أكاديمية البوب"
              className="w-8 h-8 rounded-md object-contain bg-[#111315] border border-[#D4A843]/40 shrink-0"
            />
            <h2 id="auth-modal-title" className="text-lg font-bold">
              بوابة أكاديمية البوب
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-lg transition-colors"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pt-5 pb-2">
          <div className="grid grid-cols-3 gap-1 p-1 bg-zinc-100 rounded-lg border border-zinc-200">
            <button
              type="button"
              onClick={() => switchTab('register_parent')}
              className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                tab === 'register_parent'
                  ? 'bg-white text-[#111315] shadow-sm'
                  : 'text-zinc-600 hover:text-[#111315]'
              }`}
            >
              تسجيل ولي أمر جديد
            </button>
            <button
              type="button"
              onClick={() => switchTab('login_parent')}
              className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                tab === 'login_parent'
                  ? 'bg-white text-[#111315] shadow-sm'
                  : 'text-zinc-600 hover:text-[#111315]'
              }`}
            >
              دخول ولي الأمر
            </button>
            <button
              type="button"
              onClick={() => switchTab('login_coach')}
              className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                tab === 'login_coach'
                  ? 'bg-[#111315] text-[#D4A843] shadow-sm'
                  : 'text-zinc-600 hover:text-[#111315]'
              }`}
            >
              حساب المدرب
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg leading-relaxed">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-[#111315]">
              {tab === 'login_coach'
                ? 'دخول كابتن باهر مراد (إدارة الأكاديمية)'
                : tab === 'register_parent'
                  ? 'إنشاء حساب ولي أمر ومتابعة الابن'
                  : 'تسجيل دخول ولي الأمر'}
            </h3>
            <p className="text-sm text-zinc-600 leading-relaxed">
              {tab === 'login_coach'
                ? 'لضمان أمان بيانات اللاعبين والاشتراكات، يتم الدخول إلى لوحة المدرب عبر حساب Google الرسمي المعتمد للأكاديمية.'
                : tab === 'register_parent'
                  ? 'سجّل الدخول بحساب Google الخاص بك في خطوة واحدة، ثم أدخل اسمك ورقم هاتفك وبيانات ابنك لاستقبال إشعارات الحضور والانصراف الفورية.'
                  : 'ادخل باسم المستخدم وكلمة المرور المرسلين من الكابتن (أو بحساب Google) لمتابعة الحضور والإشعارات من أي هاتف.'}
            </p>
          </div>

          {tab === 'login_parent' && (
            <form onSubmit={handleParentCredentialsLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  اسم المستخدم أو رقم الموبايل
                </label>
                <input
                  type="text"
                  required
                  dir="ltr"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="مثال: 01012345678 أو user2026"
                  className="w-full px-3.5 py-2.5 text-sm font-mono bg-zinc-50 border border-zinc-300 rounded-lg focus:outline-none focus:border-[#111315] text-right"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  كلمة المرور
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    dir="ltr"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••"
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm font-mono bg-zinc-50 border border-zinc-300 rounded-lg focus:outline-none focus:border-[#111315] text-right"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-[#111315]"
                    aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 px-5 font-semibold text-sm bg-[#B91C1C] hover:bg-[#991B1B] text-white rounded-lg transition-colors disabled:opacity-60"
              >
                <KeyRound className="w-4 h-4" />
                <span>{loading ? 'جاري تسجيل الدخول...' : 'دخول لبوابة ولي الأمر'}</span>
              </button>

              <p className="text-[11px] text-zinc-500 leading-relaxed">
                سيبقى الحساب مفتوحاً تلقائياً على هاتفك بعد الدخول، ويمكن استخدام نفس اسم المستخدم وكلمة المرور على أكثر من هاتف في نفس الوقت.
              </p>

              <div className="relative flex items-center py-1">
                <div className="flex-grow border-t border-zinc-200" />
                <span className="shrink-0 mx-3 text-xs text-zinc-400">أو</span>
                <div className="flex-grow border-t border-zinc-200" />
              </div>
            </form>
          )}

          <button
            type="button"
            disabled={loading}
            onClick={handleGoogleAuth}
            className={`w-full flex items-center justify-center gap-3 py-3.5 px-5 font-semibold text-sm rounded-lg transition-colors disabled:opacity-60 ${
              tab === 'login_coach'
                ? 'bg-[#111315] hover:bg-zinc-800 text-[#D4A843]'
                : tab === 'login_parent'
                  ? 'bg-zinc-100 hover:bg-zinc-200 text-[#111315] border border-zinc-300'
                  : 'bg-[#B91C1C] hover:bg-[#991B1B] text-white'
            }`}
          >
            <svg className="w-5 h-5 bg-white rounded-sm p-0.5 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
              />
            </svg>
            <span>
              {loading
                ? 'جاري التحقق من الحساب...'
                : tab === 'login_coach'
                  ? 'دخول المدرب بحساب Google'
                  : 'المتابعة بحساب Google'}
            </span>
          </button>

          <div className="pt-3 border-t border-zinc-200 text-xs text-zinc-500 leading-relaxed">
            {tab === 'login_coach' ? (
              <span>
                الحساب المعتمد لإدارة الأكاديمية: <span className="font-mono">{COACH_ADMIN_EMAIL}</span>
              </span>
            ) : (
              <span>
                الاشتراك الشهري الموحد 250 ج.م · كيك بوكسينج · كونغ فو · MMA · للتواصل:{' '}
                <span className="font-mono" dir="ltr">
                  01080486524
                </span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
