import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BellRing,
  Calendar,
  CalendarOff,
  Camera,
  Check,
  CheckCircle2,
  ClipboardList,
  Copy,
  Download,
  ExternalLink,
  ImagePlus,
  KeyRound,
  LogOut,
  Mail,
  Megaphone,
  MessageCircle,
  MessageSquare,
  Phone,
  Plus,
  Search,
  Send,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  fetchScheduleStatus,
  showLocalPushNotification,
  syncCoachScheduleAndSubscriptions,
  triggerTrainingReminderNow,
  type ServerScheduleStatus,
} from '../lib/fcm';
import {
  PARENT_SYNTHETIC_DOMAIN,
  buildMonthlyReport,
  coachAddAthlete,
  coachApproveRegistrationRequest,
  coachBroadcastNotification,
  coachBulkAttendance,
  coachCancelHoliday,
  coachCreateParentAccount,
  coachDeclareHoliday,
  coachDeleteAthlete,
  coachDeleteParentMessage,
  coachDeleteRegistrationRequest,
  coachMarkParentMessageRead,
  coachPublishCatalogPhoto,
  coachRecordAttendance,
  coachRecordPayment,
  coachReplyParentMessage,
  coachReviewCatalogPhoto,
  coachSendNotification,
  coachUpdateAthlete,
  coachUpdateRegistrationRequest,
  convertArabicDigits,
  deleteCatalogPhoto,
  formatParentIdentifier,
  subscribeCoachPortal,
  type CoachCreateParentAccountResult,
} from '../lib/firestoreApi';
import {
  DEFAULT_MONTHLY_FEE,
  DISCIPLINES,
  PAYMENT_METHODS,
  formatArabicDate,
  formatArabicMonth,
  formatArabicTime,
  formatCurrencyEGP,
  getArabicWeekdayName,
  getAthleteDisplayCode,
  getCurrentMonthString,
  getTodayDateString,
  isTrainingDayDate,
} from '../lib/format';
import { compressImageFileToDataUrl } from '../lib/imageCompression';
import type {
  AcademyHoliday,
  Athlete,
  AttendanceRecord,
  CatalogCategory,
  CatalogPhotoItem,
  CatalogPhotoStatus,
  Discipline,
  ParentMessage,
  PaymentMethod,
  PaymentRecord,
  PushSubscriptionDoc,
  RegistrationRequest,
  RegistrationRequestStatus,
  UserProfile,
} from '../types';
import { PWAInstallButton } from './PWAInstallButton';
import { PushNotificationButton } from './PushNotificationButton';

type CoachTab =
  | 'attendance'
  | 'athletes'
  | 'payments'
  | 'monthly_report'
  | 'parents'
  | 'parent_messages'
  | 'requests'
  | 'catalog';
type ReportFilter = 'all' | 'regular' | 'high_absence' | 'unpaid';
type MessageFilter = 'all' | 'unread' | 'replied';
type RequestFilter = 'all' | RegistrationRequestStatus;
type CatalogFilter = 'all' | CatalogPhotoStatus;

const COACH_PHOTO_CATEGORIES: Array<{ value: CatalogCategory; label: string }> = [
  { value: 'champions', label: 'أبطال وإنجازات' },
  { value: 'training', label: 'التدريبات واللياقة' },
  { value: 'coach', label: 'كابتن باهر مراد' },
  { value: 'identity', label: 'اعتمادات وهوية الأكاديمية' },
];

interface CoachDashboardProps {
  profile: UserProfile;
}

