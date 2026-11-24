import { useState } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import { UserPlus } from 'lucide-react';
import { DISCIPLINES } from '../lib/format';
import { formatParentIdentifier, registerParentWithChild } from '../lib/firestoreApi';
import type { Discipline, UserProfile } from '../types';

interface ParentOnboardingProps {
  fbUser: FirebaseUser;
  onComplete: (profile: UserProfile) => void;
}

export function ParentOnboarding({ fbUser, onComplete }: ParentOnboardingProps) {
  const [parentName, setParentName] = useState(fbUser.displayName || '');
  const [phone, setPhone] = useState('');
  const [childName, setChildName] = useState('');
  const [childAge, setChildAge] = useState('9');
  const [discipline, setDiscipline] = useState<Discipline>('كيك بوكسينج');
  const [medicalNotes, setMedicalNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const profile = await registerParentWithChild(fbUser, {
        parentName,
        phone,
        childName,
        childAge: Number(childAge),
        discipline,
        medicalNotes,
      });
      onComplete(profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ البيانات. يرجى المحاولة مرة أخرى.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="bg-white/95 border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-5 bg-[#111315] text-white border-b border-zinc-800 flex items-center gap-3">
          <img
            src="/alboob-logo.png"
            alt="شعار أكاديمية البوب"
            className="w-9 h-9 rounded-md object-contain bg-[#111315] border border-[#D4A843]/40 shrink-0"
          />
          <div>
            <h1 className="text-lg font-bold">استكمال بيانات ولي الأمر واللاعب</h1>
            <p className="text-xs text-zinc-400 mt-0.5 font-mono" dir="ltr">
              {formatParentIdentifier(fbUser.email || '')}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <p className="text-sm text-zinc-600 leading-relaxed">
            أهلاً بك في أكاديمية البوب للفنون القتالية. أدخل بياناتك وبيانات ابنك مرة واحدة لربط حسابك بسجل الحضور والانصراف واستقبال إشعارات كابتن باهر مراد.
          </p>

          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                اسم ولي الأمر بالكامل *
              </label>
              <input
                type="text"
                required
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
                placeholder="مثال: محمد حسن علي"
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-zinc-300 rounded-lg focus:outline-none focus:border-[#111315]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                رقم الموبايل (للتواصل والواتساب) *
              </label>
              <input
                type="tel"
                required
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="010xxxxxxxx"
                className="w-full px-3.5 py-2.5 text-sm font-mono bg-white border border-zinc-300 rounded-lg focus:outline-none focus:border-[#111315] text-right"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-200 space-y-4">
            <div className="text-sm font-bold text-[#111315]">بيانات الابن / اللاعب</div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  اسم اللاعب بالكامل *
                </label>
                <input
                  type="text"
                  required
                  value={childName}
                  onChange={(e) => setChildName(e.target.value)}
                  placeholder="مثال: حمزة محمد حسن"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-zinc-300 rounded-lg focus:outline-none focus:border-[#111315]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  العمر (سنة) *
                </label>
                <input
                  type="number"
                  min={4}
                  max={35}
                  required
                  value={childAge}
                  onChange={(e) => setChildAge(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums bg-white border border-zinc-300 rounded-lg focus:outline-none focus:border-[#111315]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  التدريب (الاشتراك الشهري 250 ج.م)
                </label>
                <select
                  value={discipline}
                  onChange={(e) => setDiscipline(e.target.value as Discipline)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-zinc-300 rounded-lg focus:outline-none focus:border-[#111315]"
                >
                  {DISCIPLINES.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  ملاحظات صحية (اختياري)
                </label>
                <input
                  type="text"
                  value={medicalNotes}
                  onChange={(e) => setMedicalNotes(e.target.value)}
                  placeholder="مثال: لا توجد ملاحظات صحية"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-zinc-300 rounded-lg focus:outline-none focus:border-[#111315]"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3 px-5 bg-[#B91C1C] hover:bg-[#991B1B] text-white font-semibold text-sm rounded-lg transition-colors disabled:opacity-60"
          >
            <UserPlus className="w-4 h-4" />
            <span>{saving ? 'جاري حفظ البيانات...' : 'حفظ البيانات والدخول لبوابة ولي الأمر'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
