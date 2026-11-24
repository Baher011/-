import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  Bell,
  BellRing,
  Calendar,
  CalendarCheck,
  CalendarOff,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  FileText,
  HeartPulse,
  ImagePlus,
  LogOut,
  MapPin,
  MessageCircle,
  MessageSquare,
  Plus,
  Send,
  Trash2,
  UserCheck,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';
import {
  attachForegroundFcmListener,
  showLocalPushNotification,
} from '../lib/fcm';
import {
  SCHEDULE_MAP,
  addParentChild,
  deleteCatalogPhoto,
  formatParentIdentifier,
  markAllNotificationsRead,
  markNotificationRead,
  parentSendMessage,
  parentSubmitCatalogPhoto,
  subscribeParentPortal,
} from '../lib/firestoreApi';
import {
  DISCIPLINES,
  formatArabicDate,
  formatArabicMonth,
  formatArabicTime,
  formatCurrencyEGP,
  getArabicWeekdayName,
  getAthleteDisplayCode,
  getCurrentMonthString,
  getNextTrainingSessionInfo,
  getTodayDateString,
  isTrainingDayDate,
} from '../lib/format';
import { compressImageFileToDataUrl } from '../lib/imageCompression';
import type {
  AcademyHoliday,
  AcademyNotification,
  Athlete,
  AttendanceRecord,
  CatalogCategory,
  CatalogPhotoItem,
  Discipline,
  ParentMessage,
  PaymentRecord,
  UserProfile,
} from '../types';
import { PWAInstallButton } from './PWAInstallButton';
import { PushNotificationButton } from './PushNotificationButton';

type ParentTab = 'profile_training' | 'notifications_messages' | 'catalog_photos';

const PHOTO_CATEGORIES: Array<{ value: CatalogCategory; label: string }> = [
  { value: 'champions', label: 'أبطال وتكريمات' },
  { value: 'training', label: 'داخل التمرين واللياقة' },
  { value: 'coach', label: 'مع كابتن باهر مراد' },
  { value: 'identity', label: 'فعاليات الأكاديمية' },
];

interface ParentPortalProps {
  profile: UserProfile;
  emailVerified: boolean;
}

