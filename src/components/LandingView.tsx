import { useState } from 'react';
import {
  ArrowLeft,
  Award,
  Bell,
  CalendarCheck,
  CheckCircle2,
  Clock,
  MapPin,
  MessageCircle,
  Phone,
  Send,
  ShieldCheck,
  UserPlus,
  Wallet,
} from 'lucide-react';
import { AcademyCatalogSection } from './AcademyCatalogSection';
import { AcademyImage } from './AcademyImage';
import { AcademyLinksSection } from './AcademyLinksSection';
import type { AuthModalTab } from './AuthModal';
import { PWAInstallButton } from './PWAInstallButton';
import { DISCIPLINES, DEFAULT_MONTHLY_FEE, formatCurrencyEGP } from '../lib/format';
import { SCHEDULE_MAP, submitPublicRegistrationRequest } from '../lib/firestoreApi';
import type { Discipline, RegistrationRequest } from '../types';

interface LandingViewProps {
  onOpenAuth: (tab: AuthModalTab) => void;
}

const COACH_PHONE_DISPLAY = '01080486524';
const COACH_WHATSAPP_BASE = 'https://wa.me/201080486524';

const PROGRAMS = [
  {
    num: '01',
    title: 'كيك بوكسينج (Kickboxing)',
    federation: 'الاتحاد المصري للكيك بوكسينج · E.K.F',
    schedule: 'الإثنين والأربعاء والجمعة · 5:00 م',
    fee: '250 ج.م / شهر',
    summary:
      'تدريب احترافي على اللكمات والركلات واللياقة البدنية العالية مع تجهيزات أمان كاملة وإشراف مباشر من الكابتن.',
  },
  {
    num: '02',
    title: 'كونغ فو (Wushu Kung-Fu)',
    federation: 'الاتحاد المصري للووشو كونغ فو · EWKF',
    schedule: 'الإثنين والأربعاء والجمعة · 5:00 م',
    fee: '250 ج.م / شهر',
    summary:
      'بناء المرونة والتوازن والدفاع عن النفس للناشئين وتنمية التركيز والثقة بالنفس وفق مناهج الاتحاد المصري.',
  },
  {
    num: '03',
    title: 'الفنون القتالية المختلطة (MMA)',
    federation: 'إعداد بدني وفني متكامل',
    schedule: 'الإثنين والأربعاء والجمعة · 5:00 م',
    fee: '250 ج.م / شهر',
    summary:
      'دمج منضبط بين الوقوف والقتال الأرضي والدفاع الشامل لرفع الكفاءة البدنية وقوة التحمل بأعلى معايير الأمان.',
  },
];