export function CoachDashboard({ profile }: CoachDashboardProps) {
  const [activeTab, setActiveTab] = useState<CoachTab>('attendance');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthString());

  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [parents, setParents] = useState<UserProfile[]>([]);
  const [parentMessages, setParentMessages] = useState<ParentMessage[]>([]);
  const [registrationRequests, setRegistrationRequests] = useState<RegistrationRequest[]>([]);
  const [pushSubscriptions, setPushSubscriptions] = useState<PushSubscriptionDoc[]>([]);
  const [holidays, setHolidays] = useState<AcademyHoliday[]>([]);
  const [catalogPhotos, setCatalogPhotos] = useState<CatalogPhotoItem[]>([]);
  const [serverScheduleStatus, setServerScheduleStatus] = useState<ServerScheduleStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  // Filters & bulk selection
  const [searchQuery, setSearchQuery] = useState('');
  const [disciplineFilter, setDisciplineFilter] = useState<string>('all');
  const [reportFilter, setReportFilter] = useState<ReportFilter>('all');
  const [quickNote, setQuickNote] = useState('');
  const [busyAthleteId, setBusyAthleteId] = useState<string | null>(null);
  const [selectedAthleteIds, setSelectedAthleteIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);

  // Add Athlete Modal
  const [showAddAthlete, setShowAddAthlete] = useState(false);
  const [newAthName, setNewAthName] = useState('');
  const [newAthAge, setNewAthAge] = useState('10');
  const [newAthDisc, setNewAthDisc] = useState<Discipline>('كيك بوكسينج');
  const [newAthFee, setNewAthFee] = useState(String(DEFAULT_MONTHLY_FEE));
  const [newParentName, setNewParentName] = useState('');
  const [newParentPhone, setNewParentPhone] = useState('');
  const [newParentEmail, setNewParentEmail] = useState('');
  const [newAthNotes, setNewAthNotes] = useState('');
  const [savingAthlete, setSavingAthlete] = useState(false);

  // Edit Athlete Modal
  const [editingAthlete, setEditingAthlete] = useState<Athlete | null>(null);
  const [editDisc, setEditDisc] = useState<Discipline>('كيك بوكسينج');
  const [editFee, setEditFee] = useState(String(DEFAULT_MONTHLY_FEE));
  const [editNotes, setEditNotes] = useState('');

  // Record Payment Modal
  const [paymentAthlete, setPaymentAthlete] = useState<Athlete | null>(null);
  const [payAmount, setPayAmount] = useState(String(DEFAULT_MONTHLY_FEE));
  const [payMethod, setPayMethod] = useState<PaymentMethod>('نقدي');
  const [payNotes, setPayNotes] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);
  const [quickPayingId, setQuickPayingId] = useState<string | null>(null);

  // Delete Athlete Modal
  const [deletingAthlete, setDeletingAthlete] = useState<Athlete | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  // Individual Notification Modal
  const [notifyAthlete, setNotifyAthlete] = useState<Athlete | null>(null);
  const [notifyTitle, setNotifyTitle] = useState('رسالة من كابتن باهر مراد');
  const [notifyBody, setNotifyBody] = useState('');
  const [sendingNotif, setSendingNotif] = useState(false);

  // Group Broadcast Notification Modal
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastTarget, setBroadcastTarget] = useState<'all' | Discipline>('all');
  const [broadcastTitle, setBroadcastTitle] = useState('إشعار جماعي من أكاديمية البوب');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  // Create Parent Account Modal (Username + Password)
  const [showCreateParentModal, setShowCreateParentModal] = useState(false);
  const [parentAccountMode, setParentAccountMode] = useState<'existing_athlete' | 'new_athlete'>(
    'existing_athlete'
  );
  const [parentTargetAthleteId, setParentTargetAthleteId] = useState('');
  const [linkSamePhoneAthletes, setLinkSamePhoneAthletes] = useState(true);
  const [acctParentName, setAcctParentName] = useState('');
  const [acctParentPhone, setAcctParentPhone] = useState('');
  const [acctUsername, setAcctUsername] = useState('');
  const [acctPassword, setAcctPassword] = useState('');
  const [acctChildName, setAcctChildName] = useState('');
  const [acctChildAge, setAcctChildAge] = useState('10');
  const [acctDiscipline, setAcctDiscipline] = useState<Discipline>('كيك بوكسينج');
  const [acctFee, setAcctFee] = useState(String(DEFAULT_MONTHLY_FEE));
  const [acctNotes, setAcctNotes] = useState('');
  const [creatingParentAcct, setCreatingParentAcct] = useState(false);
  const [parentAcctError, setParentAcctError] = useState('');
  const [createdParentResult, setCreatedParentResult] = useState<{
    info: CoachCreateParentAccountResult;
    password: string;
  } | null>(null);
  const [copiedCredentials, setCopiedCredentials] = useState(false);

  // Registered Parents & Messages state
  const [parentSearchQuery, setParentSearchQuery] = useState('');
  const [messageFilter, setMessageFilter] = useState<MessageFilter>('all');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyingMsgId, setReplyingMsgId] = useState<string | null>(null);
  const [markingMsgId, setMarkingMsgId] = useState<string | null>(null);
  const [deletingMsgId, setDeletingMsgId] = useState<string | null>(null);

  // Registration Requests state
  const [requestFilter, setRequestFilter] = useState<RequestFilter>('all');
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);
  const [deletingRequestId, setDeletingRequestId] = useState<string | null>(null);
  const [requestNoteDrafts, setRequestNoteDrafts] = useState<Record<string, string>>({});

  // Holiday & Auto Training Reminder state
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [holidayDate, setHolidayDate] = useState<string>(getTodayDateString());
  const [holidayReason, setHolidayReason] = useState('');
  const [savingHoliday, setSavingHoliday] = useState(false);
  const [cancellingHoliday, setCancellingHoliday] = useState(false);
  const [triggeringReminder, setTriggeringReminder] = useState(false);

  // Catalog Photo Manager state
  const [catalogFilter, setCatalogFilter] = useState<CatalogFilter>('all');
  const [coachPhotoTitle, setCoachPhotoTitle] = useState('');
  const [coachPhotoCaption, setCoachPhotoCaption] = useState('');
  const [coachPhotoCategory, setCoachPhotoCategory] = useState<CatalogCategory>('champions');
  const [coachPhotoUploading, setCoachPhotoUploading] = useState(false);
  const [photoNoteDrafts, setPhotoNoteDrafts] = useState<Record<string, string>>({});
  const [busyPhotoId, setBusyPhotoId] = useState<string | null>(null);
  const coachPhotoInputRef = useRef<HTMLInputElement | null>(null);

  const seenMsgIdsRef = useRef<Set<string> | null>(null);
  const seenReqIdsRef = useRef<Set<string> | null>(null);
  const seenPhotoIdsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    setLoading(true);
    seenMsgIdsRef.current = null;
    seenReqIdsRef.current = null;
    seenPhotoIdsRef.current = null;

    const unsub = subscribeCoachPortal((state) => {
      setAthletes(state.athletes);
      setAttendance(state.attendance);
      setPayments(state.payments);
      setParents(state.parents);
      setParentMessages(state.parentMessages);
      setRegistrationRequests(state.registrationRequests);
      setPushSubscriptions(state.pushSubscriptions);
      setHolidays(state.holidays);
      setCatalogPhotos(state.catalogPhotos || []);
      setLoading(false);

      if (seenMsgIdsRef.current === null) {
        seenMsgIdsRef.current = new Set(state.parentMessages.map((m) => m.id));
      } else {
        for (const msg of state.parentMessages) {
          if (!seenMsgIdsRef.current.has(msg.id)) {
            seenMsgIdsRef.current.add(msg.id);
            if (!msg.readByCoach) {
              const notice = `رسالة جديدة من ولي الأمر ${msg.parentName}: ${msg.subject}`;
              setActionMessage(notice);
              void showLocalPushNotification(
                `رسالة جديدة من ${msg.parentName}`,
                `${msg.subject} — ${msg.message.slice(0, 120)}`,
                `coach_msg_${msg.id}`
              );
              break;
            }
          }
        }
      }

      if (seenReqIdsRef.current === null) {
        seenReqIdsRef.current = new Set(state.registrationRequests.map((r) => r.id));
      } else {
        for (const req of state.registrationRequests) {
          if (!seenReqIdsRef.current.has(req.id)) {
            seenReqIdsRef.current.add(req.id);
            if (req.status === 'pending') {
              const notice = `طلب تسجيل جديد: ${req.athleteName} (${req.discipline}) · ولي الأمر: ${req.parentName}`;
              setActionMessage(notice);
              void showLocalPushNotification(
                'طلب تسجيل لاعب جديد في الأكاديمية',
                `${req.athleteName} (${req.age} سنة) · ${req.discipline} · هاتف ${req.parentPhone}`,
                `coach_req_${req.id}`
              );
              break;
            }
          }
        }
      }

      const incomingPhotos = state.catalogPhotos || [];
      if (seenPhotoIdsRef.current === null) {
        seenPhotoIdsRef.current = new Set(incomingPhotos.map((p) => p.id));
      } else {
        for (const ph of incomingPhotos) {
          if (!seenPhotoIdsRef.current.has(ph.id)) {
            seenPhotoIdsRef.current.add(ph.id);
            if (ph.submittedByRole === 'parent' && ph.status === 'pending') {
              const notice = `صورة جديدة للكتالوج من ${ph.submittedByName} بانتظار موافقتك: ${ph.title}`;
              setActionMessage(notice);
              void showLocalPushNotification(
                'صورة جديدة للكتالوج بانتظار الموافقة',
                `${ph.submittedByName}: ${ph.title}`,
                `coach_photo_${ph.id}`
              );
              break;
            }
          }
        }
      }
    });
    return () => {
      unsub();
    };
  }, []);

  useEffect(() => {
    void fetchScheduleStatus().then((status) => {
      if (status) setServerScheduleStatus(status);
    });
  }, []);

  useEffect(() => {
    if (loading) return;
    void syncCoachScheduleAndSubscriptions(holidays, pushSubscriptions).then(() =>
      fetchScheduleStatus().then((status) => {
        if (status) setServerScheduleStatus(status);
      })
    );
  }, [holidays, pushSubscriptions, loading]);

  const dayAttendance = useMemo(
    () => attendance.filter((r) => r.date === selectedDate),
    [attendance, selectedDate]
  );

  const monthPayments = useMemo(
    () => payments.filter((p) => p.month === selectedMonth),
    [payments, selectedMonth]
  );

  const report = useMemo(
    () => buildMonthlyReport(athletes, attendance, payments, selectedMonth),
    [athletes, attendance, payments, selectedMonth]
  );

  const showNotice = (msg: string) => {
    setActionMessage(msg);
    setTimeout(() => {
      setActionMessage((prev) => (prev === msg ? '' : prev));
    }, 5500);
  };

  const handleAttendanceAction = async (
    athlete: Athlete,
    action: 'check_in' | 'check_out' | 'absent'
  ) => {
    setBusyAthleteId(athlete.id);
    setError('');
    try {
      const existingRecord = dayAttendance.find((r) => r.athleteId === athlete.id);
      await coachRecordAttendance({
        athlete,
        existingRecord,
        action,
        date: selectedDate,
        coachNote: quickNote,
        knownSubscriptions: pushSubscriptions,
      });
      const actionLabel =
        action === 'check_in'
          ? `تم تسجيل حضور ${athlete.fullName} وإرسال إشعار لولي الأمر (${athlete.parentName})`
          : action === 'check_out'
            ? `تم تسجيل انصراف ${athlete.fullName} وإرسال إشعار لولي الأمر (${athlete.parentName})`
            : `تم تسجيل غياب ${athlete.fullName} وإرسال تنبيه لولي الأمر`;
      showNotice(actionLabel);
      setQuickNote('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تسجيل الحضور');
    } finally {
      setBusyAthleteId(null);
    }
  };

  const handleBulkAttendance = async (action: 'check_in' | 'check_out') => {
    if (selectedAthleteIds.length === 0) return;
    setBulkBusy(true);
    setError('');
    try {
      const selectedAthletes = athletes.filter((a) => selectedAthleteIds.includes(a.id));
      const count = await coachBulkAttendance({
        athletes: selectedAthletes,
        dayAttendance,
        action,
        date: selectedDate,
        coachNote: quickNote,
        knownSubscriptions: pushSubscriptions,
      });
      setSelectedAthleteIds([]);
      setQuickNote('');
      showNotice(
        action === 'check_in'
          ? `تم تسجيل حضور ${count} لاعب وإرسال إشعارات فورية لأولياء أمورهم`
          : `تم تسجيل انصراف ${count} لاعب وإرسال إشعارات فورية لأولياء أمورهم`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تنفيذ الإشعار الجماعي');
    } finally {
      setBulkBusy(false);
    }
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingBroadcast(true);
    setError('');
    try {
      const sentCount = await coachBroadcastNotification({
        athletes,
        targetDiscipline: broadcastTarget,
        title: broadcastTitle,
        message: broadcastMessage,
        knownSubscriptions: pushSubscriptions,
      });
      setShowBroadcastModal(false);
      setBroadcastMessage('');
      showNotice(
        sentCount > 0
          ? `تم إرسال الإشعار الجماعي بنجاح إلى ${sentCount} ولي أمر`
          : 'لا يوجد أولياء أمور مسجلون في الفئة المختارة حالياً'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إرسال الإشعار الجماعي');
    } finally {
      setSendingBroadcast(false);
    }
  };

  const handleAddAthlete = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAthlete(true);
    setError('');
    try {
      await coachAddAthlete({
        fullName: newAthName,
        age: Number(newAthAge),
        discipline: newAthDisc,
        monthlyFee: Number(newAthFee),
        parentName: newParentName,
        parentPhone: newParentPhone,
        parentEmail: newParentEmail,
        medicalNotes: newAthNotes,
      });
      setShowAddAthlete(false);
      setNewAthName('');
      setNewParentName('');
      setNewParentPhone('');
      setNewParentEmail('');
      setNewAthNotes('');
      showNotice('تم إضافة اللاعب بنجاح');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إضافة اللاعب');
    } finally {
      setSavingAthlete(false);
    }
  };

  const handleSaveEditAthlete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAthlete) return;
    setSavingAthlete(true);
    try {
      await coachUpdateAthlete(editingAthlete.id, {
        discipline: editDisc,
        monthlyFee: Number(editFee),
        medicalNotes: editNotes,
      });
      const editedName = editingAthlete.fullName;
      setEditingAthlete(null);
      showNotice(`تم تحديث بيانات اللاعب ${editedName}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحديث البيانات');
    } finally {
      setSavingAthlete(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentAthlete) return;
    setSavingPayment(true);
    try {
      await coachRecordPayment({
        athlete: paymentAthlete,
        month: selectedMonth,
        amount: Number(payAmount),
        method: payMethod,
        notes: payNotes,
        knownSubscriptions: pushSubscriptions,
      });
      const athName = paymentAthlete.fullName;
      setPaymentAthlete(null);
      setPayNotes('');
      showNotice(`تم تسجيل سداد اشتراك ${athName} وإرسال تأكيد لولي الأمر`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تسجيل الدفع');
    } finally {
      setSavingPayment(false);
    }
  };

  const paidAthleteIds = useMemo(() => {
    const set = new Set<string>();
    for (const s of report.summaries) {
      if (s.isPaid) set.add(s.athleteId);
    }
    return set;
  }, [report.summaries]);

  const handleQuickMarkPaid = async (ath: Athlete) => {
    setQuickPayingId(ath.id);
    setError('');
    try {
      await coachRecordPayment({
        athlete: ath,
        month: selectedMonth,
        amount: ath.monthlyFee || DEFAULT_MONTHLY_FEE,
        method: 'نقدي',
        notes: `تم السداد السريع لاشتراك شهر ${selectedMonth}`,
        knownSubscriptions: pushSubscriptions,
      });
      showNotice(`تم تسجيل سداد اشتراك ${ath.fullName} وإرسال إشعار تأكيد لولي الأمر`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تسجيل السداد');
    } finally {
      setQuickPayingId(null);
    }
  };

  const handleConfirmDeleteAthlete = async () => {
    if (!deletingAthlete) return;
    setDeletingBusy(true);
    setError('');
    try {
      const targetId = deletingAthlete.id;
      const targetName = deletingAthlete.fullName;
      await coachDeleteAthlete(targetId);
      setSelectedAthleteIds((prev) => prev.filter((id) => id !== targetId));
      setDeletingAthlete(null);
      showNotice(`تم حذف اللاعب ${targetName} وكافة سجلاته من الموقع بنجاح`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حذف اللاعب');
    } finally {
      setDeletingBusy(false);
    }
  };

  const handleSendCustomNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifyAthlete) return;
    setSendingNotif(true);
    try {
      await coachSendNotification({
        athlete: notifyAthlete,
        title: notifyTitle,
        message: notifyBody,
        knownSubscriptions: pushSubscriptions,
      });
      const name = notifyAthlete.fullName;
      setNotifyAthlete(null);
      setNotifyBody('');
      showNotice(`تم إرسال إشعار خاص إلى ولي أمر ${name}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إرسال الإشعار');
    } finally {
      setSendingNotif(false);
    }
  };

  const openHolidayModal = (dateToSet?: string) => {
    setHolidayDate(dateToSet || selectedDate || getTodayDateString());
    setHolidayReason('');
    setShowHolidayModal(true);
  };

  const handleConfirmDeclareHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingHoliday(true);
    setError('');
    try {
      const { notifiedParents } = await coachDeclareHoliday({
        date: holidayDate,
        reason: holidayReason,
        athletes,
        knownSubscriptions: pushSubscriptions,
      });
      setShowHolidayModal(false);
      setHolidayReason('');
      showNotice(
        `تم إعلان يوم ${getArabicWeekdayName(holidayDate)} (${holidayDate}) إجازة وإبلاغ ${notifiedParents} ولي أمر وإيقاف التذكير التلقائي لهذا اليوم.`
      );
      void fetchScheduleStatus().then((s) => s && setServerScheduleStatus(s));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إعلان الإجازة');
    } finally {
      setSavingHoliday(false);
    }
  };

  const handleCancelHoliday = async (dateStr: string) => {
    setCancellingHoliday(true);
    setError('');
    try {
      await coachCancelHoliday({
        date: dateStr,
        athletes,
        notifyParents: true,
        knownSubscriptions: pushSubscriptions,
      });
      showNotice(
        `تم إلغاء إجازة يوم ${getArabicWeekdayName(dateStr)} (${dateStr}) وإرسال إشعار باستئناف التمرين لأولياء الأمور.`
      );
      void fetchScheduleStatus().then((s) => s && setServerScheduleStatus(s));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إلغاء الإجازة');
    } finally {
      setCancellingHoliday(false);
    }
  };

  const handleTriggerTrainingReminderNow = async () => {
    setTriggeringReminder(true);
    setError('');
    try {
      const res = await triggerTrainingReminderNow(pushSubscriptions);
      if (res.skipped) {
        showNotice(
          res.reason === 'holiday'
            ? 'تم تجاوز التذكير لأن اليوم معلن إجازة رسمية.'
            : 'اليوم ليس من أيام التمرين (الإثنين والأربعاء والجمعة).'
        );
      } else if (res.ok) {
        showNotice(`تم إرسال إشعار تذكير التمرين الفوري إلى ${res.sent} جهاز لولي أمر.`);
        void fetchScheduleStatus().then((s) => s && setServerScheduleStatus(s));
      } else {
        setError('تعذر إرسال تذكير التمرين حالياً.');
      }
    } finally {
      setTriggeringReminder(false);
    }
  };

  const generateEasyPassword = () => String(Math.floor(100000 + Math.random() * 900000));

  const suggestUsernameFromPhone = (phone: string) => {
    const digits = convertArabicDigits(phone).replace(/[^a-zA-Z0-9._-]/g, '');
    return digits.slice(0, 32);
  };

  const openCreateParentModal = (athlete?: Athlete) => {
    setParentAcctError('');
    setCreatedParentResult(null);
    setCopiedCredentials(false);
    setAcctPassword(generateEasyPassword());
    setLinkSamePhoneAthletes(true);

    if (athlete) {
      setParentAccountMode('existing_athlete');
      setParentTargetAthleteId(athlete.id);
      setAcctParentName(athlete.parentName);
      setAcctParentPhone(athlete.parentPhone);
      setAcctUsername(
        athlete.parentEmail
          ? formatParentIdentifier(athlete.parentEmail)
          : suggestUsernameFromPhone(athlete.parentPhone)
      );
    } else {
      const firstUnlinked = athletes.find((a) => !a.parentUid) || athletes[0];
      if (firstUnlinked) {
        setParentAccountMode('existing_athlete');
        setParentTargetAthleteId(firstUnlinked.id);
        setAcctParentName(firstUnlinked.parentName);
        setAcctParentPhone(firstUnlinked.parentPhone);
        setAcctUsername(
          firstUnlinked.parentEmail
            ? formatParentIdentifier(firstUnlinked.parentEmail)
            : suggestUsernameFromPhone(firstUnlinked.parentPhone)
        );
      } else {
        setParentAccountMode('new_athlete');
        setParentTargetAthleteId('');
        setAcctParentName('');
        setAcctParentPhone('');
        setAcctUsername('');
      }
    }

    setAcctChildName('');
    setAcctChildAge('10');
    setAcctDiscipline('كيك بوكسينج');
    setAcctFee(String(DEFAULT_MONTHLY_FEE));
    setAcctNotes('');
    setShowCreateParentModal(true);
  };

  const handleSelectTargetAthlete = (athId: string) => {
    setParentTargetAthleteId(athId);
    const ath = athletes.find((a) => a.id === athId);
    if (ath) {
      setAcctParentName(ath.parentName);
      setAcctParentPhone(ath.parentPhone);
      setAcctUsername(
        ath.parentEmail
          ? formatParentIdentifier(ath.parentEmail)
          : suggestUsernameFromPhone(ath.parentPhone)
      );
    }
  };

  const handleCreateParentAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setParentAcctError('');
    setCreatingParentAcct(true);
    try {
      const cleanPass = convertArabicDigits(acctPassword).trim();
      const result = await coachCreateParentAccount({
        mode: parentAccountMode,
        athleteId: parentTargetAthleteId,
        linkMatchingPhoneAthletes: linkSamePhoneAthletes,
        parentName: acctParentName,
        parentPhone: acctParentPhone,
        usernameOrEmail: acctUsername,
        password: cleanPass,
        childName: acctChildName,
        childAge: Number(acctChildAge),
        discipline: acctDiscipline,
        monthlyFee: Number(acctFee),
        medicalNotes: acctNotes,
      });
      setCreatedParentResult({ info: result, password: cleanPass });
      showNotice(`تم إنشاء حساب ولي الأمر (${result.parentName}) بنجاح`);
    } catch (err) {
      setParentAcctError(err instanceof Error ? err.message : 'تعذر إنشاء حساب ولي الأمر');
    } finally {
      setCreatingParentAcct(false);
    }
  };

  const handleSaveAthleteWithoutPassword = async () => {
    if (parentAccountMode !== 'new_athlete') return;
    setParentAcctError('');
    setCreatingParentAcct(true);
    try {
      await coachAddAthlete({
        fullName: acctChildName,
        age: Number(acctChildAge),
        discipline: acctDiscipline,
        monthlyFee: Number(acctFee),
        parentName: acctParentName,
        parentPhone: acctParentPhone,
        medicalNotes: acctNotes,
      });
      setShowCreateParentModal(false);
      showNotice(
        `تم حفظ اللاعب ${acctChildName} بنجاح (يمكنك إنشاء حساب الدخول لاحقاً فور تفعيل Email/Password من Firebase)`
      );
    } catch (err) {
      setParentAcctError(err instanceof Error ? err.message : 'تعذر حفظ بيانات اللاعب');
    } finally {
      setCreatingParentAcct(false);
    }
  };

  const getParentInviteDetails = () => {
    if (!createdParentResult) {
      return { loginUrl: '', shareText: '', whatsappHref: '#' };
    }
    const baseOrigin =
      typeof window !== 'undefined'
        ? window.location.origin.replace('ais-dev-', 'ais-pre-')
        : '';
    const loginUrl = `${baseOrigin}/?login=parent&u=${encodeURIComponent(createdParentResult.info.username)}`;
    const athletesLabel =
      createdParentResult.info.linkedAthleteNames.length > 0
        ? createdParentResult.info.linkedAthleteNames.join(' و ')
        : 'اللاعب';
    const shareText = [
      'أهلاً بك في أكاديمية البوب للفنون القتالية (كابتن باهر مراد)',
      '',
      `تم تفعيل حساب ولي الأمر الخاص بكم لمتابعة: ${athletesLabel}`,
      'يمكنكم الدخول بنفس البيانات من أكثر من هاتف وسيظل الحساب مسجلاً تلقائياً:',
      '',
      `رابط الدخول المباشر:`,
      loginUrl,
      '',
      `اسم المستخدم: ${createdParentResult.info.username}`,
      `كلمة المرور: ${createdParentResult.password}`,
      '',
      'بعد فتح الرابط والدخول، فعّل الإشعارات وثبّت التطبيق على الشاشة الرئيسية.',
    ].join('\n');

    const rawDigits = createdParentResult.info.parentPhone.replace(/[^0-9]/g, '');
    const waPhone = rawDigits.startsWith('01') && rawDigits.length === 11 ? `2${rawDigits}` : rawDigits;
    const whatsappHref = waPhone
      ? `https://wa.me/${waPhone}?text=${encodeURIComponent(shareText)}`
      : `https://wa.me/?text=${encodeURIComponent(shareText)}`;

    return { loginUrl, shareText, whatsappHref };
  };

  const handleCopyCredentials = async () => {
    const { shareText } = getParentInviteDetails();
    if (!shareText) return;
    try {
      await navigator.clipboard.writeText(shareText);
      setCopiedCredentials(true);
      setTimeout(() => setCopiedCredentials(false), 3000);
    } catch {
      setParentAcctError('تعذر النسخ التلقائي. يمكنك نسخ البيانات يدوياً من البطاقة.');
    }
  };

  const buildParentWhatsAppHref = (phone: string, text?: string) => {
    const digits = convertArabicDigits(phone).replace(/[^0-9]/g, '');
    const intl = digits.startsWith('01') && digits.length === 11 ? `2${digits}` : digits;
    if (!intl) return 'https://wa.me/';
    return text
      ? `https://wa.me/${intl}?text=${encodeURIComponent(text)}`
      : `https://wa.me/${intl}`;
  };

  const handleMarkMessageRead = async (msgId: string) => {
    setMarkingMsgId(msgId);
    setError('');
    try {
      await coachMarkParentMessageRead(msgId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحديث حالة الرسالة');
    } finally {
      setMarkingMsgId(null);
    }
  };

  const handleSendReply = async (msgDoc: ParentMessage) => {
    const draft = (replyDrafts[msgDoc.id] || '').trim();
    if (!draft) return;
    setReplyingMsgId(msgDoc.id);
    setError('');
    try {
      const fallbackAthlete =
        athletes.find(
          (a) => a.parentUid === msgDoc.parentUid || (msgDoc.parentEmail && a.parentEmail === msgDoc.parentEmail)
        ) || null;
      await coachReplyParentMessage({
        messageDoc: msgDoc,
        replyText: draft,
        fallbackAthlete,
        knownSubscriptions: pushSubscriptions,
      });
      setReplyDrafts((prev) => ({ ...prev, [msgDoc.id]: '' }));
      showNotice(`تم إرسال ردك إلى ولي الأمر (${msgDoc.parentName}) بنجاح`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إرسال الرد');
    } finally {
      setReplyingMsgId(null);
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    setDeletingMsgId(msgId);
    setError('');
    try {
      await coachDeleteParentMessage(msgId);
      showNotice('تم حذف الرسالة بنجاح');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حذف الرسالة');
    } finally {
      setDeletingMsgId(null);
    }
  };

  const unreadParentMessagesCount = useMemo(
    () => parentMessages.filter((m) => !m.readByCoach).length,
    [parentMessages]
  );

  const filteredParentMessages = useMemo(() => {
    return parentMessages.filter((m) => {
      if (messageFilter === 'unread') return !m.readByCoach;
      if (messageFilter === 'replied') return Boolean(m.coachReply);
      return true;
    });
  }, [parentMessages, messageFilter]);

  const pendingRequestsCount = useMemo(
    () => registrationRequests.filter((r) => r.status === 'pending').length,
    [registrationRequests]
  );

  const filteredRegistrationRequests = useMemo(() => {
    if (requestFilter === 'all') return registrationRequests;
    return registrationRequests.filter((r) => r.status === requestFilter);
  }, [registrationRequests, requestFilter]);

  const handleApproveRequest = async (req: RegistrationRequest, openAccountModal: boolean) => {
    setBusyRequestId(req.id);
    setError('');
    try {
      const createdAth = await coachApproveRegistrationRequest(req);
      showNotice(`تم قبول طلب ${req.athleteName} وإضافته إلى قائمة لاعبي الأكاديمية بنجاح`);
      if (openAccountModal) {
        openCreateParentModal(createdAth);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر قبول الطلب');
    } finally {
      setBusyRequestId(null);
    }
  };

  const handleUpdateRequestStatus = async (
    req: RegistrationRequest,
    status: RegistrationRequestStatus
  ) => {
    setBusyRequestId(req.id);
    setError('');
    try {
      await coachUpdateRegistrationRequest(req.id, {
        status,
        coachNote: requestNoteDrafts[req.id] ?? req.coachNote,
      });
      showNotice(
        status === 'contacted'
          ? `تم تحديث طلب ${req.athleteName} إلى "تم التواصل"`
          : status === 'rejected'
            ? `تم تحديث طلب ${req.athleteName} إلى "مؤجل / مرفوض"`
            : `تم تحديث حالة طلب ${req.athleteName}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحديث حالة الطلب');
    } finally {
      setBusyRequestId(null);
    }
  };

  const handleDeleteRequest = async (requestId: string) => {
    setDeletingRequestId(requestId);
    setError('');
    try {
      await coachDeleteRegistrationRequest(requestId);
      showNotice('تم حذف طلب التسجيل بنجاح');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حذف الطلب');
    } finally {
      setDeletingRequestId(null);
    }
  };

  const parentsWithChildren = useMemo(() => {
    const q = parentSearchQuery.trim().toLowerCase();
    return parents
      .map((p) => {
        const linkedChildren = athletes.filter(
          (a) =>
            a.parentUid === p.uid ||
            (p.email && a.parentEmail && a.parentEmail.toLowerCase() === p.email.toLowerCase())
        );
        return { parent: p, children: linkedChildren };
      })
      .filter(({ parent, children }) => {
        if (!q) return true;
        const identifier = formatParentIdentifier(parent.email).toLowerCase();
        return (
          parent.fullName.toLowerCase().includes(q) ||
          parent.phone.includes(q) ||
          parent.email.toLowerCase().includes(q) ||
          identifier.includes(q) ||
          children.some((c) => c.fullName.toLowerCase().includes(q))
        );
      });
  }, [parents, athletes, parentSearchQuery]);

  const unlinkedCoachAthletes = useMemo(
    () => athletes.filter((a) => !a.parentUid),
    [athletes]
  );

  const exportParentsCsv = () => {
    const headers = [
      'اسم ولي الأمر',
      'رقم الهاتف',
      'نوع الحساب',
      'اسم المستخدم / البريد',
      'الأبناء المسجلون',
      'تاريخ التسجيل',
    ];
    const rows = parentsWithChildren.map(({ parent, children }) => {
      const isPasswordAcct = parent.email.toLowerCase().endsWith(PARENT_SYNTHETIC_DOMAIN);
      return [
        parent.fullName,
        parent.phone,
        isPasswordAcct ? 'يوزر وباسورد' : 'حساب Google',
        formatParentIdentifier(parent.email),
        children.map((c) => `${c.fullName} (${c.discipline})`).join(' | ') || 'لا يوجد أبناء مرتبطون',
        parent.createdAtIso ? formatArabicDate(parent.createdAtIso) : '—',
      ];
    });
    const csvContent =
      '\uFEFF' +
      [headers, ...rows]
        .map((r) => r.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
        .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alpop-registered-parents-${getTodayDateString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const pendingPhotosCount = useMemo(
    () => catalogPhotos.filter((p) => p.status === 'pending').length,
    [catalogPhotos]
  );

  const filteredCatalogPhotos = useMemo(() => {
    if (catalogFilter === 'all') return catalogPhotos;
    return catalogPhotos.filter((p) => p.status === catalogFilter);
  }, [catalogPhotos, catalogFilter]);

  const handleCoachAutoUploadPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;
    setCoachPhotoUploading(true);
    setError('');

    let uploadedCount = 0;
    try {
      const catLabel =
        COACH_PHOTO_CATEGORIES.find((c) => c.value === coachPhotoCategory)?.label ||
        'أكاديمية البوب';
      for (let idx = 0; idx < files.length; idx += 1) {
        const file = files[idx];
        const { dataUrl } = await compressImageFileToDataUrl(file);
        const fallbackTitle =
          files.length === 1 && coachPhotoTitle.trim().length >= 2
            ? coachPhotoTitle.trim()
            : coachPhotoTitle.trim().length >= 2
              ? `${coachPhotoTitle.trim()} (${idx + 1})`
              : `${catLabel} — ${getTodayDateString()}`;
        const captionText =
          coachPhotoCaption.trim() || 'من قلب تدريبات وبطولات أكاديمية البوب · كابتن باهر مراد';

        await coachPublishCatalogPhoto(profile, {
          title: fallbackTitle,
          caption: captionText,
          category: coachPhotoCategory,
          imageUrl: dataUrl,
        });
        uploadedCount += 1;
      }

      setCoachPhotoTitle('');
      setCoachPhotoCaption('');
      if (coachPhotoInputRef.current) {
        coachPhotoInputRef.current.value = '';
      }
      showNotice(
        uploadedCount === 1
          ? 'تمت إضافة الصورة ونشرها تلقائياً في كتالوج الأكاديمية!'
          : `تمت إضافة ${uploadedCount} صور ونشرها تلقائياً في كتالوج الأكاديمية!`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر نشر الصورة في الكتالوج');
    } finally {
      setCoachPhotoUploading(false);
    }
  };

  const handleReviewCatalogPhoto = async (
    photo: CatalogPhotoItem,
    status: CatalogPhotoStatus
  ) => {
    setBusyPhotoId(photo.id);
    setError('');
    try {
      const targetAthlete =
        athletes.find(
          (a) => a.id === photo.athleteId || (photo.submittedByUid && a.parentUid === photo.submittedByUid)
        ) || null;
      await coachReviewCatalogPhoto({
        photo,
        status,
        coachNote: photoNoteDrafts[photo.id] ?? photo.coachNote,
        targetAthlete,
        knownSubscriptions: pushSubscriptions,
      });
      showNotice(
        status === 'approved'
          ? `تمت الموافقة ونشر "${photo.title}" في الكتالوج العام وإشعار ولي الأمر!`
          : `تم تحديث حالة الصورة "${photo.title}"`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحديث حالة الصورة');
    } finally {
      setBusyPhotoId(null);
    }
  };

  const handleDeleteCatalogPhoto = async (photo: CatalogPhotoItem) => {
    setBusyPhotoId(photo.id);
    setError('');
    try {
      await deleteCatalogPhoto(photo.id);
      showNotice(`تم حذف الصورة "${photo.title}" من الكتالوج`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حذف الصورة');
    } finally {
      setBusyPhotoId(null);
    }
  };

  const filteredAthletes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return athletes.filter((ath) => {
      const matchesDisc = disciplineFilter === 'all' || ath.discipline === disciplineFilter;
      const code = getAthleteDisplayCode(ath).toLowerCase();
      const matchesQ =
        !q ||
        ath.fullName.toLowerCase().includes(q) ||
        ath.parentName.toLowerCase().includes(q) ||
        ath.parentPhone.includes(q) ||
        code.includes(q);
      return matchesDisc && matchesQ;
    });
  }, [athletes, searchQuery, disciplineFilter]);

  const allFilteredSelected =
    filteredAthletes.length > 0 &&
    filteredAthletes.every((a) => selectedAthleteIds.includes(a.id));

  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      const filteredSet = new Set(filteredAthletes.map((a) => a.id));
      setSelectedAthleteIds((prev) => prev.filter((id) => !filteredSet.has(id)));
    } else {
      const merged = new Set([...selectedAthleteIds, ...filteredAthletes.map((a) => a.id)]);
      setSelectedAthleteIds(Array.from(merged));
    }
  };

  const toggleSelectAthlete = (athleteId: string) => {
    setSelectedAthleteIds((prev) =>
      prev.includes(athleteId) ? prev.filter((id) => id !== athleteId) : [...prev, athleteId]
    );
  };

  const filteredReportSummaries = useMemo(() => {
    return report.summaries.filter((row) => {
      if (reportFilter === 'regular') return row.presentDays > 0 && row.attendanceRate >= 75;
      if (reportFilter === 'high_absence') return row.absentDays > 0;
      if (reportFilter === 'unpaid') return !row.isPaid;
      return true;
    });
  }, [report.summaries, reportFilter]);

  const exportMonthlyCsv = () => {
    const headers = [
      'اللاعب',
      'ولي الأمر',
      'رقم الهاتف',
      'التدريب',
      'أيام الحضور',
      'أيام الغياب',
      'نسبة الالتزام %',
      'الاشتراك الشهري',
      'المدفوع',
      'حالة السداد',
    ];
    const rows = report.summaries.map((s) => [
      s.athleteName,
      s.parentName,
      s.parentPhone,
      s.discipline,
      String(s.presentDays),
      String(s.absentDays),
      `${s.attendanceRate}%`,
      String(s.monthlyFee),
      String(s.paidAmount),
      s.isPaid ? 'مدفوع' : 'غير مسدد',
    ]);
    const csvContent =
      '\uFEFF' +
      [headers, ...rows]
        .map((r) => r.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
        .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alpop-monthly-report-${selectedMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white border border-zinc-200 rounded-xl p-8 text-center text-sm text-zinc-500">
          جاري تحميل لوحة إدارة المدرب...
        </div>
      </div>
    );
  }

  const presentTodayCount = dayAttendance.filter(
    (r) => r.status === 'present' || r.status === 'checked_out'
  ).length;
  const checkedOutTodayCount = dayAttendance.filter(
    (r) => r.status === 'checked_out'
  ).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-zinc-200">
        <div>
          <div className="text-xs font-medium text-[#A17415]">
            لوحة تحكم المدرب الخاصة · أكاديمية البوب للفنون القتالية ·{' '}
            <span className="font-mono" dir="ltr">
              {profile.phone}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#111315] mt-1">
            أهلاً {profile.fullName}
          </h1>
        </div>

        <div className="flex flex-wrap items-start gap-2.5">
          <PushNotificationButton profile={profile} />
          <PWAInstallButton />
          <button
            type="button"
            onClick={() => openCreateParentModal()}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#111315] hover:bg-zinc-800 rounded-lg transition-colors whitespace-nowrap"
          >
            <KeyRound className="w-4 h-4 text-[#D4A843]" />
            <span>إنشاء حساب ولي أمر</span>
          </button>
          <button
            type="button"
            onClick={() => setShowBroadcastModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[#111315] bg-[#D4A843] hover:bg-[#c29634] rounded-lg transition-colors whitespace-nowrap"
          >
            <Megaphone className="w-4 h-4" />
            <span>إشعار جماعي لأولياء الأمور</span>
          </button>
          <button
            type="button"
            onClick={() => setShowAddAthlete(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#B91C1C] hover:bg-[#991B1B] rounded-lg transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة لاعب جديد</span>
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm font-medium rounded-lg flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{actionMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionMessage('')}
            className="text-emerald-700 hover:text-emerald-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg">
          {error}
        </div>
      )}

      {/* Top KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <div className="text-xs text-zinc-500">إجمالي اللاعبين المسجلين</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-[#111315] mt-1">
            {athletes.length}
          </div>
          <div className="text-xs text-zinc-500 mt-1">كيك بوكسينج · كونغ فو · MMA</div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <div className="text-xs text-zinc-500">حضور اليوم ({formatArabicDate(selectedDate)})</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
            {presentTodayCount}
          </div>
          <div className="text-xs text-zinc-500 mt-1 tabular-nums">
            انصرف منهم: {checkedOutTodayCount}
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <div className="text-xs text-zinc-500">
            محصل اشتراكات {formatArabicMonth(selectedMonth)}
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-[#111315] mt-1">
            {formatCurrencyEGP(report.totalRevenue)}
          </div>
          <div className="text-xs text-zinc-500 mt-1 tabular-nums">
            من أصل {formatCurrencyEGP(report.expectedRevenue)}
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <div className="text-xs text-zinc-500">حالة سداد الشهر (250 ج.م / لاعب)</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-[#B91C1C] mt-1">
            {report.unpaidCount} غير مسدد
          </div>
          <div className="text-xs text-emerald-700 font-medium mt-1 tabular-nums">
            {report.paidCount} مسددين بالكامل
          </div>
        </div>
      </div>

      {/* Automatic Training Reminder & One-Click Holiday Control Bar */}
      {(() => {
        const todayStr = getTodayDateString();
        const activeHoliday = holidays.find((h) => h.date === selectedDate) || null;
        const todayHoliday = holidays.find((h) => h.date === todayStr) || null;
        const isSelectedTraining = isTrainingDayDate(selectedDate);
        const parentDeviceCount = pushSubscriptions.filter((s) => s.role === 'parent').length;

        return (
          <div className="bg-white/95 border border-zinc-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                {activeHoliday ? (
                  <CalendarOff className="w-4 h-4 text-[#B91C1C] shrink-0" />
                ) : (
                  <BellRing className="w-4 h-4 text-[#A17415] shrink-0" />
                )}
                <h2 className="text-sm font-bold text-[#111315]">
                  التذكير التلقائي بموعد التمرين وإعلان الإجازة
                </h2>
                <span className="text-xs text-zinc-500 tabular-nums">
                  · أجهزة أولياء الأمور المفعّلة للخلفية: {parentDeviceCount}
                </span>
              </div>
              <p className="text-xs text-zinc-600 leading-relaxed">
                {activeHoliday ? (
                  <>
                    تاريخ{' '}
                    <strong className="text-[#B91C1C]">
                      {getArabicWeekdayName(selectedDate)} ({selectedDate})
                    </strong>{' '}
                    مُعلن إجازة رسمية{activeHoliday.reason ? ` (${activeHoliday.reason})` : ''} — تم إيقاف التذكير التلقائي لهذا اليوم.
                  </>
                ) : isSelectedTraining ? (
                  <>
                    يوم{' '}
                    <strong className="text-emerald-700">
                      {getArabicWeekdayName(selectedDate)} ({selectedDate})
                    </strong>{' '}
                    يوم تمرين (5:00 مساءً) · يتم إرسال إشعار تذكير تلقائي لأولياء الأمور الساعة 10:00 ص بتوقيت القاهرة أيام الإثنين والأربعاء والجمعة.
                  </>
                ) : (
                  <>
                    يوم {getArabicWeekdayName(selectedDate)} ({selectedDate}) ليس يوم تمرين · التذكير التلقائي يعمل أيام الإثنين والأربعاء والجمعة الساعة 10:00 ص بتوقيت القاهرة.
                  </>
                )}
                {serverScheduleStatus?.isTrainingDay && !todayHoliday && (
                  <span className="mr-2 font-semibold text-emerald-700">
                    {serverScheduleStatus.autoReminderSentToday
                      ? '· تم إرسال تذكير اليوم تلقائياً'
                      : '· تذكير اليوم التلقائي مفعّل وجاهز'}
                  </span>
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {activeHoliday ? (
                <button
                  type="button"
                  disabled={cancellingHoliday}
                  onClick={() => handleCancelHoliday(selectedDate)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold bg-[#15803D] hover:bg-[#166534] text-white rounded-lg transition-colors disabled:opacity-60 whitespace-nowrap"
                >
                  <Calendar className="w-4 h-4" />
                  <span>
                    {cancellingHoliday
                      ? 'جاري الاستئناف...'
                      : 'إلغاء الإجازة واستئناف التمرين'}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => openHolidayModal(selectedDate)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold bg-[#B91C1C] hover:bg-[#991B1B] text-white rounded-lg transition-colors whitespace-nowrap"
                >
                  <CalendarOff className="w-4 h-4" />
                  <span>اليوم إجازة — إبلاغ أولياء الأمور</span>
                </button>
              )}

              <button
                type="button"
                disabled={triggeringReminder}
                onClick={handleTriggerTrainingReminderNow}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold bg-[#111315] hover:bg-zinc-800 text-[#D4A843] rounded-lg transition-colors disabled:opacity-60 whitespace-nowrap"
              >
                <Send className="w-3.5 h-3.5" />
                <span>
                  {triggeringReminder ? 'جاري الإرسال...' : 'إرسال تذكير التمرين الآن'}
                </span>
              </button>
            </div>
          </div>
        );
      })()}

      {/* Workspace Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-zinc-200/70 rounded-lg border border-zinc-200">
          <button
            type="button"
            onClick={() => setActiveTab('attendance')}
            className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'attendance'
                ? 'bg-[#111315] text-white'
                : 'text-zinc-700 hover:text-[#111315]'
            }`}
          >
            الحضور والانصراف وإرسال الإشعارات
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('athletes')}
            className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'athletes'
                ? 'bg-[#111315] text-white'
                : 'text-zinc-700 hover:text-[#111315]'
            }`}
          >
            بيانات اللعيبة وأولياء الأمور
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('payments')}
            className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'payments'
                ? 'bg-[#111315] text-white'
                : 'text-zinc-700 hover:text-[#111315]'
            }`}
          >
            الاشتراكات والرسوم
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('monthly_report')}
            className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'monthly_report'
                ? 'bg-[#111315] text-white'
                : 'text-zinc-700 hover:text-[#111315]'
            }`}
          >
            تجميع نهاية الشهر (حضور وغياب)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('parents')}
            className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'parents'
                ? 'bg-[#111315] text-white'
                : 'text-zinc-700 hover:text-[#111315]'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-[#D4A843]" />
            <span>أولياء الأمور المسجلون ({parents.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('parent_messages')}
            className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'parent_messages'
                ? 'bg-[#111315] text-white'
                : 'text-zinc-700 hover:text-[#111315]'
            }`}
          >
            <Mail className="w-3.5 h-3.5 text-[#D4A843]" />
            <span>رسائل أولياء الأمور</span>
            {unreadParentMessagesCount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-[#B91C1C] text-white rounded">
                {unreadParentMessagesCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('requests')}
            className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'requests'
                ? 'bg-[#111315] text-white'
                : 'text-zinc-700 hover:text-[#111315]'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5 text-[#D4A843]" />
            <span>طلبات التسجيل ({registrationRequests.length})</span>
            {pendingRequestsCount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-[#B91C1C] text-white rounded">
                {pendingRequestsCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('catalog')}
            className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'catalog'
                ? 'bg-[#111315] text-white'
                : 'text-zinc-700 hover:text-[#111315]'
            }`}
          >
            <Camera className="w-3.5 h-3.5 text-[#D4A843]" />
            <span>كتالوج الصور</span>
            {pendingPhotosCount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-[#B91C1C] text-white rounded">
                {pendingPhotosCount}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-3">
          {activeTab === 'attendance' ? (
            <div className="flex items-center gap-2">
              <label htmlFor="coach-date" className="text-xs font-semibold text-zinc-600">
                تاريخ التمرين:
              </label>
              <input
                id="coach-date"
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setSelectedMonth(e.target.value.slice(0, 7));
                }}
                className="px-3 py-1.5 text-xs font-mono bg-white border border-zinc-300 rounded-lg focus:outline-none focus:border-[#111315]"
              />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <label htmlFor="coach-month" className="text-xs font-semibold text-zinc-600">
                الشهر:
              </label>
              <input
                id="coach-month"
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3 py-1.5 text-xs font-mono bg-white border border-zinc-300 rounded-lg focus:outline-none focus:border-[#111315]"
              />
            </div>
          )}
        </div>
      </div>

      {/* TAB 1: DAILY ATTENDANCE + INDIVIDUAL & BULK NOTIFICATIONS */}
      {activeTab === 'attendance' && (
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-zinc-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="relative flex-1 min-w-[220px] max-w-sm">
                <Search className="w-4 h-4 text-zinc-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="بحث باسم اللاعب أو ولي الأمر أو الهاتف..."
                  className="w-full pr-9 pl-3 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-lg focus:outline-none focus:border-[#111315]"
                />
              </div>
              <select
                value={disciplineFilter}
                onChange={(e) => setDisciplineFilter(e.target.value)}
                className="px-3 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-lg focus:outline-none focus:border-[#111315]"
              >
                <option value="all">كل التدريبات</option>
                {DISCIPLINES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 min-w-[260px]">
              <input
                type="text"
                value={quickNote}
                onChange={(e) => setQuickNote(e.target.value)}
                placeholder="ملاحظة اختيارية تُرفق بالإشعار (مثال: أداء ممتاز)"
                className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-lg focus:outline-none focus:border-[#111315]"
              />
            </div>
          </div>

          {selectedAthleteIds.length > 0 && (
            <div className="px-5 py-3 bg-[#111315] text-white flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs font-semibold">
                تم تحديد <span className="font-mono text-[#D4A843]">{selectedAthleteIds.length}</span> لاعب لإرسال إشعار جماعي
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={bulkBusy}
                  onClick={() => handleBulkAttendance('check_in')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white rounded-md transition-colors disabled:opacity-50"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>إشعار حضور جماعي للمحددين</span>
                </button>
                <button
                  type="button"
                  disabled={bulkBusy}
                  onClick={() => handleBulkAttendance('check_out')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-[#D4A843] hover:bg-[#c29634] text-[#111315] rounded-md transition-colors disabled:opacity-50"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>إشعار انصراف جماعي للمحددين</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedAthleteIds([])}
                  className="px-2.5 py-1.5 text-xs text-zinc-300 hover:text-white"
                >
                  إلغاء التحديد
                </button>
              </div>
            </div>
          )}

          {filteredAthletes.length === 0 ? (
            <div className="p-8 text-center text-sm text-zinc-500">
              لا يوجد لاعبون مسجلون حتى الآن. أضف أول لاعب من زر «إضافة لاعب جديد» أو شارك الرابط مع أولياء الأمور للتسجيل.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-zinc-50 text-xs font-semibold text-zinc-600 border-b border-zinc-200">
                  <tr>
                    <th className="py-3 px-4 w-10">
                      <input
                        type="checkbox"
                        checked={allFilteredSelected}
                        onChange={toggleSelectAllFiltered}
                        aria-label="تحديد جميع اللاعبين"
                        className="w-4 h-4 accent-[#111315] rounded cursor-pointer"
                      />
                    </th>
                    <th className="py-3 px-4">اللاعب</th>
                    <th className="py-3 px-4">ولي الأمر</th>
                    <th className="py-3 px-4">التدريب</th>
                    <th className="py-3 px-4">حالة اليوم</th>
                    <th className="py-3 px-4">الحضور / الانصراف</th>
                    <th className="py-3 px-4">إجراءات الإشعار الفوري</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {filteredAthletes.map((ath) => {
                    const rec = dayAttendance.find((r) => r.athleteId === ath.id);
                    const isBusy = busyAthleteId === ath.id;
                    const isChecked = selectedAthleteIds.includes(ath.id);
                    return (
                      <tr key={ath.id} className="hover:bg-zinc-50/70">
                        <td className="py-3.5 px-4">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelectAthlete(ath.id)}
                            aria-label={`تحديد ${ath.fullName}`}
                            className="w-4 h-4 accent-[#111315] rounded cursor-pointer"
                          />
                        </td>
                        <td className="py-3.5 px-4 font-bold text-[#111315] whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            <span>{ath.fullName}</span>
                            {paidAthleteIds.has(ath.id) ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>تم السداد</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={quickPayingId === ath.id}
                                onClick={() => handleQuickMarkPaid(ath)}
                                title={`تسجيل دفع اشتراك شهر ${selectedMonth} (${formatCurrencyEGP(ath.monthlyFee)})`}
                                className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 rounded-md transition-colors disabled:opacity-50"
                              >
                                <Wallet className="w-3 h-3" />
                                <span>{quickPayingId === ath.id ? 'جاري...' : 'تم السداد'}</span>
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-zinc-600 whitespace-nowrap">
                          <div>{ath.parentName}</div>
                          <div className="font-mono text-zinc-500 mt-0.5" dir="ltr">
                            {ath.parentPhone}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-zinc-700 whitespace-nowrap">
                          {ath.discipline}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {rec?.status === 'present' && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700">
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>حاضر الآن</span>
                            </span>
                          )}
                          {rec?.status === 'checked_out' && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>تم الانصراف</span>
                            </span>
                          )}
                          {rec?.status === 'absent' && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#B91C1C]">
                              <XCircle className="w-3.5 h-3.5" />
                              <span>غائب</span>
                            </span>
                          )}
                          {!rec && <span className="text-xs text-zinc-400">بانتظار التسجيل</span>}
                        </td>
                        <td className="py-3.5 px-4 font-mono tabular-nums text-xs text-zinc-700 whitespace-nowrap">
                          {rec?.checkInTime ? formatArabicTime(rec.checkInTime) : '—'} /{' '}
                          {rec?.checkOutTime ? formatArabicTime(rec.checkOutTime) : '—'}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleAttendanceAction(ath, 'check_in')}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white rounded-md transition-colors disabled:opacity-50"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>حضور + إشعار</span>
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleAttendanceAction(ath, 'check_out')}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#111315] hover:bg-zinc-800 text-[#D4A843] rounded-md transition-colors disabled:opacity-50"
                            >
                              <LogOut className="w-3.5 h-3.5" />
                              <span>انصراف + إشعار</span>
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleAttendanceAction(ath, 'absent')}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold border border-red-200 text-[#B91C1C] hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                            >
                              <span>غياب</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setNotifyAthlete(ath)}
                              className="p-1.5 text-zinc-600 hover:text-[#111315] border border-zinc-200 rounded-md"
                              title="إرسال إشعار خاص لولي الأمر"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingAthlete(ath)}
                              className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-semibold text-zinc-500 hover:text-[#B91C1C] hover:bg-red-50 border border-zinc-200 hover:border-red-200 rounded-md transition-colors"
                              title={`حذف اللاعب ${ath.fullName} من الموقع`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>حذف</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ATHLETES & PARENTS DIRECTORY */}
      {activeTab === 'athletes' && (
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-zinc-200 flex flex-wrap items-center justify-between gap-4">
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <Search className="w-4 h-4 text-zinc-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث عن لاعب أو رقم هاتف..."
                className="w-full pr-9 pl-3 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-lg focus:outline-none focus:border-[#111315]"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowAddAthlete(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#111315] text-white rounded-lg"
            >
              <Plus className="w-3.5 h-3.5 text-[#D4A843]" />
              <span>تسجيل لاعب جديد</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-zinc-50 text-xs font-semibold text-zinc-600 border-b border-zinc-200">
                <tr>
                  <th className="py-3 px-4">الكود</th>
                  <th className="py-3 px-4">اسم اللاعب</th>
                  <th className="py-3 px-4">العمر</th>
                  <th className="py-3 px-4">التدريب</th>
                  <th className="py-3 px-4">ولي الأمر والهاتف</th>
                  <th className="py-3 px-4">الاشتراك الشهري</th>
                  <th className="py-3 px-4">ملاحظات صحية</th>
                  <th className="py-3 px-4">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {filteredAthletes.map((ath) => (
                  <tr key={ath.id} className="hover:bg-zinc-50/70">
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className="px-2 py-0.5 text-[11px] font-mono font-bold bg-[#111315] text-[#D4A843] rounded"
                        dir="ltr"
                      >
                        {getAthleteDisplayCode(ath)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-[#111315] whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <span>{ath.fullName}</span>
                        {paidAthleteIds.has(ath.id) ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>تم السداد</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={quickPayingId === ath.id}
                            onClick={() => handleQuickMarkPaid(ath)}
                            title={`تسجيل دفع اشتراك شهر ${selectedMonth} (${formatCurrencyEGP(ath.monthlyFee)})`}
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 rounded-md transition-colors disabled:opacity-50"
                          >
                            <Wallet className="w-3 h-3" />
                            <span>{quickPayingId === ath.id ? 'جاري...' : 'تم السداد'}</span>
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono tabular-nums text-xs">
                      {ath.age} سنة
                    </td>
                    <td className="py-3.5 px-4 text-xs whitespace-nowrap">{ath.discipline}</td>
                    <td className="py-3.5 px-4 text-xs whitespace-nowrap">
                      <div className="font-medium text-[#111315]">{ath.parentName}</div>
                      <div className="font-mono text-zinc-500" dir="ltr">
                        {ath.parentPhone}
                      </div>
                      {ath.parentUid ? (
                        <div className="text-[11px] font-semibold text-emerald-700 mt-0.5 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 shrink-0" />
                          <span>حساب مفعل</span>
                          {ath.parentEmail && (
                            <span className="font-mono text-zinc-500 font-normal" dir="ltr">
                              ({formatParentIdentifier(ath.parentEmail)})
                            </span>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openCreateParentModal(ath)}
                          className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 rounded-md transition-colors"
                        >
                          <KeyRound className="w-3 h-3" />
                          <span>إنشاء حساب دخول</span>
                        </button>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono tabular-nums text-xs font-semibold whitespace-nowrap">
                      {formatCurrencyEGP(ath.monthlyFee)}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-zinc-600 max-w-xs">
                      {ath.medicalNotes}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingAthlete(ath);
                            setEditDisc(ath.discipline);
                            setEditFee(String(ath.monthlyFee));
                            setEditNotes(ath.medicalNotes);
                          }}
                          className="px-3 py-1.5 text-xs font-semibold border border-zinc-300 hover:border-[#111315] rounded-md"
                        >
                          تعديل
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingAthlete(ath)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#B91C1C] border border-red-200 hover:bg-red-50 rounded-md transition-colors"
                          title={`حذف اللاعب ${ath.fullName}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>حذف</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: SUBSCRIPTIONS & FEES */}
      {activeTab === 'payments' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8 bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#111315]">
                حالة الاشتراكات لشهر {formatArabicMonth(selectedMonth)}
              </h2>
              <span className="text-xs text-zinc-500 tabular-nums">
                مسدد: {report.paidCount} · متبقي: {report.unpaidCount}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-zinc-50 text-xs font-semibold text-zinc-600 border-b border-zinc-200">
                  <tr>
                    <th className="py-3 px-4">اللاعب</th>
                    <th className="py-3 px-4">ولي الأمر</th>
                    <th className="py-3 px-4">القيمة المطلوبة</th>
                    <th className="py-3 px-4">المدفوع</th>
                    <th className="py-3 px-4">الحالة</th>
                    <th className="py-3 px-4">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {report.summaries.map((row) => {
                    const ath = athletes.find((a) => a.id === row.athleteId);
                    return (
                      <tr key={row.athleteId} className="hover:bg-zinc-50/70">
                        <td className="py-3.5 px-4 font-bold text-[#111315] whitespace-nowrap">
                          {row.athleteName}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-zinc-600 whitespace-nowrap">
                          {row.parentName}
                        </td>
                        <td className="py-3.5 px-4 font-mono tabular-nums text-xs">
                          {formatCurrencyEGP(row.monthlyFee)}
                        </td>
                        <td className="py-3.5 px-4 font-mono tabular-nums text-xs font-bold">
                          {formatCurrencyEGP(row.paidAmount)}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {row.isPaid ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>مسدد</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-[#B91C1C]">
                              <XCircle className="w-3.5 h-3.5" />
                              <span>غير مسدد</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {ath && (
                            <button
                              type="button"
                              onClick={() => {
                                setPaymentAthlete(ath);
                                setPayAmount(String(ath.monthlyFee));
                                setPayMethod('نقدي');
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#111315] hover:bg-zinc-800 text-[#D4A843] rounded-md"
                            >
                              <Wallet className="w-3.5 h-3.5" />
                              <span>{row.isPaid ? 'إضافة رسوم' : 'تسجيل دفع'}</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="lg:col-span-4 bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-200">
              <h3 className="text-sm font-bold text-[#111315]">إيصالات الشهر المسجلة</h3>
            </div>
            {monthPayments.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-500">
                لا توجد مدفوعات مسجلة لهذا الشهر بعد.
              </div>
            ) : (
              <div className="divide-y divide-zinc-200 max-h-[520px] overflow-y-auto">
                {monthPayments.map((pay) => {
                  const ath = athletes.find((a) => a.id === pay.athleteId);
                  return (
                    <div key={pay.id} className="p-4 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold text-[#111315]">
                          {ath?.fullName || 'لاعب'}
                        </div>
                        <div className="text-[11px] text-zinc-500 mt-0.5">
                          {pay.method} · {formatArabicDate(pay.paidAt)}
                        </div>
                      </div>
                      <div className="font-mono text-sm font-bold tabular-nums text-emerald-700">
                        {formatCurrencyEGP(pay.amount)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: END OF MONTH AGGREGATION REPORT */}
      {activeTab === 'monthly_report' && (
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-[#111315]">
                التقرير التجميعي لنهاية الشهر — {formatArabicMonth(selectedMonth)}
              </h2>
              <div className="text-xs text-zinc-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 tabular-nums">
                <span>إجمالي مرات الحضور: {report.totalPresentRecords}</span>
                <span aria-hidden="true">·</span>
                <span>إجمالي مرات الغياب: {report.totalAbsentRecords}</span>
                <span aria-hidden="true">·</span>
                <span>الإيراد المحصل: {formatCurrencyEGP(report.totalRevenue)}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex p-1 bg-zinc-100 rounded-lg border border-zinc-200">
                {(
                  [
                    ['all', 'الكل'],
                    ['regular', 'المنتظمون'],
                    ['high_absence', 'لديهم غياب'],
                    ['unpaid', 'غير مسددين'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setReportFilter(key)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                      reportFilter === key
                        ? 'bg-white text-[#111315] shadow-sm'
                        : 'text-zinc-600 hover:text-[#111315]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={exportMonthlyCsv}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#111315] hover:bg-zinc-800 text-white rounded-lg whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5 text-[#D4A843]" />
                <span>تصدير التقرير CSV</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-zinc-50 text-xs font-semibold text-zinc-600 border-b border-zinc-200">
                <tr>
                  <th className="py-3 px-4">اللاعب</th>
                  <th className="py-3 px-4">ولي الأمر</th>
                  <th className="py-3 px-4">التدريب</th>
                  <th className="py-3 px-4">أيام الحضور</th>
                  <th className="py-3 px-4">أيام الغياب</th>
                  <th className="py-3 px-4">نسبة الالتزام</th>
                  <th className="py-3 px-4">الاشتراك</th>
                  <th className="py-3 px-4">آخر حضور</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {filteredReportSummaries.map((row) => (
                  <tr key={row.athleteId} className="hover:bg-zinc-50/70">
                    <td className="py-3.5 px-4 font-bold text-[#111315] whitespace-nowrap">
                      {row.athleteName}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-zinc-600 whitespace-nowrap">
                      {row.parentName} · <span className="font-mono">{row.parentPhone}</span>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-zinc-700 whitespace-nowrap">
                      {row.discipline}
                    </td>
                    <td className="py-3.5 px-4 font-mono tabular-nums font-bold text-emerald-700">
                      {row.presentDays}
                    </td>
                    <td className="py-3.5 px-4 font-mono tabular-nums font-bold text-[#B91C1C]">
                      {row.absentDays}
                    </td>
                    <td className="py-3.5 px-4 font-mono tabular-nums font-semibold text-[#111315]">
                      {row.attendanceRate}%
                    </td>
                    <td className="py-3.5 px-4 text-xs whitespace-nowrap">
                      {row.isPaid ? (
                        <span className="font-bold text-emerald-700 tabular-nums">
                          مسدد ({formatCurrencyEGP(row.paidAmount)})
                        </span>
                      ) : (
                        <span className="font-bold text-[#B91C1C] tabular-nums">
                          غير مسدد ({formatCurrencyEGP(row.monthlyFee)})
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-zinc-600 whitespace-nowrap">
                      {row.lastCheckIn ? formatArabicDate(row.lastCheckIn) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: ALL REGISTERED PARENTS DIRECTORY */}
      {activeTab === 'parents' && (
        <div className="space-y-6">
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <div className="p-5 border-b border-zinc-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-[#111315]">
                  دليل حسابات أولياء الأمور المسجلين ({parents.length})
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  جميع بيانات أولياء الأمور المسجلين في التطبيق مع أرقام الهواتف والأبناء المرتبطين بكل حساب.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative min-w-[230px]">
                  <Search className="w-4 h-4 text-zinc-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={parentSearchQuery}
                    onChange={(e) => setParentSearchQuery(e.target.value)}
                    placeholder="بحث باسم ولي الأمر أو الهاتف أو الابن..."
                    className="w-full pr-9 pl-3 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-lg focus:outline-none focus:border-[#111315]"
                  />
                </div>
                <button
                  type="button"
                  onClick={exportParentsCsv}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#111315] hover:bg-zinc-800 text-white rounded-lg whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5 text-[#D4A843]" />
                  <span>تصدير CSV</span>
                </button>
              </div>
            </div>

            {parentsWithChildren.length === 0 ? (
              <div className="p-8 text-center text-sm text-zinc-500">
                لا يوجد حسابات أولياء أمور مطابقة للبحث حالياً.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="bg-zinc-50 text-xs font-semibold text-zinc-600 border-b border-zinc-200">
                    <tr>
                      <th className="py-3 px-4">ولي الأمر</th>
                      <th className="py-3 px-4">رقم الهاتف والتواصل</th>
                      <th className="py-3 px-4">بيانات الحساب والدخول</th>
                      <th className="py-3 px-4">الأبناء المسجلون وحالة الاشتراك</th>
                      <th className="py-3 px-4">تاريخ التسجيل</th>
                      <th className="py-3 px-4">إجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {parentsWithChildren.map(({ parent: p, children }) => {
                      const isPasswordAcct = p.email
                        .toLowerCase()
                        .endsWith(PARENT_SYNTHETIC_DOMAIN);
                      const firstChild = children[0];
                      return (
                        <tr key={p.uid} className="hover:bg-zinc-50/70 align-top">
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="font-bold text-[#111315]">{p.fullName}</div>
                            <div className="text-[11px] text-zinc-400 font-mono mt-0.5">
                              {p.uid.slice(0, 10)}...
                            </div>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="font-mono text-xs font-semibold text-[#111315]" dir="ltr">
                              {p.phone}
                            </div>
                            <div className="flex items-center gap-2 mt-1.5">
                              <a
                                href={`tel:${p.phone}`}
                                className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold bg-zinc-100 hover:bg-zinc-200 text-[#111315] rounded border border-zinc-200"
                              >
                                <Phone className="w-3 h-3" />
                                <span>اتصال</span>
                              </a>
                              <a
                                href={buildParentWhatsAppHref(p.phone)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded border border-emerald-200"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>واتساب</span>
                              </a>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span
                              className={`inline-block px-2 py-0.5 text-[11px] font-semibold rounded border ${
                                isPasswordAcct
                                  ? 'bg-amber-50 text-amber-900 border-amber-200'
                                  : 'bg-zinc-100 text-zinc-800 border-zinc-200'
                              }`}
                            >
                              {isPasswordAcct ? 'حساب يوزر وباسورد' : 'حساب Google'}
                            </span>
                            <div className="font-mono text-xs text-zinc-600 mt-1" dir="ltr">
                              {formatParentIdentifier(p.email)}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            {children.length === 0 ? (
                              <span className="text-xs text-zinc-400">
                                لم يتم ربط أبناء بعد
                              </span>
                            ) : (
                              <div className="space-y-1.5">
                                {children.map((child) => (
                                  <div
                                    key={child.id}
                                    className="text-xs flex flex-wrap items-center gap-2"
                                  >
                                    <span className="font-bold text-[#111315]">
                                      {child.fullName}
                                    </span>
                                    <span className="text-zinc-500">({child.discipline})</span>
                                    {paidAthleteIds.has(child.id) ? (
                                      <span className="text-[11px] font-semibold text-emerald-700">
                                        · مسدد
                                      </span>
                                    ) : (
                                      <span className="text-[11px] font-semibold text-[#B91C1C]">
                                        · غير مسدد
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-xs text-zinc-600 whitespace-nowrap">
                            {p.createdAtIso ? formatArabicDate(p.createdAtIso) : '—'}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {firstChild ? (
                              <button
                                type="button"
                                onClick={() => setNotifyAthlete(firstChild)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#111315] hover:bg-zinc-800 text-[#D4A843] rounded-md"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                                <span>إرسال إشعار</span>
                              </button>
                            ) : (
                              <span className="text-xs text-zinc-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {unlinkedCoachAthletes.length > 0 && (
            <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-[#111315]">
                    أولياء أمور مضافون في جدول اللاعبين بدون حساب دخول ({unlinkedCoachAthletes.length})
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    هؤلاء اللاعبون تم تسجيل بياناتهم بواسطة المدرب ولم يفعّل أولياء أمورهم حساب دخول بعد.
                  </p>
                </div>
              </div>
              <div className="divide-y divide-zinc-200">
                {unlinkedCoachAthletes.map((ath) => (
                  <div
                    key={ath.id}
                    className="px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <span className="font-bold text-[#111315]">{ath.parentName}</span>
                      <span className="mx-2 text-zinc-300">·</span>
                      <span className="font-mono text-zinc-600" dir="ltr">
                        {ath.parentPhone}
                      </span>
                      <span className="mx-2 text-zinc-300">·</span>
                      <span className="text-zinc-600">
                        اللاعب: {ath.fullName} ({ath.discipline})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => openCreateParentModal(ath)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 font-semibold bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 rounded-md"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>إنشاء حساب دخول لولي الأمر</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 6: INCOMING MESSAGES FROM PARENTS */}
      {activeTab === 'parent_messages' && (
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-[#111315]">
                رسائل واستفسارات أولياء الأمور ({parentMessages.length})
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                جميع الرسائل الواردة من أولياء الأمور مع إمكانية الرد المباشر ليصلهم فوراً داخل التطبيق.
              </p>
            </div>
            <div className="inline-flex p-1 bg-zinc-100 rounded-lg border border-zinc-200">
              {(
                [
                  ['all', `الكل (${parentMessages.length})`],
                  ['unread', `غير مقروءة (${unreadParentMessagesCount})`],
                  ['replied', 'تم الرد'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMessageFilter(key)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                    messageFilter === key
                      ? 'bg-white text-[#111315] shadow-sm'
                      : 'text-zinc-600 hover:text-[#111315]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {filteredParentMessages.length === 0 ? (
            <div className="p-10 text-center text-sm text-zinc-500">
              لا توجد رسائل من أولياء الأمور في هذا القسم حالياً.
            </div>
          ) : (
            <div className="divide-y divide-zinc-200">
              {filteredParentMessages.map((msg) => {
                const draft = replyDrafts[msg.id] ?? '';
                const isReplying = replyingMsgId === msg.id;
                const isMarking = markingMsgId === msg.id;
                const isDeleting = deletingMsgId === msg.id;

                return (
                  <div
                    key={msg.id}
                    className={`p-5 space-y-3 ${
                      msg.readByCoach ? 'bg-white' : 'bg-[#FFFDF5]'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-[#111315]">
                            {msg.parentName}
                          </span>
                          <span className="text-xs text-zinc-500">· {msg.athleteName}</span>
                          {!msg.readByCoach && (
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-[#B91C1C] text-white rounded">
                              رسالة جديدة
                            </span>
                          )}
                          {msg.coachReply && (
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 rounded">
                              تم الرد
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500 mt-1">
                          <span className="font-mono" dir="ltr">
                            {msg.parentPhone}
                          </span>
                          <a
                            href={buildParentWhatsAppHref(msg.parentPhone)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-700 font-semibold hover:underline inline-flex items-center gap-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>واتساب</span>
                          </a>
                          <span>
                            {msg.createdAtIso
                              ? `${formatArabicDate(msg.createdAtIso)} · ${formatArabicTime(msg.createdAtIso)}`
                              : 'الآن'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {!msg.readByCoach && (
                          <button
                            type="button"
                            disabled={isMarking}
                            onClick={() => handleMarkMessageRead(msg.id)}
                            className="px-3 py-1.5 text-xs font-semibold border border-zinc-300 hover:border-[#111315] text-[#111315] rounded-md disabled:opacity-50"
                          >
                            {isMarking ? 'جاري...' : 'تحديد كمقروء'}
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={isDeleting}
                          onClick={() => handleDeleteMessage(msg.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#B91C1C] border border-red-200 hover:bg-red-50 rounded-md disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>حذف</span>
                        </button>
                      </div>
                    </div>

                    <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3.5 space-y-1">
                      <div className="text-xs font-bold text-[#111315]">{msg.subject}</div>
                      <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-line">
                        {msg.message}
                      </p>
                    </div>

                    {msg.coachReply && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3.5 space-y-1">
                        <div className="flex items-center justify-between gap-2 text-[11px] font-bold text-emerald-900">
                          <span>ردك المرسل لولي الأمر:</span>
                          {msg.repliedAt && (
                            <span className="font-mono font-normal">
                              {formatArabicDate(msg.repliedAt)} · {formatArabicTime(msg.repliedAt)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-emerald-950 leading-relaxed">{msg.coachReply}</p>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                      <input
                        type="text"
                        value={draft}
                        onChange={(e) =>
                          setReplyDrafts((prev) => ({ ...prev, [msg.id]: e.target.value }))
                        }
                        placeholder={
                          msg.coachReply
                            ? 'تعديل الرد أو إرسال رد جديد لولي الأمر...'
                            : 'اكتب ردك لولي الأمر هنا (سيصله إشعار فوري)...'
                        }
                        className="flex-1 px-3.5 py-2 text-xs bg-white border border-zinc-300 rounded-lg focus:outline-none focus:border-[#111315]"
                      />
                      <button
                        type="button"
                        disabled={isReplying || !draft.trim()}
                        onClick={() => handleSendReply(msg)}
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#111315] hover:bg-zinc-800 text-[#D4A843] rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{isReplying ? 'جاري الإرسال...' : 'إرسال الرد لولي الأمر'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 7: PUBLIC REGISTRATION REQUESTS */}
      {activeTab === 'requests' && (
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-zinc-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-[#111315]">
                طلبات التسجيل الواردة من المنصة ({registrationRequests.length})
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                راجع طلبات الالتحاق الجديدة واقبل اللاعب لإضافته مباشرة إلى قائمة الأكاديمية أو تواصل مع ولي الأمر عبر واتساب.
              </p>
            </div>
            <div className="inline-flex flex-wrap p-1 bg-zinc-100 rounded-lg border border-zinc-200">
              {(
                [
                  ['all', `الكل (${registrationRequests.length})`],
                  ['pending', `قيد المراجعة (${pendingRequestsCount})`],
                  ['contacted', 'تم التواصل'],
                  ['approved', 'مقبول'],
                  ['rejected', 'مؤجل / مرفوض'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setRequestFilter(key)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                    requestFilter === key
                      ? 'bg-white text-[#111315] shadow-sm'
                      : 'text-zinc-600 hover:text-[#111315]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {filteredRegistrationRequests.length === 0 ? (
            <div className="p-10 text-center text-sm text-zinc-500">
              لا توجد طلبات تسجيل في هذا القسم حالياً.
            </div>
          ) : (
            <div className="divide-y divide-zinc-200">
              {filteredRegistrationRequests.map((req) => {
                const isBusy = busyRequestId === req.id;
                const isDeleting = deletingRequestId === req.id;
                const noteVal = requestNoteDrafts[req.id] ?? req.coachNote;
                const statusBadge =
                  req.status === 'approved'
                    ? { label: 'تم القبول والإضافة', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' }
                    : req.status === 'contacted'
                      ? { label: 'تم التواصل', cls: 'bg-sky-50 text-sky-800 border-sky-200' }
                      : req.status === 'rejected'
                        ? { label: 'مؤجل / مرفوض', cls: 'bg-zinc-100 text-zinc-700 border-zinc-300' }
                        : { label: 'طلب جديد', cls: 'bg-amber-50 text-amber-900 border-amber-200' };

                const waInvite = buildParentWhatsAppHref(
                  req.parentPhone,
                  `السلام عليكم أستاذ ${req.parentName}، معكم كابتن باهر مراد من أكاديمية البوب للفنون القتالية بخصوص طلب تسجيل اللاعب (${req.athleteName}) في تدريب ${req.discipline}.`
                );

                return (
                  <div
                    key={req.id}
                    className={`p-5 space-y-4 ${
                      req.status === 'pending' ? 'bg-[#FFFDF5]' : 'bg-white'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-bold text-[#111315]">
                            {req.athleteName}
                          </span>
                          <span className="text-xs text-zinc-500 tabular-nums">
                            ({req.age} سنة)
                          </span>
                          <span className="px-2 py-0.5 text-[11px] font-semibold bg-zinc-100 text-[#111315] border border-zinc-200 rounded">
                            {req.discipline}
                          </span>
                          <span
                            className={`px-2 py-0.5 text-[11px] font-bold border rounded ${statusBadge.cls}`}
                          >
                            {statusBadge.label}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-600">
                          <span>
                            ولي الأمر: <strong className="text-[#111315]">{req.parentName}</strong>
                          </span>
                          <a
                            href={`tel:${req.parentPhone}`}
                            dir="ltr"
                            className="inline-flex items-center gap-1 font-mono text-[#111315] hover:text-[#B91C1C]"
                          >
                            <Phone className="w-3 h-3" />
                            <span>{req.parentPhone}</span>
                          </a>
                          <a
                            href={waInvite}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#15803D] hover:bg-[#166534] text-white font-semibold rounded-md transition-colors"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>واتساب ولي الأمر</span>
                          </a>
                          {req.createdAtIso && (
                            <span className="text-zinc-400">
                              {formatArabicDate(req.createdAtIso)} · {formatArabicTime(req.createdAtIso)}
                            </span>
                          )}
                        </div>

                        {req.notes && (
                          <div className="text-xs text-zinc-700 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2">
                            <span className="font-semibold text-zinc-500">ملاحظات ولي الأمر: </span>
                            {req.notes}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {req.status !== 'approved' && (
                          <>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleApproveRequest(req, false)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-[#15803D] hover:bg-[#166534] text-white rounded-lg transition-colors disabled:opacity-50"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{isBusy ? 'جاري التنفيذ...' : 'قبول وإضافة اللاعب'}</span>
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleApproveRequest(req, true)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-[#111315] hover:bg-zinc-800 text-[#D4A843] rounded-lg transition-colors disabled:opacity-50"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                              <span>قبول + إنشاء حساب دخول</span>
                            </button>
                          </>
                        )}
                        {req.status === 'pending' && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleUpdateRequestStatus(req, 'contacted')}
                            className="px-3 py-2 text-xs font-semibold border border-zinc-300 hover:border-[#111315] text-[#111315] rounded-lg disabled:opacity-50"
                          >
                            تم التواصل
                          </button>
                        )}
                        {req.status !== 'approved' && req.status !== 'rejected' && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleUpdateRequestStatus(req, 'rejected')}
                            className="px-3 py-2 text-xs font-semibold border border-zinc-300 hover:border-red-300 text-zinc-600 hover:text-[#B91C1C] rounded-lg disabled:opacity-50"
                          >
                            تأجيل / رفض
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={isDeleting}
                          onClick={() => handleDeleteRequest(req.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-semibold text-[#B91C1C] border border-red-200 hover:bg-red-50 rounded-lg disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>حذف</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <input
                        type="text"
                        value={noteVal}
                        onChange={(e) =>
                          setRequestNoteDrafts((prev) => ({ ...prev, [req.id]: e.target.value }))
                        }
                        placeholder="ملاحظة داخلية للمدرب على الطلب (مثال: تم الاتفاق على حضور أول حصة الإثنين الساعة 5)..."
                        className="flex-1 px-3.5 py-2 text-xs bg-white border border-zinc-300 rounded-lg focus:outline-none focus:border-[#111315]"
                      />
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleUpdateRequestStatus(req, req.status)}
                        className="px-4 py-2 text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 text-[#111315] border border-zinc-300 rounded-lg whitespace-nowrap disabled:opacity-50"
                      >
                        حفظ الملاحظة
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 8: PHOTO CATALOG (AUTO COACH UPLOAD + PARENT SUBMISSIONS APPROVAL) */}
      {activeTab === 'catalog' && (
        <div className="space-y-6">
          {/* Direct Automatic Coach Photo Upload Card */}
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 bg-[#111315] text-white flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <ImagePlus className="w-5 h-5 text-[#D4A843]" />
                <div>
                  <h2 className="text-sm font-bold">إضافة صور للكتالوج تلقائياً من التطبيق</h2>
                  <p className="text-[11px] text-zinc-400">
                    اختر صورة أو عدة صور من هاتفك أو جهازك ليتم ضغطها ونشرها مباشرة في كتالوج الصفحة الرئيسية
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-semibold text-[#D4A843]">نشر فوري وتلقائي</span>
            </div>

            <div className="p-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              <div className="md:col-span-3">
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  التصنيف في الكتالوج
                </label>
                <select
                  value={coachPhotoCategory}
                  onChange={(e) => setCoachPhotoCategory(e.target.value as CatalogCategory)}
                  className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-lg bg-white"
                >
                  {COACH_PHOTO_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-3">
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  عنوان الصورة (اختياري)
                </label>
                <input
                  type="text"
                  value={coachPhotoTitle}
                  onChange={(e) => setCoachPhotoTitle(e.target.value)}
                  placeholder="مثال: تتويج أبطال الجمعة"
                  className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-lg focus:outline-none focus:border-[#111315]"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  وصف مختصر (اختياري)
                </label>
                <input
                  type="text"
                  value={coachPhotoCaption}
                  onChange={(e) => setCoachPhotoCaption(e.target.value)}
                  placeholder="مثال: تدريب كيك بوكسينج بمقر ميت غمر"
                  className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-lg focus:outline-none focus:border-[#111315]"
                />
              </div>

              <div className="md:col-span-3">
                <label className="w-full cursor-pointer inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#B91C1C] hover:bg-[#991B1B] text-white text-xs font-bold rounded-lg transition-colors">
                  <Camera className="w-4 h-4" />
                  <span>
                    {coachPhotoUploading
                      ? 'جاري الضبط والنشر...'
                      : 'اختر صورة/صور للنشر التلقائي'}
                  </span>
                  <input
                    ref={coachPhotoInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={coachPhotoUploading}
                    onChange={handleCoachAutoUploadPhotos}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Pending & Published Dynamic Photos Review List */}
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <div className="p-5 border-b border-zinc-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-[#111315]">
                  صور الكتالوج ومشاركات أولياء الأمور ({catalogPhotos.length})
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  لا تظهر صور أولياء الأمور في الكتالوج العام إلا بعد ضغطك على «موافقة ونشر في الكتالوج».
                </p>
              </div>

              <div className="inline-flex flex-wrap p-1 bg-zinc-100 rounded-lg border border-zinc-200">
                {(
                  [
                    ['all', `الكل (${catalogPhotos.length})`],
                    ['pending', `بانتظار الموافقة (${pendingPhotosCount})`],
                    ['approved', 'منشورة بالكتالوج'],
                    ['rejected', 'مرفوضة'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCatalogFilter(key)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                      catalogFilter === key
                        ? 'bg-white text-[#111315] shadow-sm'
                        : 'text-zinc-600 hover:text-[#111315]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {filteredCatalogPhotos.length === 0 ? (
              <div className="p-10 text-center text-sm text-zinc-500">
                لا توجد صور مضافة أو مرسلة في هذا القسم حالياً.
              </div>
            ) : (
              <div className="divide-y divide-zinc-200">
                {filteredCatalogPhotos.map((photo) => {
                  const isBusy = busyPhotoId === photo.id;
                  const noteDraft = photoNoteDrafts[photo.id] ?? photo.coachNote;
                  const statusBadge =
                    photo.status === 'approved'
                      ? { label: 'منشورة بالكتالوج', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' }
                      : photo.status === 'rejected'
                        ? { label: 'مرفوضة', cls: 'bg-red-50 text-red-800 border-red-200' }
                        : { label: 'بانتظار موافقتك', cls: 'bg-amber-50 text-amber-900 border-amber-300' };

                  return (
                    <div
                      key={photo.id}
                      className={`p-5 flex flex-col lg:flex-row gap-4 items-start ${
                        photo.status === 'pending' ? 'bg-[#FFFDF5]' : 'bg-white'
                      }`}
                    >
                      <img
                        src={photo.imageUrl}
                        alt={photo.title}
                        className="w-full lg:w-44 h-36 object-cover rounded-lg border border-zinc-200 shrink-0 bg-zinc-900"
                      />

                      <div className="flex-1 min-w-0 space-y-2.5 w-full">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-[#111315]">
                              {photo.title}
                            </span>
                            <span className="px-2 py-0.5 text-[11px] font-semibold bg-zinc-100 text-zinc-700 border border-zinc-200 rounded">
                              {COACH_PHOTO_CATEGORIES.find((c) => c.value === photo.category)?.label || photo.category}
                            </span>
                            <span
                              className={`px-2 py-0.5 text-[11px] font-bold border rounded ${statusBadge.cls}`}
                            >
                              {statusBadge.label}
                            </span>
                          </div>

                          <span className="text-[11px] text-zinc-500">
                            {photo.submittedByRole === 'coach'
                              ? 'مضافة من المدرب'
                              : `مرسلة من ولي الأمر: ${photo.submittedByName}${photo.athleteName ? ` (${photo.athleteName})` : ''}`}
                          </span>
                        </div>

                        {photo.caption && (
                          <p className="text-xs text-zinc-600 leading-relaxed">{photo.caption}</p>
                        )}

                        {photo.submittedByRole === 'parent' && (
                          <input
                            type="text"
                            value={noteDraft}
                            onChange={(e) =>
                              setPhotoNoteDrafts((prev) => ({ ...prev, [photo.id]: e.target.value }))
                            }
                            placeholder="ملاحظة اختيارية لولي الأمر عند الموافقة أو الرفض..."
                            className="w-full px-3 py-1.5 text-xs bg-white border border-zinc-300 rounded-lg focus:outline-none focus:border-[#111315]"
                          />
                        )}

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {photo.status !== 'approved' && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleReviewCatalogPhoto(photo, 'approved')}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-[#15803D] hover:bg-[#166534] text-white rounded-lg disabled:opacity-50"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{isBusy ? 'جاري التنفيذ...' : 'موافقة ونشر في الكتالوج'}</span>
                            </button>
                          )}

                          {photo.status !== 'rejected' && photo.submittedByRole === 'parent' && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleReviewCatalogPhoto(photo, 'rejected')}
                              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border border-zinc-300 hover:border-red-300 text-zinc-700 hover:text-[#B91C1C] rounded-lg disabled:opacity-50"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>رفض / إخفاء</span>
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleDeleteCatalogPhoto(photo)}
                            className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-[#B91C1C] border border-red-200 hover:bg-red-50 rounded-lg disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>حذف نهائي</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Broadcast Group Notification */}
      {showBroadcastModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-white border border-zinc-200 rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-[#111315] text-white">
              <div className="flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-[#D4A843]" />
                <h3 className="text-base font-bold">إشعار جماعي لأولياء الأمور</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowBroadcastModal(false)}
                className="p-1 text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSendBroadcast} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  الفئة المستهدفة
                </label>
                <select
                  value={broadcastTarget}
                  onChange={(e) => setBroadcastTarget(e.target.value as 'all' | Discipline)}
                  className="w-full px-3.5 py-2.5 text-sm border border-zinc-300 rounded-lg focus:outline-none focus:border-[#111315]"
                >
                  <option value="all">جميع أولياء أمور الأكاديمية</option>
                  {DISCIPLINES.map((d) => (
                    <option key={d} value={d}>
                      أولياء أمور تدريب: {d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  عنوان الإشعار
                </label>
                <input
                  type="text"
                  required
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-zinc-300 rounded-lg focus:outline-none focus:border-[#111315]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  نص الإشعار الجماعي *
                </label>
                <textarea
                  rows={4}
                  required
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  placeholder="مثال: تنبيه هام: تمرين الغد الساعة 6 مساءً في موعده، يرجى الالتزام بالزي الرسمي."
                  className="w-full px-3.5 py-2.5 text-sm border border-zinc-300 rounded-lg focus:outline-none focus:border-[#111315]"
                />
              </div>
              <button
                type="submit"
                disabled={sendingBroadcast}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#B91C1C] hover:bg-[#991B1B] text-white text-sm font-semibold rounded-lg"
              >
                <Send className="w-4 h-4" />
                <span>{sendingBroadcast ? 'جاري الإرسال...' : 'إرسال الإشعار الجماعي الآن'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Add Athlete */}
      {showAddAthlete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg bg-white border border-zinc-200 rounded-xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 bg-[#111315] text-white">
              <h3 className="text-base font-bold">إضافة لاعب جديد</h3>
              <button
                type="button"
                onClick={() => setShowAddAthlete(false)}
                className="p-1 text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddAthlete} className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                    اسم اللاعب *
                  </label>
                  <input
                    type="text"
                    required
                    value={newAthName}
                    onChange={(e) => setNewAthName(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-zinc-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                    العمر *
                  </label>
                  <input
                    type="number"
                    min={4}
                    max={35}
                    required
                    value={newAthAge}
                    onChange={(e) => setNewAthAge(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm font-mono border border-zinc-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                    التدريب
                  </label>
                  <select
                    value={newAthDisc}
                    onChange={(e) => setNewAthDisc(e.target.value as Discipline)}
                    className="w-full px-3.5 py-2 text-sm border border-zinc-300 rounded-lg"
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
                    قيمة الاشتراك (ج.م)
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={newAthFee}
                    onChange={(e) => setNewAthFee(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm font-mono border border-zinc-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-zinc-200">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                    اسم ولي الأمر *
                  </label>
                  <input
                    type="text"
                    required
                    value={newParentName}
                    onChange={(e) => setNewParentName(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-zinc-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                    هاتف ولي الأمر *
                  </label>
                  <input
                    type="tel"
                    required
                    dir="ltr"
                    value={newParentPhone}
                    onChange={(e) => setNewParentPhone(e.target.value)}
                    placeholder="010xxxxxxxx"
                    className="w-full px-3.5 py-2 text-sm font-mono border border-zinc-300 rounded-lg text-right"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  بريد Google لولي الأمر (اختياري للربط التلقائي عند دخوله)
                </label>
                <input
                  type="email"
                  dir="ltr"
                  value={newParentEmail}
                  onChange={(e) => setNewParentEmail(e.target.value)}
                  placeholder="parent@gmail.com"
                  className="w-full px-3.5 py-2 text-sm font-mono border border-zinc-300 rounded-lg text-right"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  ملاحظات صحية
                </label>
                <input
                  type="text"
                  value={newAthNotes}
                  onChange={(e) => setNewAthNotes(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-zinc-300 rounded-lg"
                />
              </div>

              <button
                type="submit"
                disabled={savingAthlete}
                className="w-full py-2.5 bg-[#B91C1C] hover:bg-[#991B1B] text-white text-sm font-semibold rounded-lg"
              >
                {savingAthlete ? 'جاري الحفظ...' : 'حفظ بيانات اللاعب'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Edit Athlete */}
      {editingAthlete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-white border border-zinc-200 rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-[#111315] text-white">
              <h3 className="text-base font-bold">تعديل بيانات: {editingAthlete.fullName}</h3>
              <button
                type="button"
                onClick={() => setEditingAthlete(null)}
                className="p-1 text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveEditAthlete} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">التدريب</label>
                <select
                  value={editDisc}
                  onChange={(e) => setEditDisc(e.target.value as Discipline)}
                  className="w-full px-3.5 py-2 text-sm border border-zinc-300 rounded-lg"
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
                  الاشتراك الشهري (ج.م)
                </label>
                <input
                  type="number"
                  min={0}
                  value={editFee}
                  onChange={(e) => setEditFee(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm font-mono border border-zinc-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  ملاحظات صحية
                </label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-zinc-300 rounded-lg"
                />
              </div>
              <button
                type="submit"
                disabled={savingAthlete}
                className="w-full py-2.5 bg-[#111315] text-white text-sm font-semibold rounded-lg"
              >
                {savingAthlete ? 'جاري التحديث...' : 'حفظ التعديلات'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Record Payment */}
      {paymentAthlete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-white border border-zinc-200 rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-[#111315] text-white">
              <h3 className="text-base font-bold">تسجيل دفع اشتراك: {paymentAthlete.fullName}</h3>
              <button
                type="button"
                onClick={() => setPaymentAthlete(null)}
                className="p-1 text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleRecordPayment} className="p-6 space-y-4">
              <div className="text-xs text-zinc-600">
                الشهر المحدد: <span className="font-bold">{formatArabicMonth(selectedMonth)}</span>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  المبلغ المدفوع (ج.م) *
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm font-mono border border-zinc-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  طريقة الدفع
                </label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3.5 py-2 text-sm border border-zinc-300 rounded-lg"
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  ملاحظات (اختياري)
                </label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="مثال: اشتراك الشهر"
                  className="w-full px-3.5 py-2 text-sm border border-zinc-300 rounded-lg"
                />
              </div>
              <button
                type="submit"
                disabled={savingPayment}
                className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold rounded-lg"
              >
                {savingPayment ? 'جاري التسجيل...' : 'تأكيد السداد وإرسال إشعار لولي الأمر'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Individual Custom Notification */}
      {notifyAthlete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-white border border-zinc-200 rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-[#111315] text-white">
              <h3 className="text-base font-bold">
                إشعار لولي أمر: {notifyAthlete.parentName}
              </h3>
              <button
                type="button"
                onClick={() => setNotifyAthlete(null)}
                className="p-1 text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSendCustomNotification} className="p-6 space-y-4">
              <div className="text-xs text-zinc-600">
                اللاعب: <span className="font-bold text-[#111315]">{notifyAthlete.fullName}</span>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  عنوان الإشعار
                </label>
                <input
                  type="text"
                  required
                  value={notifyTitle}
                  onChange={(e) => setNotifyTitle(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-zinc-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  نص الرسالة *
                </label>
                <textarea
                  rows={3}
                  required
                  value={notifyBody}
                  onChange={(e) => setNotifyBody(e.target.value)}
                  placeholder="مثال: مستوى اللاعب ممتاز اليوم في تمرين الكيك بوكسينج."
                  className="w-full px-3.5 py-2 text-sm border border-zinc-300 rounded-lg"
                />
              </div>
              <button
                type="submit"
                disabled={sendingNotif}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#B91C1C] hover:bg-[#991B1B] text-white text-sm font-semibold rounded-lg"
              >
                <Send className="w-4 h-4" />
                <span>{sendingNotif ? 'جاري الإرسال...' : 'إرسال الإشعار الآن'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Confirm Delete Athlete */}
      {deletingAthlete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-white border border-zinc-200 rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-[#111315] text-white">
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-[#B91C1C]" />
                <h3 className="text-base font-bold">تأكيد حذف اللاعب من الموقع</h3>
              </div>
              <button
                type="button"
                onClick={() => setDeletingAthlete(null)}
                className="p-1 text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-zinc-700 leading-relaxed">
                هل أنت متأكد من حذف اللاعب{' '}
                <strong className="text-[#111315]">{deletingAthlete.fullName}</strong> نهائياً من الموقع؟
                سيتم أيضاً حذف سجلات الحضور والاشتراكات والإشعارات الخاصة به.
              </p>
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  disabled={deletingBusy}
                  onClick={handleConfirmDeleteAthlete}
                  className="flex-1 py-2.5 bg-[#B91C1C] hover:bg-[#991B1B] text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  {deletingBusy ? 'جاري الحذف...' : 'نعم، حذف نهائي'}
                </button>
                <button
                  type="button"
                  disabled={deletingBusy}
                  onClick={() => setDeletingAthlete(null)}
                  className="flex-1 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-[#111315] text-sm font-semibold rounded-lg transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Create Parent Account (Username & Password) */}
      {showCreateParentModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg bg-white border border-zinc-200 rounded-xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 bg-[#111315] text-white">
              <div className="flex items-center gap-2.5">
                <UserPlus className="w-5 h-5 text-[#D4A843]" />
                <h3 className="text-base font-bold">
                  {createdParentResult
                    ? 'تم إنشاء حساب ولي الأمر بنجاح'
                    : 'إنشاء حساب ولي أمر (يوزر وباسورد)'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateParentModal(false)}
                className="p-1 text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createdParentResult ? (
              (() => {
                const { loginUrl, whatsappHref } = getParentInviteDetails();
                return (
                  <div className="p-6 space-y-5 overflow-y-auto">
                    <div className="px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm rounded-lg leading-relaxed">
                      تم تفعيل حساب{' '}
                      <strong>{createdParentResult.info.parentName}</strong> وربطه باللاعب:{' '}
                      <strong>
                        {createdParentResult.info.linkedAthleteNames.join(' و ')}
                      </strong>
                      .
                    </div>

                    <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 space-y-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold text-zinc-500">اسم المستخدم:</span>
                        <span className="font-mono font-bold text-[#111315]" dir="ltr">
                          {createdParentResult.info.username}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3 pt-2 border-t border-zinc-200">
                        <span className="text-xs font-semibold text-zinc-500">كلمة المرور:</span>
                        <span className="font-mono font-bold text-[#B91C1C]" dir="ltr">
                          {createdParentResult.password}
                        </span>
                      </div>
                      <div className="pt-2 border-t border-zinc-200 space-y-1">
                        <div className="text-xs font-semibold text-zinc-500">
                          رابط الدخول المباشر (يملأ اسم المستخدم تلقائياً):
                        </div>
                        <div
                          className="font-mono text-[11px] text-zinc-700 break-all bg-white border border-zinc-200 rounded-lg p-2"
                          dir="ltr"
                        >
                          {loginUrl}
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-zinc-600 leading-relaxed">
                      يمكن لولي الأمر الدخول بهذه البيانات من أكثر من هاتف (الأب والأم مثلاً)، وسيبقى الحساب مسجلاً تلقائياً على كل جهاز.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={handleCopyCredentials}
                        className="flex items-center justify-center gap-2 py-2.5 px-4 bg-[#111315] hover:bg-zinc-800 text-white text-xs font-semibold rounded-lg transition-colors"
                      >
                        {copiedCredentials ? (
                          <>
                            <Check className="w-4 h-4 text-emerald-400" />
                            <span>تم نسخ رسالة الدخول</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4 text-[#D4A843]" />
                            <span>نسخ رسالة الدخول والرابط</span>
                          </>
                        )}
                      </button>

                      <a
                        href={whatsappHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>إرسال البيانات عبر واتساب</span>
                      </a>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-2 border-t border-zinc-200">
                      <button
                        type="button"
                        onClick={() => openCreateParentModal()}
                        className="text-xs font-semibold text-[#111315] hover:text-[#B91C1C]"
                      >
                        إنشاء حساب ولي أمر آخر
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowCreateParentModal(false)}
                        className="px-4 py-2 text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 text-[#111315] rounded-lg"
                      >
                        إغلاق
                      </button>
                    </div>
                  </div>
                );
              })()
            ) : (
              <form onSubmit={handleCreateParentAccount} className="p-6 pb-8 space-y-4 overflow-y-auto">
                {parentAcctError && (
                  <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-900 text-xs rounded-lg leading-relaxed space-y-2.5">
                    <div>{parentAcctError}</div>
                    {parentAcctError.includes('Email/Password') && (
                      <div className="pt-2 border-t border-red-200 space-y-2">
                        <div className="font-semibold text-[#111315]">
                          خطوة التفعيل (مرة واحدة فقط — 15 ثانية):
                        </div>
                        <ol className="list-decimal pr-4 space-y-1 text-zinc-700">
                          <li>اضغط الزر بالأسفل لفتح إعدادات طرق الدخول في Firebase.</li>
                          <li>اضغط «Add new provider» ثم اختر «Email/Password».</li>
                          <li>فعّل الخيار الأول «Enable» ثم اضغط «Save» وارجع هنا واضغط إنشاء.</li>
                        </ol>
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <a
                            href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/providers`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#111315] hover:bg-zinc-800 text-[#D4A843] font-semibold rounded-md transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>فتح إعدادات Firebase للتفعيل</span>
                          </a>
                          {parentAccountMode === 'new_athlete' && acctChildName.trim().length >= 2 && (
                            <button
                              type="button"
                              disabled={creatingParentAcct}
                              onClick={handleSaveAthleteWithoutPassword}
                              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-zinc-300 hover:border-[#111315] text-[#111315] font-semibold rounded-md transition-colors"
                            >
                              <span>حفظ اللاعب الآن مؤقتاً بدون حساب</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-1 p-1 bg-zinc-100 rounded-lg border border-zinc-200">
                  <button
                    type="button"
                    disabled={athletes.length === 0}
                    onClick={() => setParentAccountMode('existing_athlete')}
                    className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors disabled:opacity-40 ${
                      parentAccountMode === 'existing_athlete'
                        ? 'bg-white text-[#111315] shadow-sm'
                        : 'text-zinc-600'
                    }`}
                  >
                    ربط بلاعب مسجل حالياً
                  </button>
                  <button
                    type="button"
                    onClick={() => setParentAccountMode('new_athlete')}
                    className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors ${
                      parentAccountMode === 'new_athlete'
                        ? 'bg-white text-[#111315] shadow-sm'
                        : 'text-zinc-600'
                    }`}
                  >
                    حساب + إضافة لاعب جديد
                  </button>
                </div>

                {parentAccountMode === 'existing_athlete' && athletes.length > 0 && (
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-zinc-700">
                      اختر اللاعب المراد إنشاء حساب لولي أمره *
                    </label>
                    <select
                      value={parentTargetAthleteId}
                      onChange={(e) => handleSelectTargetAthlete(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm border border-zinc-300 rounded-lg bg-white"
                    >
                      {athletes.map((ath) => (
                        <option key={ath.id} value={ath.id}>
                          {ath.fullName} — ولي الأمر: {ath.parentName} (
                          {ath.parentUid ? 'لديه حساب' : 'بدون حساب'})
                        </option>
                      ))}
                    </select>
                    <label className="flex items-center gap-2 text-xs text-zinc-600 pt-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={linkSamePhoneAthletes}
                        onChange={(e) => setLinkSamePhoneAthletes(e.target.checked)}
                        className="w-4 h-4 accent-[#111315] rounded"
                      />
                      <span>ربط أي أبناء آخرين بنفس رقم الهاتف بهذا الحساب تلقائياً</span>
                    </label>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-zinc-200">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                      اسم ولي الأمر *
                    </label>
                    <input
                      type="text"
                      required
                      value={acctParentName}
                      onChange={(e) => setAcctParentName(e.target.value)}
                      placeholder="مثال: محمد حسن"
                      className="w-full px-3.5 py-2 text-sm border border-zinc-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                      رقم الموبايل *
                    </label>
                    <input
                      type="tel"
                      required
                      dir="ltr"
                      value={acctParentPhone}
                      onChange={(e) => {
                        setAcctParentPhone(e.target.value);
                        if (!acctUsername) {
                          setAcctUsername(suggestUsernameFromPhone(e.target.value));
                        }
                      }}
                      placeholder="010xxxxxxxx"
                      className="w-full px-3.5 py-2 text-sm font-mono border border-zinc-300 rounded-lg text-right"
                    />
                  </div>
                </div>

                {parentAccountMode === 'new_athlete' && (
                  <div className="space-y-3 pt-2 border-t border-zinc-200">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                          اسم اللاعب الجديد *
                        </label>
                        <input
                          type="text"
                          required
                          value={acctChildName}
                          onChange={(e) => setAcctChildName(e.target.value)}
                          className="w-full px-3.5 py-2 text-sm border border-zinc-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                          العمر *
                        </label>
                        <input
                          type="number"
                          min={4}
                          max={35}
                          required
                          value={acctChildAge}
                          onChange={(e) => setAcctChildAge(e.target.value)}
                          className="w-full px-3.5 py-2 text-sm font-mono border border-zinc-300 rounded-lg"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                          التدريب
                        </label>
                        <select
                          value={acctDiscipline}
                          onChange={(e) => setAcctDiscipline(e.target.value as Discipline)}
                          className="w-full px-3.5 py-2 text-sm border border-zinc-300 rounded-lg"
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
                          قيمة الاشتراك (ج.م)
                        </label>
                        <input
                          type="number"
                          min={0}
                          required
                          value={acctFee}
                          onChange={(e) => setAcctFee(e.target.value)}
                          className="w-full px-3.5 py-2 text-sm font-mono border border-zinc-300 rounded-lg"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                        ملاحظات صحية (اختياري)
                      </label>
                      <input
                        type="text"
                        value={acctNotes}
                        onChange={(e) => setAcctNotes(e.target.value)}
                        className="w-full px-3.5 py-2 text-sm border border-zinc-300 rounded-lg"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-zinc-200">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                      اسم المستخدم (اليوزر) *
                    </label>
                    <input
                      type="text"
                      required
                      dir="ltr"
                      value={acctUsername}
                      onChange={(e) => setAcctUsername(e.target.value)}
                      placeholder="01012345678"
                      className="w-full px-3.5 py-2 text-sm font-mono border border-zinc-300 rounded-lg text-right"
                    />
                    <div className="text-[11px] text-zinc-500 mt-1">
                      أرقام أو حروف إنجليزية بدون مسافات
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-zinc-700">
                        كلمة المرور *
                      </label>
                      <button
                        type="button"
                        onClick={() => setAcctPassword(generateEasyPassword())}
                        className="text-[11px] font-semibold text-[#B91C1C] hover:underline"
                      >
                        توليد تلقائي
                      </button>
                    </div>
                    <input
                      type="text"
                      required
                      minLength={6}
                      dir="ltr"
                      value={acctPassword}
                      onChange={(e) => setAcctPassword(e.target.value)}
                      placeholder="6 أحرف أو أرقام على الأقل"
                      className="w-full px-3.5 py-2 text-sm font-mono border border-zinc-300 rounded-lg text-right"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={creatingParentAcct}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#B91C1C] hover:bg-[#991B1B] text-white text-sm font-semibold rounded-lg disabled:opacity-60"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>
                    {creatingParentAcct
                      ? 'جاري إنشاء الحساب وربط السجلات...'
                      : 'إنشاء الحساب وتجهيز رسالة الإرسال'}
                  </span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Declare Holiday & Notify All Parents */}
      {showHolidayModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-white border border-zinc-200 rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-[#111315] text-white">
              <div className="flex items-center gap-2">
                <CalendarOff className="w-5 h-5 text-[#D4A843]" />
                <h3 className="text-base font-bold">إعلان إجازة وإبلاغ أولياء الأمور</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHolidayModal(false)}
                className="p-1 text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleConfirmDeclareHoliday} className="p-6 space-y-4">
              <p className="text-xs text-zinc-600 leading-relaxed">
                عند التأكيد سيتم إيقاف التذكير التلقائي للتمرين في هذا اليوم وإرسال إشعار فوري
                لجميع أولياء الأمور بأن اليوم إجازة ولا يوجد تمرين.
              </p>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  تاريخ الإجازة *
                </label>
                <input
                  type="date"
                  required
                  value={holidayDate}
                  onChange={(e) => setHolidayDate(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm font-mono border border-zinc-300 rounded-lg focus:outline-none focus:border-[#111315]"
                />
                <div className="text-[11px] text-zinc-500 mt-1">
                  اليوم المختار: {getArabicWeekdayName(holidayDate)}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  سبب الإجازة (اختياري)
                </label>
                <input
                  type="text"
                  value={holidayReason}
                  onChange={(e) => setHolidayReason(e.target.value)}
                  placeholder="مثال: إجازة رسمية / راحة للفريق / ظرف طارئ"
                  maxLength={200}
                  className="w-full px-3.5 py-2 text-sm border border-zinc-300 rounded-lg focus:outline-none focus:border-[#111315]"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={savingHoliday}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-[#B91C1C] hover:bg-[#991B1B] text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
                >
                  <Send className="w-4 h-4" />
                  <span>{savingHoliday ? 'جاري الإبلاغ...' : 'تأكيد الإجازة وإرسال الإشعار'}</span>
                </button>
                <button
                  type="button"
                  disabled={savingHoliday}
                  onClick={() => setShowHolidayModal(false)}
                  className="px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-[#111315] text-sm font-semibold rounded-lg"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