export function ParentPortal({ profile, emailVerified }: ParentPortalProps) {
  const [activeTab, setActiveTab] = useState<ParentTab>('profile_training');
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthString());
  const today = getTodayDateString();

  const [children, setChildren] = useState<Athlete[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [notifications, setNotifications] = useState<AcademyNotification[]>([]);
  const [sentMessages, setSentMessages] = useState<ParentMessage[]>([]);
  const [holidays, setHolidays] = useState<AcademyHoliday[]>([]);
  const [submittedPhotos, setSubmittedPhotos] = useState<CatalogPhotoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [liveToast, setLiveToast] = useState<AcademyNotification | null>(null);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  // Add child modal
  const [showAddChild, setShowAddChild] = useState(false);
  const [childName, setChildName] = useState('');
  const [childAge, setChildAge] = useState('8');
  const [childDiscipline, setChildDiscipline] = useState<Discipline>('كيك بوكسينج');
  const [childNotes, setChildNotes] = useState('');
  const [submittingChild, setSubmittingChild] = useState(false);
  const [childFormError, setChildFormError] = useState('');

  // Send message to coach
  const [showMessageCoach, setShowMessageCoach] = useState(false);
  const [msgAthleteId, setMsgAthleteId] = useState('');
  const [msgSubject, setMsgSubject] = useState('');
  const [msgBody, setMsgBody] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [msgError, setMsgError] = useState('');
  const [msgSuccess, setMsgSuccess] = useState('');

  // Catalog photo submission
  const [photoTitle, setPhotoTitle] = useState('');
  const [photoCaption, setPhotoCaption] = useState('');
  const [photoCategory, setPhotoCategory] = useState<CatalogCategory>('champions');
  const [photoAthleteId, setPhotoAthleteId] = useState('');
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState('');
  const [photoCompressing, setPhotoCompressing] = useState(false);
  const [submittingPhoto, setSubmittingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [photoSuccess, setPhotoSuccess] = useState('');
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const seenNotifIdsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    setLoading(true);
    seenNotifIdsRef.current = null;

    const unsub = subscribeParentPortal(profile.uid, profile.email, emailVerified, (state) => {
      setChildren(state.children);
      setAttendance(state.attendance);
      setPayments(state.payments);
      setNotifications(state.notifications);
      setSentMessages(state.messages);
      setHolidays(state.holidays || []);
      setSubmittedPhotos(state.catalogPhotos || []);
      setLoading(false);

      setSelectedChildId((prev) => {
        if (prev && state.children.some((c) => c.id === prev)) return prev;
        return state.children[0]?.id || '';
      });

      if (seenNotifIdsRef.current === null) {
        seenNotifIdsRef.current = new Set(state.notifications.map((n) => n.id));
      } else {
        for (const notif of state.notifications) {
          if (!seenNotifIdsRef.current.has(notif.id)) {
            seenNotifIdsRef.current.add(notif.id);
            if (!notif.read) {
              setLiveToast(notif);
              void showLocalPushNotification(notif.title, notif.message, notif.id);
              break;
            }
          }
        }
      }
    });

    return () => {
      unsub();
    };
  }, [profile.uid, profile.email, emailVerified]);

  useEffect(() => {
    let cleanup: (() => void) | null = null;
    void attachForegroundFcmListener((title, body) => {
      void showLocalPushNotification(title, body, `fcm_${Date.now()}`);
    }).then((unsub) => {
      cleanup = unsub;
    });
    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  const activeChild: Athlete | undefined = useMemo(
    () => children.find((c) => c.id === selectedChildId) || children[0],
    [children, selectedChildId]
  );

  useEffect(() => {
    if (activeChild && !photoAthleteId) {
      setPhotoAthleteId(activeChild.id);
    }
  }, [activeChild, photoAthleteId]);

  const handleCopyCode = async (athlete: Athlete) => {
    const code = getAthleteDisplayCode(athlete);
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCodeId(athlete.id);
      setTimeout(() => {
        setCopiedCodeId((prev) => (prev === athlete.id ? null : prev));
      }, 2200);
    } catch {
      // Clipboard fallback not needed
    }
  };

  const handleMarkRead = async (notificationId?: string) => {
    if (!notificationId) {
      await markAllNotificationsRead(notifications);
    } else {
      await markNotificationRead(notificationId);
    }
  };

  const handleAddChild = async (e: React.FormEvent) => {
    e.preventDefault();
    setChildFormError('');
    setSubmittingChild(true);
    try {
      const created = await addParentChild(profile, {
        fullName: childName,
        age: Number(childAge),
        discipline: childDiscipline,
        medicalNotes: childNotes,
      });
      setShowAddChild(false);
      setChildName('');
      setChildAge('8');
      setChildNotes('');
      setSelectedChildId(created.id);
    } catch (err) {
      setChildFormError(err instanceof Error ? err.message : 'تعذر إضافة اللاعب');
    } finally {
      setSubmittingChild(false);
    }
  };

  const openMessageCoachModal = () => {
    setMsgError('');
    setMsgSuccess('');
    setMsgAthleteId(activeChild?.id || children[0]?.id || '');
    setShowMessageCoach(true);
  };

  const handleSendMessageToCoach = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsgError('');
    setMsgSuccess('');
    setSendingMsg(true);
    try {
      const targetAth = children.find((c) => c.id === msgAthleteId) || null;
      await parentSendMessage(profile, {
        athlete: targetAth,
        subject: msgSubject,
        message: msgBody,
      });
      setMsgSubject('');
      setMsgBody('');
      setShowMessageCoach(false);
      setMsgSuccess('تم إرسال رسالتك إلى كابتن باهر مراد بنجاح وسيرد عليك فور مراجعتها.');
      setTimeout(() => setMsgSuccess(''), 6000);
    } catch (err) {
      setMsgError(err instanceof Error ? err.message : 'تعذر إرسال الرسالة');
    } finally {
      setSendingMsg(false);
    }
  };

  const handlePickPhotoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError('');
    setPhotoSuccess('');
    setPhotoCompressing(true);
    try {
      const { dataUrl } = await compressImageFileToDataUrl(file);
      setPhotoPreviewUrl(dataUrl);
      if (!photoTitle.trim() && activeChild) {
        setPhotoTitle(`مشاركة ${activeChild.fullName}`);
      }
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'تعذر تجهيز الصورة');
      setPhotoPreviewUrl('');
    } finally {
      setPhotoCompressing(false);
    }
  };

  const handleSubmitCatalogPhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhotoError('');
    setPhotoSuccess('');
    if (!photoPreviewUrl) {
      setPhotoError('يرجى اختيار صورة من هاتفك أو الكاميرا أولاً');
      return;
    }
    setSubmittingPhoto(true);
    try {
      const targetAth = children.find((c) => c.id === photoAthleteId) || activeChild || null;
      await parentSubmitCatalogPhoto(profile, {
        title: photoTitle,
        caption: photoCaption,
        category: photoCategory,
        imageUrl: photoPreviewUrl,
        athlete: targetAth,
      });
      setPhotoTitle('');
      setPhotoCaption('');
      setPhotoPreviewUrl('');
      if (photoInputRef.current) {
        photoInputRef.current.value = '';
      }
      setPhotoSuccess(
        'تم إرسال الصورة إلى كابتن باهر مراد بنجاح، وستُضاف إلى الكتالوج الرسمي فور موافقته عليها.'
      );
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'تعذر إرسال الصورة');
    } finally {
      setSubmittingPhoto(false);
    }
  };

  const handleDeletePendingPhoto = async (photoId: string) => {
    setDeletingPhotoId(photoId);
    setPhotoError('');
    try {
      await deleteCatalogPhoto(photoId);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'تعذر حذف الصورة');
    } finally {
      setDeletingPhotoId(null);
    }
  };

  // All-time attendance for the active child
  const childAllAttendance = useMemo(() => {
    if (!activeChild) return [];
    return attendance.filter((r) => r.athleteId === activeChild.id);
  }, [attendance, activeChild]);

  // Selected month attendance for the active child
  const childMonthAttendance = useMemo(
    () => childAllAttendance.filter((r) => r.month === selectedMonth),
    [childAllAttendance, selectedMonth]
  );

  const childStats = useMemo(() => {
    const allTimeTrainingDays = childAllAttendance.filter(
      (r) => r.status === 'present' || r.status === 'checked_out'
    ).length;
    const monthPresent = childMonthAttendance.filter(
      (r) => r.status === 'present' || r.status === 'checked_out'
    ).length;
    const monthAbsent = childMonthAttendance.filter((r) => r.status === 'absent').length;
    const monthTotal = monthPresent + monthAbsent;
    const rate = monthTotal > 0 ? Math.round((monthPresent / monthTotal) * 100) : 0;

    const latestPresent = childAllAttendance.find(
      (r) => r.status === 'present' || r.status === 'checked_out'
    );
    const latestNoteRec = childAllAttendance.find((r) => Boolean(r.coachNote?.trim()));

    return {
      allTimeTrainingDays,
      monthPresent,
      monthAbsent,
      monthTotal,
      rate,
      latestPresent: latestPresent || null,
      latestCoachNote: latestNoteRec?.coachNote || '',
      latestCoachNoteDate: latestNoteRec?.date || '',
    };
  }, [childAllAttendance, childMonthAttendance]);

  const childMonthPaid = useMemo(() => {
    if (!activeChild) return { paid: 0, isPaid: false };
    const monthPays = payments.filter(
      (p) => p.athleteId === activeChild.id && p.month === selectedMonth
    );
    const paid = monthPays.reduce((s, p) => s + p.amount, 0);
    return { paid, isPaid: paid >= activeChild.monthlyFee };
  }, [payments, activeChild, selectedMonth]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const todayHoliday = useMemo(
    () => holidays.find((h) => h.date === today) || null,
    [holidays, today]
  );
  const isTrainingToday = useMemo(() => isTrainingDayDate(today), [today]);
  const todayArabicName = useMemo(() => getArabicWeekdayName(today), [today]);
  const nextTraining = useMemo(
    () => getNextTrainingSessionInfo(today, holidays),
    [today, holidays]
  );

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white border border-zinc-200 rounded-xl p-8 text-center text-sm text-zinc-500">
          جاري تحميل بوابة ولي الأمر...
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {liveToast && (
        <div className="bg-[#111315] text-white border border-[#D4A843]/50 rounded-xl p-4 flex items-start justify-between gap-4 shadow-lg">
          <div className="flex items-start gap-3">
            <BellRing className="w-5 h-5 text-[#D4A843] mt-0.5 shrink-0" />
            <div>
              <div className="text-sm font-bold text-[#D4A843]">{liveToast.title}</div>
              <p className="text-sm text-zinc-200 mt-0.5">{liveToast.message}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setLiveToast(null)}
            className="p-1 text-zinc-400 hover:text-white"
            aria-label="إغلاق التنبيه"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Simplified Parent Header */}
      <div className="bg-white/95 border border-zinc-200 rounded-xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-medium text-zinc-500 flex flex-wrap items-center gap-2">
            <span className="font-semibold text-[#B91C1C]">بوابة ولي الأمر</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono" dir="ltr">
              {profile.phone}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-zinc-500" dir="ltr">
              {formatParentIdentifier(profile.email)}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#111315] mt-1">
            مرحباً، {profile.fullName}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <PushNotificationButton profile={profile} />
          <PWAInstallButton />
          <a
            href="https://wa.me/201080486524"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#15803D] hover:bg-[#166534] rounded-lg transition-colors whitespace-nowrap"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>واتساب 01080486524</span>
          </a>
          <button
            type="button"
            onClick={openMessageCoachModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#B91C1C] hover:bg-[#991B1B] rounded-lg transition-colors whitespace-nowrap"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>رسالة للكابتن</span>
          </button>
          <button
            type="button"
            onClick={() => setShowAddChild(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#111315] hover:bg-zinc-800 rounded-lg transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5 text-[#D4A843]" />
            <span>إضافة لاعب</span>
          </button>
        </div>
      </div>

      {msgSuccess && (
        <div className="px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm font-medium rounded-lg flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{msgSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setMsgSuccess('')}
            className="text-emerald-700 hover:text-emerald-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Today Training / Holiday Notice */}
      {todayHoliday ? (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <CalendarOff className="w-5 h-5 text-[#B91C1C] mt-0.5 shrink-0" />
            <div>
              <div className="text-sm font-bold text-[#111315]">
                إجازة رسمية اليوم ({todayArabicName} · {formatArabicDate(today)}) — لا يوجد تمرين
              </div>
              <p className="text-xs text-zinc-700 mt-0.5">
                {todayHoliday.reason
                  ? `سبب الإجازة: ${todayHoliday.reason}`
                  : 'تم تعليق تمرين اليوم بناءً على إعلان كابتن باهر مراد.'}
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold text-[#B91C1C] whitespace-nowrap">
            التمرين القادم: {nextTraining.weekdayName} ({nextTraining.arabicDate})
          </span>
        </div>
      ) : isTrainingToday ? (
        <div className="bg-[#111315] text-white border border-[#D4A843]/40 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-[#D4A843] mt-0.5 shrink-0" />
            <div>
              <div className="text-sm font-bold text-[#D4A843]">
                تذكير بموعد التمرين: يوجد تمرين اليوم ({todayArabicName}) الساعة 5:00 مساءً
              </div>
              <p className="text-xs text-zinc-300 mt-0.5">
                كيك بوكسينج · كونغ فو · MMA — أكاديمية البوب، ميت غمر.
              </p>
            </div>
          </div>
          <span className="text-xs font-mono text-zinc-300 tabular-nums whitespace-nowrap">
            {formatArabicDate(today)} · 5:00 م
          </span>
        </div>
      ) : (
        <div className="bg-white/95 border border-zinc-200 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-600">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#A17415] shrink-0" />
            <span>
              اليوم ({todayArabicName}) راحة · موعد التمرين القادم:{' '}
              <strong className="text-[#111315]">
                {nextTraining.weekdayName} ({nextTraining.arabicDate}) الساعة 5:00 مساءً
              </strong>
            </span>
          </div>
          <span className="font-mono text-zinc-500">{formatArabicDate(today)}</span>
        </div>
      )}

      {/* Athlete Switcher Cards (Clear Code + Age + Total Training Days) */}
      {children.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {children.map((child) => {
            const isSelected = activeChild?.id === child.id;
            const code = getAthleteDisplayCode(child);
            const totalDays = attendance.filter(
              (r) =>
                r.athleteId === child.id &&
                (r.status === 'present' || r.status === 'checked_out')
            ).length;
            const todayAtt = attendance.find(
              (r) => r.athleteId === child.id && r.date === today
            );

            return (
              <button
                key={child.id}
                type="button"
                onClick={() => setSelectedChildId(child.id)}
                className={`text-right p-4 rounded-xl border transition-colors ${
                  isSelected
                    ? 'bg-[#111315] text-white border-[#D4A843]'
                    : 'bg-white text-[#111315] border-zinc-200 hover:border-zinc-400'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-base font-extrabold">{child.fullName}</div>
                    <div
                      className={`text-xs mt-1 flex flex-wrap items-center gap-1.5 ${
                        isSelected ? 'text-zinc-300' : 'text-zinc-600'
                      }`}
                    >
                      <span>{child.discipline}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-semibold tabular-nums">السن: {child.age} سنة</span>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-1 text-[11px] font-mono font-bold rounded border shrink-0 ${
                      isSelected
                        ? 'bg-zinc-900 text-[#D4A843] border-[#D4A843]/50'
                        : 'bg-[#F8F8F6] text-[#111315] border-zinc-300'
                    }`}
                    dir="ltr"
                  >
                    {code}
                  </span>
                </div>

                <div
                  className={`mt-3 pt-2.5 border-t text-xs flex items-center justify-between gap-2 ${
                    isSelected ? 'border-zinc-800 text-zinc-300' : 'border-zinc-100 text-zinc-600'
                  }`}
                >
                  <span className="tabular-nums">
                    إجمالي التمارين:{' '}
                    <strong className={isSelected ? 'text-[#D4A843]' : 'text-[#111315]'}>
                      {totalDays} يوم
                    </strong>
                  </span>
                  <span
                    className={`font-semibold ${
                      todayAtt?.status === 'present'
                        ? isSelected
                          ? 'text-[#D4A843]'
                          : 'text-emerald-700'
                        : todayAtt?.status === 'checked_out'
                          ? isSelected
                            ? 'text-emerald-400'
                            : 'text-emerald-700'
                          : todayAtt?.status === 'absent'
                            ? 'text-red-500'
                            : ''
                    }`}
                  >
                    {todayAtt?.status === 'present' && 'حاضر الآن'}
                    {todayAtt?.status === 'checked_out' && 'انصرف بأمان'}
                    {todayAtt?.status === 'absent' && 'غائب اليوم'}
                    {!todayAtt && 'بانتظار الحصة'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Simplified 3-Tab Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap items-center gap-1.5 p-1 bg-zinc-200/80 border border-zinc-300 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('profile_training')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'profile_training'
                ? 'bg-[#111315] text-[#D4A843]'
                : 'text-zinc-700 hover:text-[#111315]'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>ملف اللاعب والتمارين</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('notifications_messages')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'notifications_messages'
                ? 'bg-[#111315] text-[#D4A843]'
                : 'text-zinc-700 hover:text-[#111315]'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>الإشعارات والرسائل</span>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-mono bg-[#B91C1C] text-white rounded">
                {unreadCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('catalog_photos')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'catalog_photos'
                ? 'bg-[#111315] text-[#D4A843]'
                : 'text-zinc-700 hover:text-[#111315]'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>إرسال صور للكتالوج</span>
            {submittedPhotos.length > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-mono bg-zinc-700 text-white rounded">
                {submittedPhotos.length}
              </span>
            )}
          </button>
        </div>

        {activeTab === 'profile_training' && (
          <div className="flex items-center gap-2">
            <label htmlFor="parent-month" className="text-xs font-semibold text-zinc-600">
              الشهر:
            </label>
            <input
              id="parent-month"
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-1.5 text-xs font-mono bg-white border border-zinc-300 rounded-lg focus:outline-none focus:border-[#111315]"
            />
          </div>
        )}
      </div>

      {/* TAB 1: DIGITAL ATHLETE PROFILE + TRAINING DAYS + ATTENDANCE & PAYMENTS */}
      {activeTab === 'profile_training' && (
        <div className="space-y-6">
          {activeChild ? (
            <>
              {/* Digital Athlete Card with Athlete Code, Age, Personal Data & Extra Helpful Info */}
              <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
                <div className="bg-[#111315] text-white px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800">
                  <div>
                    <div className="text-[11px] font-semibold text-[#D4A843]">
                      بطاقة اللاعب الرقمية · أكاديمية البوب
                    </div>
                    <h2 className="text-xl font-extrabold text-white mt-0.5">
                      {activeChild.fullName}
                    </h2>
                    <div className="text-xs text-zinc-300 mt-1 flex flex-wrap items-center gap-2">
                      <span>الرياضة: {activeChild.discipline}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">السن: {activeChild.age} سنة</span>
                      <span aria-hidden="true">·</span>
                      <span>{SCHEDULE_MAP[activeChild.discipline] || activeChild.groupSchedule}</span>
                    </div>
                  </div>

                  {/* Copyable Athlete Code Box */}
                  <div className="bg-[#1B1F26] border border-[#D4A843]/50 rounded-xl px-4 py-2.5 flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    <div>
                      <div className="text-[10px] font-semibold text-zinc-400">
                        الرقم الكودي للاعب
                      </div>
                      <div
                        className="text-lg font-mono font-extrabold text-[#D4A843] tracking-wider tabular-nums"
                        dir="ltr"
                      >
                        {getAthleteDisplayCode(activeChild)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyCode(activeChild)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white rounded-lg border border-zinc-700 transition-colors"
                    >
                      {copiedCodeId === activeChild.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>تم النسخ</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-[#D4A843]" />
                          <span>نسخ</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Clear 4 KPI Training Days & Rate Strip */}
                <div className="grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-zinc-200 border-b border-zinc-200">
                  <div className="p-4 sm:p-5 bg-[#FFFDF7]">
                    <div className="text-xs font-semibold text-zinc-600">
                      إجمالي أيام التمرين بالأكاديمية
                    </div>
                    <div className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums text-[#111315] mt-1">
                      {childStats.allTimeTrainingDays}{' '}
                      <span className="text-xs font-sans font-semibold text-zinc-500">يوم</span>
                    </div>
                  </div>

                  <div className="p-4 sm:p-5">
                    <div className="text-xs text-zinc-500">
                      تمارين شهر {formatArabicMonth(selectedMonth)}
                    </div>
                    <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
                      {childStats.monthPresent}
                    </div>
                  </div>

                  <div className="p-4 sm:p-5">
                    <div className="text-xs text-zinc-500">أيام الغياب بالشهر</div>
                    <div className="text-2xl font-bold font-mono tabular-nums text-[#B91C1C] mt-1">
                      {childStats.monthAbsent}
                    </div>
                  </div>

                  <div className="p-4 sm:p-5">
                    <div className="text-xs text-zinc-500">نسبة الالتزام بالشهر</div>
                    <div className="text-2xl font-bold font-mono tabular-nums text-[#111315] mt-1">
                      {childStats.rate}%
                    </div>
                  </div>
                </div>

                {/* Athlete Full Info + Helpful Training Details Grid */}
                <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                  <div className="p-3.5 bg-[#F8F8F6] border border-zinc-200 rounded-lg space-y-1.5">
                    <div className="flex items-center gap-1.5 font-bold text-[#111315]">
                      <UserCheck className="w-4 h-4 text-[#B91C1C]" />
                      <span>بيانات اللاعب وولي الأمر</span>
                    </div>
                    <div className="text-zinc-600">
                      الاسم: <strong className="text-[#111315]">{activeChild.fullName}</strong>
                    </div>
                    <div className="text-zinc-600">
                      السن: <strong className="text-[#111315]">{activeChild.age} سنة</strong> ·
                      الرياضة: <strong className="text-[#111315]">{activeChild.discipline}</strong>
                    </div>
                    <div className="text-zinc-600">
                      ولي الأمر: <strong className="text-[#111315]">{activeChild.parentName}</strong>{' '}
                      (<span className="font-mono" dir="ltr">{activeChild.parentPhone}</span>)
                    </div>
                  </div>

                  <div className="p-3.5 bg-[#F8F8F6] border border-zinc-200 rounded-lg space-y-1.5">
                    <div className="flex items-center gap-1.5 font-bold text-[#111315]">
                      <CalendarCheck className="w-4 h-4 text-[#A17415]" />
                      <span>مواعيد ومقر التدريب القادم</span>
                    </div>
                    <div className="text-zinc-600">
                      الموعد القادم:{' '}
                      <strong className="text-[#111315]">
                        {nextTraining.isToday
                          ? `اليوم ${nextTraining.weekdayName}`
                          : `${nextTraining.weekdayName} (${nextTraining.arabicDate})`}
                      </strong>{' '}
                      · {nextTraining.timeLabel}
                    </div>
                    <div className="text-zinc-600 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                      <span>ميت غمر — محافظة الدقهلية</span>
                    </div>
                    <div className="text-zinc-600">
                      آخر حضور مسجل:{' '}
                      <strong className="text-[#111315]">
                        {childStats.latestPresent
                          ? `${formatArabicDate(childStats.latestPresent.date)} (${formatArabicTime(childStats.latestPresent.checkInTime)})`
                          : 'لم يسجل بعد'}
                      </strong>
                    </div>
                  </div>

                  <div className="p-3.5 bg-[#F8F8F6] border border-zinc-200 rounded-lg space-y-1.5">
                    <div className="flex items-center gap-1.5 font-bold text-[#111315]">
                      <Wallet className="w-4 h-4 text-emerald-700" />
                      <span>الاشتراك والحالة الصحية</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-zinc-600">اشتراك {formatArabicMonth(selectedMonth)}:</span>
                      <span
                        className={`font-bold ${
                          childMonthPaid.isPaid ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        {childMonthPaid.isPaid
                          ? `مسدد (${formatCurrencyEGP(childMonthPaid.paid)})`
                          : `غير مسدد (${formatCurrencyEGP(activeChild.monthlyFee)})`}
                      </span>
                    </div>
                    <div className="text-zinc-600 flex items-start gap-1">
                      <HeartPulse className="w-3.5 h-3.5 text-[#B91C1C] mt-0.5 shrink-0" />
                      <span>
                        الحالة الصحية:{' '}
                        <strong className="text-[#111315]">
                          {activeChild.medicalNotes || 'لا توجد ملاحظات صحية'}
                        </strong>
                      </span>
                    </div>
                    {childStats.latestCoachNote && (
                      <div className="text-zinc-600 flex items-start gap-1">
                        <FileText className="w-3.5 h-3.5 text-[#A17415] mt-0.5 shrink-0" />
                        <span>
                          آخر ملاحظة للكابتن:{' '}
                          <strong className="text-[#111315]">{childStats.latestCoachNote}</strong>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Monthly Attendance Log & Subscription Payments Side-by-Side */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-7 bg-white border border-zinc-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-zinc-500" />
                      <h3 className="text-sm font-bold text-[#111315]">
                        سجل تمارين {formatArabicMonth(selectedMonth)}
                      </h3>
                    </div>
                    <span className="text-xs text-zinc-500 tabular-nums">
                      {childMonthAttendance.length} سجل
                    </span>
                  </div>

                  {childMonthAttendance.length === 0 ? (
                    <div className="p-8 text-center text-sm text-zinc-500">
                      لا توجد سجلات حضور مسجلة لهذا الشهر حتى الآن.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-right text-sm">
                        <thead className="bg-zinc-50 text-xs font-semibold text-zinc-600 border-b border-zinc-200">
                          <tr>
                            <th className="py-3 px-4">التاريخ</th>
                            <th className="py-3 px-4">الحالة</th>
                            <th className="py-3 px-4">الحضور</th>
                            <th className="py-3 px-4">الانصراف</th>
                            <th className="py-3 px-4">ملاحظة المدرب</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200">
                          {childMonthAttendance.map((rec) => (
                            <tr key={rec.id} className="hover:bg-zinc-50/80">
                              <td className="py-3 px-4 font-medium text-[#111315] whitespace-nowrap">
                                {formatArabicDate(rec.date)}
                              </td>
                              <td className="py-3 px-4 whitespace-nowrap">
                                {rec.status === 'present' && (
                                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                                    <UserCheck className="w-3.5 h-3.5" />
                                    <span>حاضر بالتمرين</span>
                                  </span>
                                )}
                                {rec.status === 'checked_out' && (
                                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                                    <LogOut className="w-3.5 h-3.5" />
                                    <span>حضر وانصرف</span>
                                  </span>
                                )}
                                {rec.status === 'absent' && (
                                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#B91C1C]">
                                    <XCircle className="w-3.5 h-3.5" />
                                    <span>غائب</span>
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 font-mono tabular-nums text-xs text-zinc-700 whitespace-nowrap">
                                {formatArabicTime(rec.checkInTime)}
                              </td>
                              <td className="py-3 px-4 font-mono tabular-nums text-xs text-zinc-700 whitespace-nowrap">
                                {formatArabicTime(rec.checkOutTime)}
                              </td>
                              <td className="py-3 px-4 text-xs text-zinc-600">
                                {rec.coachNote || '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="lg:col-span-5 bg-white border border-zinc-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-zinc-200 flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-emerald-700" />
                    <h3 className="text-sm font-bold text-[#111315]">سجل مدفوعات الاشتراكات</h3>
                  </div>
                  {payments.filter((p) => p.athleteId === activeChild.id).length === 0 ? (
                    <div className="p-6 text-center text-sm text-zinc-500">
                      لم يتم تسجيل مدفوعات اشتراك لهذا اللاعب بعد.
                    </div>
                  ) : (
                    <div className="divide-y divide-zinc-200 max-h-[360px] overflow-y-auto">
                      {payments
                        .filter((p) => p.athleteId === activeChild.id)
                        .map((pay) => (
                          <div
                            key={pay.id}
                            className="px-5 py-3.5 flex items-center justify-between gap-4 text-sm"
                          >
                            <div>
                              <div className="font-semibold text-[#111315]">
                                اشتراك شهر {formatArabicMonth(pay.month)}
                              </div>
                              <div className="text-xs text-zinc-500 mt-0.5">
                                {pay.method} · {formatArabicDate(pay.paidAt)}
                              </div>
                            </div>
                            <div className="font-mono font-bold tabular-nums text-emerald-700">
                              {formatCurrencyEGP(pay.amount)}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white border border-zinc-200 rounded-xl p-8 text-center space-y-3">
              <div className="text-base font-bold text-[#111315]">لا يوجد أبناء مسجلون بعد</div>
              <p className="text-sm text-zinc-600">
                أضف بيانات ابنك للحصول على الرقم الكودي ومتابعة أيام تمارينه وإشعارات الأكاديمية.
              </p>
              <button
                type="button"
                onClick={() => setShowAddChild(true)}
                className="px-5 py-2.5 bg-[#B91C1C] text-white text-sm font-semibold rounded-lg"
              >
                إضافة لاعب جديد
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: NOTIFICATIONS & MESSAGES TO COACH */}
      {activeTab === 'notifications_messages' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-6 bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#B91C1C]" />
                <h2 className="text-sm font-bold text-[#111315]">
                  إشعارات الأكاديمية والحضور ({notifications.length})
                </h2>
              </div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => handleMarkRead()}
                  className="text-xs font-semibold text-[#B91C1C] hover:text-[#991B1B] whitespace-nowrap"
                >
                  تحديد الكل كمقروء ({unreadCount})
                </button>
              )}
            </div>

            {notifications.length === 0 ? (
              <div className="p-8 text-center text-sm text-zinc-500">
                ستظهر هنا جميع الإشعارات المرسلة من كابتن باهر مراد فور تسجيل حضور أو انصراف أبنائك.
              </div>
            ) : (
              <div className="divide-y divide-zinc-200 max-h-[500px] overflow-y-auto">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => !notif.read && handleMarkRead(notif.id)}
                    className={`p-4 transition-colors cursor-pointer ${
                      notif.read ? 'bg-white hover:bg-zinc-50' : 'bg-[#FFFDF5] hover:bg-amber-50/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-xs font-bold text-[#111315]">
                        {notif.title}
                        {!notif.read && (
                          <span className="mr-2 text-[#B91C1C] font-semibold">· جديد</span>
                        )}
                      </div>
                      <span className="text-[11px] font-mono tabular-nums text-zinc-500 whitespace-nowrap">
                        {formatArabicTime(notif.createdAtIso || null)}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-700 mt-1.5 leading-relaxed">{notif.message}</p>
                    <div className="text-[11px] text-zinc-400 mt-1.5">
                      {notif.athleteName} · {formatArabicDate(notif.createdAtIso || today)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-6 bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#A17415]" />
                <h2 className="text-sm font-bold text-[#111315]">
                  رسائلي لكابتن باهر مراد ({sentMessages.length})
                </h2>
              </div>
              <button
                type="button"
                onClick={openMessageCoachModal}
                className="text-xs font-semibold text-[#B91C1C] hover:text-[#991B1B] whitespace-nowrap"
              >
                + رسالة جديدة
              </button>
            </div>

            {sentMessages.length === 0 ? (
              <div className="p-6 text-center space-y-3">
                <p className="text-xs text-zinc-500 leading-relaxed">
                  هل لديك استفسار عن المواعيد أو اعتذار عن حصة أو ملاحظة للكابتن؟ أرسل رسالتك مباشرة من هنا.
                </p>
                <button
                  type="button"
                  onClick={openMessageCoachModal}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#111315] hover:bg-zinc-800 text-[#D4A843] rounded-lg transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>إرسال رسالة للكابتن</span>
                </button>
              </div>
            ) : (
              <div className="divide-y divide-zinc-200 max-h-[500px] overflow-y-auto">
                {sentMessages.map((msg) => (
                  <div key={msg.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-xs font-bold text-[#111315]">{msg.subject}</div>
                      <span
                        className={`text-[11px] font-semibold whitespace-nowrap ${
                          msg.coachReply
                            ? 'text-emerald-700'
                            : msg.readByCoach
                              ? 'text-amber-700'
                              : 'text-zinc-500'
                        }`}
                      >
                        {msg.coachReply
                          ? 'تم الرد'
                          : msg.readByCoach
                            ? 'تمت القراءة'
                            : 'قيد المراجعة'}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-700 leading-relaxed">{msg.message}</p>
                    <div className="text-[11px] text-zinc-400">
                      {msg.athleteName} · {formatArabicDate(msg.createdAtIso || today)} ·{' '}
                      {formatArabicTime(msg.createdAtIso || null)}
                    </div>
                    {msg.coachReply && (
                      <div className="mt-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg space-y-1">
                        <div className="text-[11px] font-bold text-emerald-900">
                          رد كابتن باهر مراد:
                        </div>
                        <p className="text-xs text-emerald-950 leading-relaxed">
                          {msg.coachReply}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: PARENT PHOTO SUBMISSIONS FOR ACADEMY CATALOG */}
      {activeTab === 'catalog_photos' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Upload Photo Form */}
          <div className="lg:col-span-5 bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 bg-[#111315] text-white border-b border-zinc-800 flex items-center gap-2">
              <ImagePlus className="w-5 h-5 text-[#D4A843]" />
              <div>
                <h2 className="text-sm font-bold">إرسال صورة لكتالوج الأكاديمية</h2>
                <p className="text-[11px] text-zinc-400">
                  تظهر في الكتالوج الرسمي بعد موافقة كابتن باهر مراد
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmitCatalogPhoto} className="p-5 space-y-4">
              {photoError && (
                <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-800 rounded-lg">
                  {photoError}
                </div>
              )}
              {photoSuccess && (
                <div className="p-3 text-xs bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg">
                  {photoSuccess}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  اختر الصورة من هاتفك *
                </label>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePickPhotoFile}
                  className="block w-full text-xs text-zinc-700 file:ml-3 file:py-2 file:px-3.5 file:rounded-lg file:border file:border-zinc-300 file:text-xs file:font-bold file:bg-[#F8F8F6] file:text-[#111315] hover:file:bg-zinc-200 cursor-pointer"
                />
                {photoCompressing && (
                  <div className="text-[11px] text-[#A17415] mt-1.5">
                    جاري تجهيز وضغط الصورة بجودة مناسبة...
                  </div>
                )}
                {photoPreviewUrl && (
                  <div className="mt-3 relative rounded-lg overflow-hidden border border-zinc-200 bg-zinc-900 aspect-[16/10]">
                    <img
                      src={photoPreviewUrl}
                      alt="معاينة الصورة"
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}
              </div>

              {children.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                    اللاعب الظاهر في الصورة
                  </label>
                  <select
                    value={photoAthleteId}
                    onChange={(e) => setPhotoAthleteId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-lg bg-white"
                  >
                    <option value="">صورة عامة للأكاديمية</option>
                    {children.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName} ({getAthleteDisplayCode(c)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                    عنوان الصورة *
                  </label>
                  <input
                    type="text"
                    required
                    value={photoTitle}
                    onChange={(e) => setPhotoTitle(e.target.value)}
                    placeholder="مثال: ميدالية بطولة الناشئين"
                    className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-lg focus:outline-none focus:border-[#111315]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                    التصنيف في الكتالوج
                  </label>
                  <select
                    value={photoCategory}
                    onChange={(e) => setPhotoCategory(e.target.value as CatalogCategory)}
                    className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-lg bg-white"
                  >
                    {PHOTO_CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  تعليق أو وصف قصير (اختياري)
                </label>
                <input
                  type="text"
                  value={photoCaption}
                  onChange={(e) => setPhotoCaption(e.target.value)}
                  placeholder="مثال: أثناء التمرين الجماعي يوم الجمعة"
                  className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-lg focus:outline-none focus:border-[#111315]"
                />
              </div>

              <button
                type="submit"
                disabled={submittingPhoto || photoCompressing || !photoPreviewUrl}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-[#B91C1C] hover:bg-[#991B1B] text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>
                  {submittingPhoto ? 'جاري الإرسال للموافقة...' : 'إرسال الصورة لموافقة الكابتن'}
                </span>
              </button>
            </form>
          </div>

          {/* Submitted Photos Status List */}
          <div className="lg:col-span-7 bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-[#B91C1C]" />
                <h2 className="text-sm font-bold text-[#111315]">
                  الصور التي أرسلتها للكتالوج ({submittedPhotos.length})
                </h2>
              </div>
              <span className="text-[11px] text-zinc-500">تحديث فوري عند موافقة الكابتن</span>
            </div>

            {submittedPhotos.length === 0 ? (
              <div className="p-8 text-center text-sm text-zinc-500">
                لم ترسل أي صور للكتالوج بعد. اختر صورة من نموذج الإرسال لإضافتها بعد موافقة الكابتن.
              </div>
            ) : (
              <div className="divide-y divide-zinc-200">
                {submittedPhotos.map((item) => {
                  const statusInfo =
                    item.status === 'approved'
                      ? {
                          label: 'تمت الموافقة ونُشرت بالكتالوج',
                          cls: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                        }
                      : item.status === 'rejected'
                        ? {
                            label: 'لم يتم نشرها',
                            cls: 'bg-red-50 text-red-800 border-red-200',
                          }
                        : {
                            label: 'بانتظار موافقة الكابتن',
                            cls: 'bg-amber-50 text-amber-900 border-amber-200',
                          };

                  return (
                    <div key={item.id} className="p-4 flex flex-col sm:flex-row gap-4 items-start">
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="w-full sm:w-28 h-24 object-cover rounded-lg border border-zinc-200 shrink-0 bg-zinc-900"
                      />
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sm font-bold text-[#111315]">{item.title}</div>
                          <span
                            className={`px-2 py-0.5 text-[11px] font-bold border rounded ${statusInfo.cls}`}
                          >
                            {statusInfo.label}
                          </span>
                        </div>
                        {item.caption && (
                          <p className="text-xs text-zinc-600 leading-relaxed">{item.caption}</p>
                        )}
                        <div className="text-[11px] text-zinc-500 flex flex-wrap items-center gap-2">
                          {item.athleteName && <span>اللاعب: {item.athleteName}</span>}
                          {item.createdAtIso && (
                            <>
                              {item.athleteName && <span aria-hidden="true">·</span>}
                              <span>{formatArabicDate(item.createdAtIso)}</span>
                            </>
                          )}
                        </div>
                        {item.coachNote && (
                          <div className="text-xs bg-zinc-50 border border-zinc-200 rounded px-2.5 py-1.5 text-zinc-700">
                            ملاحظة الكابتن: {item.coachNote}
                          </div>
                        )}
                        {item.status === 'pending' && (
                          <div className="pt-1">
                            <button
                              type="button"
                              disabled={deletingPhotoId === item.id}
                              onClick={() => handleDeletePendingPhoto(item.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-[#B91C1C] border border-red-200 hover:bg-red-50 rounded-md disabled:opacity-50"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>
                                {deletingPhotoId === item.id ? 'جاري السحب...' : 'سحب الصورة'}
                              </span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Add Child */}
      {showAddChild && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-white border border-zinc-200 rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-[#111315] text-white">
              <h3 className="text-base font-bold">إضافة ابن / لاعب جديد</h3>
              <button
                type="button"
                onClick={() => setShowAddChild(false)}
                className="p-1 text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddChild} className="p-6 space-y-4">
              {childFormError && (
                <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-800 rounded-lg">
                  {childFormError}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  اسم اللاعب *
                </label>
                <input
                  type="text"
                  required
                  value={childName}
                  onChange={(e) => setChildName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-zinc-300 rounded-lg focus:outline-none focus:border-[#111315]"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                    العمر *
                  </label>
                  <input
                    type="number"
                    min={4}
                    max={35}
                    required
                    value={childAge}
                    onChange={(e) => setChildAge(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm font-mono border border-zinc-300 rounded-lg focus:outline-none focus:border-[#111315]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                    التدريب (250 ج.م / شهر)
                  </label>
                  <select
                    value={childDiscipline}
                    onChange={(e) => setChildDiscipline(e.target.value as Discipline)}
                    className="w-full px-3.5 py-2.5 text-sm border border-zinc-300 rounded-lg focus:outline-none focus:border-[#111315]"
                  >
                    {DISCIPLINES.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  ملاحظات صحية (اختياري)
                </label>
                <input
                  type="text"
                  value={childNotes}
                  onChange={(e) => setChildNotes(e.target.value)}
                  placeholder="لا توجد ملاحظات"
                  className="w-full px-3.5 py-2.5 text-sm border border-zinc-300 rounded-lg focus:outline-none focus:border-[#111315]"
                />
              </div>
              <button
                type="submit"
                disabled={submittingChild}
                className="w-full py-2.5 px-4 bg-[#B91C1C] hover:bg-[#991B1B] text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {submittingChild ? 'جاري الحفظ...' : 'حفظ بيانات اللاعب'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Message Coach */}
      {showMessageCoach && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-white border border-zinc-200 rounded-xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 bg-[#111315] text-white">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-[#D4A843]" />
                <h3 className="text-base font-bold">إرسال رسالة لكابتن باهر مراد</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowMessageCoach(false)}
                className="p-1 text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSendMessageToCoach} className="p-6 pb-8 space-y-4 overflow-y-auto">
              {msgError && (
                <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-800 rounded-lg">
                  {msgError}
                </div>
              )}

              {children.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                    الرسالة بخصوص
                  </label>
                  <select
                    value={msgAthleteId}
                    onChange={(e) => setMsgAthleteId(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-zinc-300 rounded-lg bg-white"
                  >
                    <option value="">استفسار عام للأكاديمية</option>
                    {children.map((c) => (
                      <option key={c.id} value={c.id}>
                        اللاعب: {c.fullName} ({getAthleteDisplayCode(c)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  اختر موضوعاً سريعاً أو اكتب عنوانك:
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {[
                    'اعتذار عن تمرين اليوم',
                    'استفسار عن المواعيد',
                    'ملاحظة صحية',
                    'بخصوص الاشتراك',
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setMsgSubject(preset)}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-md border transition-colors ${
                        msgSubject === preset
                          ? 'bg-[#111315] text-[#D4A843] border-[#111315]'
                          : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:border-zinc-400'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  required
                  value={msgSubject}
                  onChange={(e) => setMsgSubject(e.target.value)}
                  placeholder="عنوان الرسالة *"
                  className="w-full px-3.5 py-2.5 text-sm border border-zinc-300 rounded-lg focus:outline-none focus:border-[#111315]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  نص الرسالة للكابتن *
                </label>
                <textarea
                  rows={4}
                  required
                  value={msgBody}
                  onChange={(e) => setMsgBody(e.target.value)}
                  placeholder="اكتب رسالتك أو استفسارك هنا..."
                  className="w-full px-3.5 py-2.5 text-sm border border-zinc-300 rounded-lg focus:outline-none focus:border-[#111315]"
                />
              </div>

              <button
                type="submit"
                disabled={sendingMsg}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[#B91C1C] hover:bg-[#991B1B] text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
              >
                <Send className="w-4 h-4" />
                <span>{sendingMsg ? 'جاري الإرسال...' : 'إرسال الرسالة الآن'}</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