export function LandingView({ onOpenAuth }: LandingViewProps) {
  const [reqParentName, setReqParentName] = useState('');
  const [reqParentPhone, setReqParentPhone] = useState('');
  const [reqAthleteName, setReqAthleteName] = useState('');
  const [reqAge, setReqAge] = useState('10');
  const [reqDiscipline, setReqDiscipline] = useState<Discipline>('كيك بوكسينج');
  const [reqNotes, setReqNotes] = useState('');
  const [submittingReq, setSubmittingReq] = useState(false);
  const [reqError, setReqError] = useState('');
  const [submittedReq, setSubmittedReq] = useState<RegistrationRequest | null>(null);

  const scrollToRegistration = (presetDiscipline?: Discipline) => {
    if (presetDiscipline) {
      setReqDiscipline(presetDiscipline);
    }
    const el = document.getElementById('academy-register-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setReqError('');
    setSubmittingReq(true);
    try {
      const created = await submitPublicRegistrationRequest({
        parentName: reqParentName,
        parentPhone: reqParentPhone,
        athleteName: reqAthleteName,
        age: Number(reqAge),
        discipline: reqDiscipline,
        notes: reqNotes,
      });
      setSubmittedReq(created);
      setReqParentName('');
      setReqParentPhone('');
      setReqAthleteName('');
      setReqAge('10');
      setReqNotes('');
    } catch (err) {
      setReqError(err instanceof Error ? err.message : 'تعذر إرسال طلب التسجيل، يرجى المحاولة مرة أخرى');
    } finally {
      setSubmittingReq(false);
    }
  };

  const buildRequestWhatsAppHref = (req: RegistrationRequest) => {
    const lines = [
      'السلام عليكم كابتن باهر، أرسلت طلب تسجيل جديد في أكاديمية البوب:',
      `اللاعب: ${req.athleteName} (${req.age} سنة)`,
      `التدريب المطلوب: ${req.discipline}`,
      `ولي الأمر: ${req.parentName}`,
      `رقم الهاتف: ${req.parentPhone}`,
      req.notes ? `ملاحظات: ${req.notes}` : '',
    ].filter(Boolean);
    return `${COACH_WHATSAPP_BASE}?text=${encodeURIComponent(lines.join('\n'))}`;
  };

  const generalWhatsAppHref = `${COACH_WHATSAPP_BASE}?text=${encodeURIComponent(
    'السلام عليكم كابتن باهر، أرغب في الاستفسار والتسجيل في أكاديمية البوب للفنون القتالية.'
  )}`;

  return (
    <div>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-[#111315] text-white border-b border-zinc-800">
        <img
          src="/assets/aistudio/IMG_________________a6567e8f.jpg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 w-full h-full object-cover opacity-20"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#111315]/85 via-[#111315]/80 to-[#111315]/95"
        />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-between gap-8">
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-lg overflow-hidden border border-[#D4A843]/40 bg-[#111315] shrink-0">
                    <AcademyImage
                      src="/alboob-logo.png"
                      alt="شعار أكاديمية البوب للفنون القتالية"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-[#D4A843] tracking-wide">
                      AL-BOOB ACADEMY · أكاديمية البوب للفنون القتالية
                    </div>
                    <div className="text-xs text-zinc-400 mt-1">
                      بإشراف كابتن باهر مراد · معتمدة لدى E.K.F و EWKF
                    </div>
                  </div>
                </div>

                <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-extrabold leading-[1.22] text-white [text-wrap:balance]">
                  متابعة لحظية لحضور وانصراف أبنائكم وإدارة شاملة للأكاديمية
                </h1>

                <p className="text-base text-zinc-300 leading-relaxed max-w-xl">
                  منصة خاصة بأكاديمية البوب للفنون القتالية مع كابتن باهر مراد. يمكنك تقديم طلب
                  تسجيل لاعب جديد مباشرة، أو الدخول لبوابة ولي الأمر لاستلام إشعارات الحضور
                  والانصراف الفورية وسجل الاشتراكات.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2.5">
                  {/* Primary 2-Button Action Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => scrollToRegistration()}
                      className="flex items-center justify-center gap-2.5 px-5 py-3.5 bg-[#D4A843] hover:bg-[#c29634] text-[#111315] font-extrabold text-sm rounded-xl shadow-lg shadow-[#D4A843]/15 transition-colors whitespace-nowrap"
                    >
                      <UserPlus className="w-4 h-4 shrink-0" />
                      <span>طلب تسجيل بالأكاديمية</span>
                    </button>
                    <a
                      href={generalWhatsAppHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2.5 px-5 py-3.5 bg-[#15803D] hover:bg-[#166534] text-white font-bold text-sm rounded-xl border border-emerald-400/25 transition-colors whitespace-nowrap"
                    >
                      <MessageCircle className="w-4 h-4 shrink-0" />
                      <span>تواصل واتساب · {COACH_PHONE_DISPLAY}</span>
                    </a>
                  </div>

                  {/* Unified Portal & App Quick Dock */}
                  <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl overflow-hidden flex flex-wrap divide-x divide-x-reverse divide-zinc-800">
                    <button
                      type="button"
                      onClick={() => onOpenAuth('login_parent')}
                      className="flex-1 min-w-[130px] flex items-center justify-center gap-2 px-3.5 py-2.5 hover:bg-zinc-800 text-zinc-100 text-xs font-semibold transition-colors whitespace-nowrap"
                    >
                      <ShieldCheck className="w-4 h-4 text-[#D4A843] shrink-0" />
                      <span>دخول ولي الأمر</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenAuth('login_coach')}
                      className="flex-1 min-w-[130px] flex items-center justify-center gap-2 px-3.5 py-2.5 hover:bg-zinc-800 text-zinc-200 text-xs font-semibold transition-colors whitespace-nowrap"
                    >
                      <Award className="w-4 h-4 text-[#D4A843] shrink-0" />
                      <span>حساب الكابتن</span>
                    </button>
                    <PWAInstallButton variant="dock" />
                  </div>
                </div>

                <div className="text-xs text-zinc-400 flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-1">
                  <span className="inline-flex items-center gap-1 text-zinc-200 font-medium">
                    <MapPin className="w-3.5 h-3.5 text-[#D4A843]" />
                    <span>ميت غمر — محافظة الدقهلية</span>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>الإثنين والأربعاء والجمعة 5:00 م</span>
                  <span aria-hidden="true">·</span>
                  <span>الاشتراك 250 ج.م</span>
                  <span aria-hidden="true">·</span>
                  <a
                    href={`tel:${COACH_PHONE_DISPLAY}`}
                    className="inline-flex items-center gap-1 text-zinc-300 hover:text-[#D4A843]"
                  >
                    <Phone className="w-3 h-3 text-[#D4A843]" />
                    <span dir="ltr" className="font-mono">{COACH_PHONE_DISPLAY}</span>
                  </a>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="relative h-72 sm:h-96 lg:h-full min-h-[340px] rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900">
                <AcademyImage
                  src="/assets/aistudio/FB_IMG_17932178214766992_5076c43e.jpg"
                  alt="كابتن باهر مراد بحزام البطولة في أكاديمية البوب للفنون القتالية"
                  className="w-full h-full object-cover object-top"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
                <div className="absolute bottom-0 inset-x-0 p-5 sm:p-6 flex items-end justify-between gap-4">
                  <div>
                    <div className="text-xs font-medium text-[#D4A843]">قيادة كابتن باهر مراد</div>
                    <div className="text-base sm:text-lg font-bold text-white mt-0.5">
                      انضباط رياضي · متابعة وأمان تام للناشئين
                    </div>
                  </div>
                  <div className="text-left text-xs text-zinc-300 font-mono tabular-nums">
                    E.K.F · EWKF
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Structured 4-Column Feature Bar */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="bg-white/95 border border-zinc-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-zinc-200 overflow-hidden">
          <div className="p-4 sm:p-5 flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center text-[#B91C1C] shrink-0">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-[#111315]">إشعارات الحضور والتذكير</h3>
              <p className="text-[11px] text-zinc-600 mt-1 leading-relaxed">
                إشعار تلقائي بموعد التمرين وفوري لولي الأمر عند الحضور والانصراف.
              </p>
            </div>
          </div>

          <div className="p-4 sm:p-5 flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center text-[#111315] shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-[#111315]">تسجيل أونلاين مباشر</h3>
              <p className="text-[11px] text-zinc-600 mt-1 leading-relaxed">
                أرسل طلب انضمام اللاعب خلال دقيقة ليصل مباشرة لكابتن باهر مراد.
              </p>
            </div>
          </div>

          <div className="p-4 sm:p-5 flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-[#A17415] shrink-0">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-[#111315]">اشتراك شهري 250 ج.م</h3>
              <p className="text-[11px] text-zinc-600 mt-1 leading-relaxed">
                متابعة دقيقة لسداد الاشتراك الشهري وإشعار تأكيد فوري لولي الأمر.
              </p>
            </div>
          </div>

          <div className="p-4 sm:p-5 flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#15803D] shrink-0">
              <CalendarCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-[#111315]">تقرير شهري منتظم</h3>
              <p className="text-[11px] text-zinc-600 mt-1 leading-relaxed">
                حصر تلقائي لأيام الحضور والغياب ونسبة التزام اللاعب كل شهر.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Official Platforms & Location Section (Top Unified Box) */}
      <AcademyLinksSection />

      {/* Disciplines & Schedules Section */}
      <section id="programs-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="text-xs font-semibold text-[#B91C1C]">البرامج التدريبية المتاحة</div>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#111315] mt-1">
              التدريبات في أكاديمية البوب — الاشتراك 250 ج.م
            </h2>
          </div>
          <p className="text-sm text-zinc-600 max-w-md">
            تدريبات متخصصة في الكيك بوكسينج والكونغ فو و MMA تحت إشراف كابتن باهر مراد.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 bg-white border border-zinc-200 rounded-xl divide-y divide-zinc-200">
            {PROGRAMS.map((prog) => (
              <div key={prog.num} className="p-6 flex flex-col sm:flex-row sm:items-start gap-4">
                <div className="font-mono text-sm font-semibold text-[#A17415] tabular-nums shrink-0 pt-0.5">
                  {prog.num}.
                </div>
                <div className="flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-lg font-bold text-[#111315]">{prog.title}</h3>
                    <span className="text-xs font-mono font-semibold text-[#111315] tabular-nums">
                      {prog.fee}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-500 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span>{prog.federation}</span>
                    <span aria-hidden="true">·</span>
                    <span>{prog.schedule}</span>
                  </div>
                  <p className="text-sm text-zinc-600 leading-relaxed pt-1">{prog.summary}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-6">
            <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
              <div className="aspect-[4/3] bg-zinc-900">
                <AcademyImage
                  src="/assets/aistudio/IMG_________________ab1d1edc.jpg"
                  alt="تدريب الكيك بوكسينج و MMA في حلبة أكاديمية البوب"
                  className="w-full h-full object-cover object-top"
                />
              </div>
              <div className="p-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-[#111315]">كيك بوكسينج و MMA</div>
                  <div className="text-xs text-zinc-500 mt-0.5">الاشتراك الشهري 250 ج.م فقط</div>
                </div>
                <button
                  type="button"
                  onClick={() => scrollToRegistration('كيك بوكسينج')}
                  className="text-xs font-semibold text-[#B91C1C] hover:text-[#991B1B] flex items-center gap-1 whitespace-nowrap shrink-0"
                >
                  <span>سجّل الآن</span>
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
              <div className="aspect-[4/3] bg-zinc-900">
                <AcademyImage
                  src="/assets/aistudio/FB_IMG_17932179066353097_d77d218b.jpg"
                  alt="تدريب الكونغ فو واللياقة للناشئين في أكاديمية البوب"
                  className="w-full h-full object-cover object-top"
                />
              </div>
              <div className="p-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-[#111315]">تدريب الكونغ فو للناشئين</div>
                  <div className="text-xs text-zinc-500 mt-0.5">
                    بإشراف كابتن باهر مراد · {COACH_PHONE_DISPLAY}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => scrollToRegistration('كونغ فو')}
                  className="text-xs font-semibold text-[#B91C1C] hover:text-[#991B1B] flex items-center gap-1 whitespace-nowrap shrink-0"
                >
                  <span>سجّل الآن</span>
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Academy Photo Catalog for Prospective Applicants */}
      <AcademyCatalogSection onRegisterClick={() => scrollToRegistration()} />

      {/* Academy Official Info + Public Registration Request Section */}
      <section
        id="academy-register-section"
        className="bg-white/95 border-y border-zinc-200 py-14"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <div className="text-xs font-semibold text-[#B91C1C]">
              التسجيل والتواصل الرسمي
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#111315] mt-1">
              بيانات أكاديمية البوب وتقديم طلب تسجيل لاعب جديد
            </h2>
            <p className="text-sm text-zinc-600 mt-2 max-w-2xl">
              يمكنك إرسال طلب تسجيل لاعب جديد للأكاديمية مباشرة من هنا بدون الحاجة لحساب مسبق، أو
              التواصل الفوري مع كابتن باهر مراد عبر الواتساب.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Academy Official Details + WhatsApp Card */}
            <div className="lg:col-span-5 bg-[#111315] text-white border border-zinc-800 rounded-xl p-6 space-y-6">
              <div className="flex items-center gap-3.5 pb-5 border-b border-zinc-800">
                <div className="w-12 h-12 rounded-lg overflow-hidden border border-[#D4A843]/40 bg-[#111315] shrink-0">
                  <AcademyImage
                    src="/alboob-logo.png"
                    alt="أكاديمية البوب"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#D4A843]">
                    أكاديمية البوب للفنون القتالية
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">AL-BOOB MARTIAL ARTS ACADEMY</p>
                </div>
              </div>

              <div className="space-y-4 text-sm">
                <div className="flex items-start gap-3">
                  <Award className="w-4 h-4 text-[#D4A843] mt-1 shrink-0" />
                  <div>
                    <div className="text-xs text-zinc-400">المدير الفني والمشرف العام</div>
                    <div className="font-bold text-white mt-0.5">كابتن باهر مراد</div>
                    <div className="text-xs text-zinc-400 mt-0.5">
                      معتمدة من الاتحاد المصري للكيك بوكسينج (E.K.F) والووشو كونغ فو (EWKF)
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Clock className="w-4 h-4 text-[#D4A843] mt-1 shrink-0" />
                  <div className="flex-1">
                    <div className="text-xs text-zinc-400">مواعيد التدريبات الأسبوعية (جميع الألعاب)</div>
                    <div className="font-bold text-white mt-0.5">
                      الإثنين والأربعاء والجمعة · الساعة 5:00 مساءً
                    </div>
                    <ul className="mt-1.5 space-y-1 text-xs text-zinc-300">
                      <li className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-white">كيك بوكسينج</span>
                        <span>الإثنين والأربعاء والجمعة · 5:00 م</span>
                      </li>
                      <li className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-white">كونغ فو للناشئين</span>
                        <span>الإثنين والأربعاء والجمعة · 5:00 م</span>
                      </li>
                      <li className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-white">MMA</span>
                        <span>الإثنين والأربعاء والجمعة · 5:00 م</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Wallet className="w-4 h-4 text-[#D4A843] mt-1 shrink-0" />
                  <div>
                    <div className="text-xs text-zinc-400">الاشتراك الشهري الموحد</div>
                    <div className="font-bold text-white font-mono tabular-nums mt-0.5">
                      {formatCurrencyEGP(DEFAULT_MONTHLY_FEE)} / شهرياً لجميع الألعاب
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-[#D4A843] mt-1 shrink-0" />
                  <div>
                    <div className="text-xs text-zinc-400">العنوان والموقع</div>
                    <div className="font-bold text-white mt-0.5">
                      ميت غمر — محافظة الدقهلية
                    </div>
                    <a
                      href="https://maps.app.goo.gl/VXBhEwgYCcf5Nio27"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block text-xs text-[#D4A843] hover:underline mt-0.5"
                    >
                      عرض اللوكيشن على خرائط Google
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Phone className="w-4 h-4 text-[#D4A843] mt-1 shrink-0" />
                  <div>
                    <div className="text-xs text-zinc-400">رقم الهاتف والواتساب الرسمي</div>
                    <div className="font-bold text-white font-mono text-base mt-0.5" dir="ltr">
                      {COACH_PHONE_DISPLAY}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-800 space-y-2.5">
                <a
                  href={generalWhatsAppHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#15803D] hover:bg-[#166534] text-white text-sm font-bold rounded-lg transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>تواصل واتساب مباشر ({COACH_PHONE_DISPLAY})</span>
                </a>
                <a
                  href={`tel:${COACH_PHONE_DISPLAY}`}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-semibold rounded-lg border border-zinc-700 transition-colors"
                >
                  <Phone className="w-3.5 h-3.5 text-[#D4A843]" />
                  <span>اتصال هاتفي بكابتن باهر مراد</span>
                </a>
              </div>
            </div>

            {/* Public Registration Request Form */}
            <div className="lg:col-span-7 bg-[#F8F8F6] border border-zinc-200 rounded-xl p-6 sm:p-8">
              {submittedReq ? (
                <div className="bg-white border border-emerald-200 rounded-xl p-6 space-y-5">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-700 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-lg font-bold text-[#111315]">
                        تم استلام طلب التسجيل بنجاح
                      </h3>
                      <p className="text-sm text-zinc-600 mt-1">
                        وصل طلبك مباشرة إلى لوحة كابتن باهر مراد وسيتم مراجعته والتواصل معكم على
                        رقم <span className="font-mono font-semibold" dir="ltr">{submittedReq.parentPhone}</span>.
                      </p>
                    </div>
                  </div>

                  <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-zinc-500">رقم الطلب:</span>{' '}
                      <span className="font-mono font-bold text-[#111315]">{submittedReq.id}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500">اسم اللاعب:</span>{' '}
                      <span className="font-bold text-[#111315]">
                        {submittedReq.athleteName} ({submittedReq.age} سنة)
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500">التدريب المختار:</span>{' '}
                      <span className="font-bold text-[#111315]">{submittedReq.discipline}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500">ولي الأمر:</span>{' '}
                      <span className="font-bold text-[#111315]">{submittedReq.parentName}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <a
                      href={buildRequestWhatsAppHref(submittedReq)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#15803D] hover:bg-[#166534] text-white text-xs font-bold rounded-lg transition-colors"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>إرسال تفاصيل الطلب واتساب لـ {COACH_PHONE_DISPLAY}</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => setSubmittedReq(null)}
                      className="px-4 py-2.5 bg-white border border-zinc-300 hover:border-[#111315] text-[#111315] text-xs font-semibold rounded-lg transition-colors"
                    >
                      تقديم طلب تسجيل للاعب آخر
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmitRequest} className="space-y-4">
                  <div className="pb-3 border-b border-zinc-200">
                    <h3 className="text-lg font-bold text-[#111315]">
                      استمارة طلب التحاق بالأكاديمية
                    </h3>
                    <p className="text-xs text-zinc-500 mt-1">
                      املأ بيانات ولي الأمر واللاعب واضغط إرسال لتسجيل الطلب فوراً لدى الإدارة.
                    </p>
                  </div>

                  {reqError && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg">
                      {reqError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="pub-parent-name"
                        className="block text-xs font-semibold text-zinc-700 mb-1.5"
                      >
                        اسم ولي الأمر بالكامل *
                      </label>
                      <input
                        id="pub-parent-name"
                        type="text"
                        required
                        value={reqParentName}
                        onChange={(e) => setReqParentName(e.target.value)}
                        placeholder="مثال: محمود أحمد حسن"
                        className="w-full px-3.5 py-2.5 text-sm bg-white border border-zinc-300 rounded-lg focus:outline-none focus:border-[#111315]"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="pub-parent-phone"
                        className="block text-xs font-semibold text-zinc-700 mb-1.5"
                      >
                        رقم الموبايل (واتساب) *
                      </label>
                      <input
                        id="pub-parent-phone"
                        type="tel"
                        required
                        dir="ltr"
                        value={reqParentPhone}
                        onChange={(e) => setReqParentPhone(e.target.value)}
                        placeholder="010xxxxxxxx"
                        className="w-full px-3.5 py-2.5 text-sm font-mono bg-white border border-zinc-300 rounded-lg text-right focus:outline-none focus:border-[#111315]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <label
                        htmlFor="pub-athlete-name"
                        className="block text-xs font-semibold text-zinc-700 mb-1.5"
                      >
                        اسم اللاعب / الابن *
                      </label>
                      <input
                        id="pub-athlete-name"
                        type="text"
                        required
                        value={reqAthleteName}
                        onChange={(e) => setReqAthleteName(e.target.value)}
                        placeholder="مثال: سيف محمود أحمد"
                        className="w-full px-3.5 py-2.5 text-sm bg-white border border-zinc-300 rounded-lg focus:outline-none focus:border-[#111315]"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="pub-athlete-age"
                        className="block text-xs font-semibold text-zinc-700 mb-1.5"
                      >
                        العمر (سنة) *
                      </label>
                      <input
                        id="pub-athlete-age"
                        type="number"
                        min={4}
                        max={35}
                        required
                        value={reqAge}
                        onChange={(e) => setReqAge(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-sm font-mono bg-white border border-zinc-300 rounded-lg focus:outline-none focus:border-[#111315]"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="pub-discipline"
                      className="block text-xs font-semibold text-zinc-700 mb-1.5"
                    >
                      التدريب المطلوب *
                    </label>
                    <select
                      id="pub-discipline"
                      value={reqDiscipline}
                      onChange={(e) => setReqDiscipline(e.target.value as Discipline)}
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-zinc-300 rounded-lg focus:outline-none focus:border-[#111315]"
                    >
                      {DISCIPLINES.map((d) => (
                        <option key={d} value={d}>
                          {d} — {SCHEDULE_MAP[d]}
                        </option>
                      ))}
                    </select>
                    <div className="text-[11px] text-zinc-500 mt-1.5">
                      الاشتراك الشهري الموحد: {formatCurrencyEGP(DEFAULT_MONTHLY_FEE)} ·{' '}
                      {SCHEDULE_MAP[reqDiscipline]}
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="pub-notes"
                      className="block text-xs font-semibold text-zinc-700 mb-1.5"
                    >
                      ملاحظات صحية أو استفسار إضافي (اختياري)
                    </label>
                    <textarea
                      id="pub-notes"
                      rows={3}
                      maxLength={400}
                      value={reqNotes}
                      onChange={(e) => setReqNotes(e.target.value)}
                      placeholder="مثال: مستوى اللياقة أو أي ملاحظات صحية أو ميعاد مفضل للتواصل"
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-zinc-300 rounded-lg focus:outline-none focus:border-[#111315]"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={submittingReq}
                      className="flex-1 flex items-center justify-center gap-2 py-3 px-5 bg-[#B91C1C] hover:bg-[#991B1B] text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-60"
                    >
                      <Send className="w-4 h-4" />
                      <span>
                        {submittingReq ? 'جاري إرسال الطلب...' : 'إرسال طلب التسجيل للأكاديمية'}
                      </span>
                    </button>
                    <a
                      href={generalWhatsAppHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 py-3 px-4 bg-[#15803D] hover:bg-[#166534] text-white text-xs font-bold rounded-lg transition-colors whitespace-nowrap"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>أو راسلنا واتساب</span>
                    </a>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Portal Entry Strip */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-[#111315] text-white rounded-xl p-6 sm:p-10 border border-zinc-800 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="text-xs font-semibold text-[#D4A843]">
              أكاديمية البوب · كابتن باهر مراد ({COACH_PHONE_DISPLAY})
            </div>
            <h2 className="text-2xl font-bold">هل طفلك مشترك بالفعل في الأكاديمية؟</h2>
            <p className="text-sm text-zinc-300 leading-relaxed">
              ادخل لبوابة ولي الأمر لمتابعة إشعارات الحضور والانصراف وسداد الاشتراكات، أو سجّل حساب
              جديد بحساب Google أو ببيانات الدخول المرسلة من كابتن باهر مراد.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 shrink-0 w-full lg:w-auto">
            <button
              type="button"
              onClick={() => onOpenAuth('register_parent')}
              className="px-5 py-3 bg-[#D4A843] hover:bg-[#c29634] text-[#111315] font-bold text-xs sm:text-sm rounded-xl transition-colors whitespace-nowrap"
            >
              تسجيل حساب ولي أمر
            </button>
            <button
              type="button"
              onClick={() => onOpenAuth('login_parent')}
              className="px-5 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-xs sm:text-sm rounded-xl border border-zinc-700 transition-colors whitespace-nowrap"
            >
              دخول ولي الأمر
            </button>
            <button
              type="button"
              onClick={() => onOpenAuth('login_coach')}
              className="px-5 py-3 bg-zinc-900 hover:bg-zinc-800 text-[#D4A843] font-semibold text-xs sm:text-sm rounded-xl border border-[#D4A843]/40 transition-colors whitespace-nowrap"
            >
              دخول كابتن باهر مراد
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
