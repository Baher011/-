import { deleteApp, initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  inMemoryPersistence,
  initializeAuth,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentReference,
  type Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  COACH_ADMIN_EMAIL,
  COACH_DEFAULT_NAME,
  COACH_DEFAULT_PHONE,
  OperationType,
  auth,
  db,
  googleProvider,
  handleFirestoreError,
} from './firebase';
import {
  dispatchCoachBackgroundPush,
  dispatchParentsBackgroundPush,
  notifyServerHolidayChange,
} from './fcm';
import {
  DEFAULT_MONTHLY_FEE,
  formatArabicTime,
  generateAthleteCode,
  getArabicWeekdayName,
} from './format';
import type {
  AcademyHoliday,
  AcademyNotification,
  Athlete,
  AttendanceRecord,
  AttendanceStatus,
  CatalogCategory,
  CatalogPhotoItem,
  CatalogPhotoStatus,
  Discipline,
  MonthlyAthleteSummary,
  MonthlyReportResponse,
  NotificationType,
  ParentMessage,
  PaymentMethod,
  PaymentRecord,
  PushSubscriptionDoc,
  RegistrationRequest,
  RegistrationRequestStatus,
  UserProfile,
} from '../types';

export const UNIFIED_TRAINING_SCHEDULE = 'الإثنين والأربعاء والجمعة · 5:00 م';

export const SCHEDULE_MAP: Record<Discipline, string> = {
  'كيك بوكسينج': UNIFIED_TRAINING_SCHEDULE,
  'كونغ فو': UNIFIED_TRAINING_SCHEDULE,
  MMA: UNIFIED_TRAINING_SCHEDULE,
};

function sanitizePhone(raw: string): string {
  const converted = raw
    .trim()
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[^0-9+\-\s]/g, '');
  return converted.slice(0, 20);
}

function makeId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return `${prefix}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
}

function timestampToIso(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string') {
    return val;
  }
  return new Date().toISOString();
}

export const PARENT_SYNTHETIC_DOMAIN = '@alboob.app';

export function convertArabicDigits(raw: string): string {
  return raw.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

export function normalizeParentLoginEmail(usernameOrEmail: string): {
  loginEmail: string;
  username: string;
} {
  const cleaned = convertArabicDigits(usernameOrEmail)
    .trim()
    .replace(/\s+/g, '')
    .toLowerCase();

  if (cleaned.length < 3) {
    throw new Error('يرجى إدخال اسم مستخدم صحيح (3 أحرف أو أرقام على الأقل)');
  }

  if (cleaned.includes('@')) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned) || cleaned.length > 160) {
      throw new Error('صيغة البريد الإلكتروني غير صحيحة');
    }
    const username = cleaned.endsWith(PARENT_SYNTHETIC_DOMAIN)
      ? cleaned.slice(0, -PARENT_SYNTHETIC_DOMAIN.length)
      : cleaned;
    return { loginEmail: cleaned, username };
  }

  if (!/^[a-z0-9._-]{3,64}$/.test(cleaned)) {
    throw new Error(
      'اسم المستخدم يجب أن يحتوي على حروف إنجليزية أو أرقام فقط بدون مسافات (مثال: 01012345678 أو ahmed2026)'
    );
  }

  return {
    loginEmail: `${cleaned}${PARENT_SYNTHETIC_DOMAIN}`,
    username: cleaned,
  };
}

export function formatParentIdentifier(email: string): string {
  const lower = (email || '').trim().toLowerCase();
  if (lower.endsWith(PARENT_SYNTHETIC_DOMAIN)) {
    return lower.slice(0, -PARENT_SYNTHETIC_DOMAIN.length);
  }
  return email;
}

function mapAuthErrorToArabic(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code || '')
      : '';
  const msg = err instanceof Error ? err.message : '';
  const combined = `${code} ${msg}`.toLowerCase();

  if (
    combined.includes('operation-not-allowed') ||
    combined.includes('password_login_disabled') ||
    combined.includes('admin-restricted-operation')
  ) {
    return 'الدخول باسم المستخدم وكلمة المرور غير مفعل بعد في Firebase. يرجى تفعيل مزود Email/Password من Firebase Console ثم المحاولة مرة أخرى.';
  }
  if (combined.includes('email-already-in-use')) {
    return 'اسم المستخدم هذا مسجل بالفعل لحساب آخر. اختر اسم مستخدم مختلف (مثال: إضافة رقم بجانب الاسم).';
  }
  if (combined.includes('weak-password')) {
    return 'كلمة المرور ضعيفة، يجب أن تكون 6 أحرف أو أرقام على الأقل.';
  }
  if (
    combined.includes('invalid-credential') ||
    combined.includes('wrong-password') ||
    combined.includes('user-not-found')
  ) {
    return 'اسم المستخدم أو كلمة المرور غير صحيحة. تأكد من البيانات المرسلة من كابتن باهر مراد.';
  }
  if (combined.includes('too-many-requests')) {
    return 'تم حظر المحاولة مؤقتاً لكثرة المحاولات الخاطئة. انتظر بضع دقائق وحاول مرة أخرى.';
  }
  if (combined.includes('network-request-failed')) {
    return 'تعذر الاتصال بالشبكة. تأكد من اتصال الإنترنت وحاول مرة أخرى.';
  }
  return msg || 'حدث خطأ أثناء عملية الدخول. يرجى المحاولة مرة أخرى.';
}

export async function signInWithGoogle(): Promise<FirebaseUser> {
  await setPersistence(auth, browserLocalPersistence);
  const cred = await signInWithPopup(auth, googleProvider);
  return cred.user;
}

export async function signInParentWithCredentials(
  usernameOrEmail: string,
  password: string
): Promise<FirebaseUser> {
  const { loginEmail } = normalizeParentLoginEmail(usernameOrEmail);
  const cleanPassword = convertArabicDigits(password).trim();
  if (cleanPassword.length < 6) {
    throw new Error('كلمة المرور يجب أن تكون 6 أحرف أو أرقام على الأقل');
  }

  try {
    await setPersistence(auth, browserLocalPersistence);
    const cred = await signInWithEmailAndPassword(auth, loginEmail, cleanPassword);
    return cred.user;
  } catch (err) {
    throw new Error(mapAuthErrorToArabic(err));
  }
}

export async function signOutAccount(): Promise<void> {
  await signOut(auth);
}

export function isCoachUser(fbUser: FirebaseUser | null): boolean {
  return (
    !!fbUser &&
    fbUser.emailVerified &&
    (fbUser.email || '').toLowerCase() === COACH_ADMIN_EMAIL.toLowerCase()
  );
}

export async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    return snap.data() as UserProfile;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function ensureCoachProfile(fbUser: FirebaseUser): Promise<UserProfile> {
  const path = `users/${fbUser.uid}`;
  try {
    const existing = await fetchUserProfile(fbUser.uid);
    if (existing && existing.role === 'coach') {
      return existing;
    }
    const profile: UserProfile = {
      uid: fbUser.uid,
      fullName: COACH_DEFAULT_NAME,
      phone: COACH_DEFAULT_PHONE,
      email: (fbUser.email || COACH_ADMIN_EMAIL).slice(0, 160),
      role: 'coach',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'users', fbUser.uid), profile);
    return {
      ...profile,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function registerParentWithChild(
  fbUser: FirebaseUser,
  payload: {
    parentName: string;
    phone: string;
    childName: string;
    childAge: number;
    discipline: Discipline;
    medicalNotes: string;
  }
): Promise<UserProfile> {
  const cleanParentName = payload.parentName.trim().slice(0, 100);
  const cleanPhone = sanitizePhone(payload.phone);
  const cleanChildName = payload.childName.trim().slice(0, 100);
  const ageNum = Math.min(35, Math.max(4, Math.round(Number(payload.childAge) || 8)));
  const email = (fbUser.email || '').trim().slice(0, 160);

  if (cleanParentName.length < 2) {
    throw new Error('يرجى إدخال اسم ولي الأمر بالكامل');
  }
  if (cleanPhone.length < 8) {
    throw new Error('يرجى إدخال رقم هاتف صحيح (8 أرقام على الأقل)');
  }
  if (cleanChildName.length < 2) {
    throw new Error('يرجى إدخال اسم الابن / اللاعب');
  }

  const athleteId = makeId('ath');
  const batch = writeBatch(db);

  const userProfile: UserProfile = {
    uid: fbUser.uid,
    fullName: cleanParentName,
    phone: cleanPhone,
    email,
    role: 'parent',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const athleteDoc: Athlete = {
    id: athleteId,
    athleteCode: generateAthleteCode(),
    parentUid: fbUser.uid,
    parentEmail: email,
    parentName: cleanParentName,
    parentPhone: cleanPhone,
    fullName: cleanChildName,
    age: ageNum,
    discipline: payload.discipline,
    groupSchedule: SCHEDULE_MAP[payload.discipline],
    monthlyFee: DEFAULT_MONTHLY_FEE,
    medicalNotes: (payload.medicalNotes.trim() || 'لا توجد ملاحظات صحية').slice(0, 300),
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  batch.set(doc(db, 'users', fbUser.uid), userProfile);
  batch.set(doc(db, 'athletes', athleteId), athleteDoc);

  try {
    await batch.commit();
    // Claim any athletes previously added by coach matching parentEmail
    if (email) {
      const preAddedSnap = await getDocs(
        query(collection(db, 'athletes'), where('parentEmail', '==', email))
      );
      for (const d of preAddedSnap.docs) {
        const ath = d.data() as Athlete;
        if (!ath.parentUid) {
          await updateDoc(doc(db, 'athletes', d.id), {
            parentUid: fbUser.uid,
            updatedAt: serverTimestamp(),
          });
        }
      }
    }
    return userProfile;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${fbUser.uid}`);
  }
}

export async function addParentChild(
  profile: UserProfile,
  payload: {
    fullName: string;
    age: number;
    discipline: Discipline;
    medicalNotes: string;
  }
): Promise<Athlete> {
  const cleanName = payload.fullName.trim().slice(0, 100);
  const ageNum = Math.min(35, Math.max(4, Math.round(Number(payload.age) || 8)));
  if (cleanName.length < 2) {
    throw new Error('يرجى إدخال اسم اللاعب');
  }

  const athleteId = makeId('ath');
  const athleteDoc: Athlete = {
    id: athleteId,
    athleteCode: generateAthleteCode(),
    parentUid: profile.uid,
    parentEmail: profile.email.slice(0, 160),
    parentName: profile.fullName.slice(0, 100),
    parentPhone: profile.phone.slice(0, 20),
    fullName: cleanName,
    age: ageNum,
    discipline: payload.discipline,
    groupSchedule: SCHEDULE_MAP[payload.discipline],
    monthlyFee: DEFAULT_MONTHLY_FEE,
    medicalNotes: (payload.medicalNotes.trim() || 'لا توجد ملاحظات صحية').slice(0, 300),
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'athletes', athleteId), athleteDoc);
    return athleteDoc;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `athletes/${athleteId}`);
  }
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), { read: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `notifications/${notificationId}`);
  }
}

export async function markAllNotificationsRead(notifications: AcademyNotification[]): Promise<void> {
  const unread = notifications.filter((n) => !n.read);
  if (unread.length === 0) return;
  const batch = writeBatch(db);
  for (const n of unread) {
    batch.update(doc(db, 'notifications', n.id), { read: true });
  }
  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, 'notifications');
  }
}

export function subscribeParentPortal(
  uid: string,
  email: string,
  emailVerified: boolean,
  onChange: (state: {
    children: Athlete[];
    attendance: AttendanceRecord[];
    payments: PaymentRecord[];
    notifications: AcademyNotification[];
    messages: ParentMessage[];
    holidays: AcademyHoliday[];
    catalogPhotos: CatalogPhotoItem[];
  }) => void
): Unsubscribe {
  let childrenByUid: Athlete[] = [];
  let childrenByEmail: Athlete[] = [];
  let attendanceByUid: AttendanceRecord[] = [];
  let attendanceByEmail: AttendanceRecord[] = [];
  let paymentsByUid: PaymentRecord[] = [];
  let paymentsByEmail: PaymentRecord[] = [];
  let notifsByUid: AcademyNotification[] = [];
  let notifsByEmail: AcademyNotification[] = [];
  let messagesByUid: ParentMessage[] = [];
  let holidays: AcademyHoliday[] = [];
  let catalogPhotosByUid: CatalogPhotoItem[] = [];

  const emit = () => {
    const mergeById = <T extends { id: string }>(a: T[], b: T[]): T[] => {
      const map = new Map<string, T>();
      for (const item of a) map.set(item.id, item);
      for (const item of b) map.set(item.id, item);
      return Array.from(map.values());
    };

    const children = mergeById(childrenByUid, childrenByEmail);
    const attendance = mergeById(attendanceByUid, attendanceByEmail).sort((a, b) =>
      b.date.localeCompare(a.date)
    );
    const payments = mergeById(paymentsByUid, paymentsByEmail).sort((a, b) =>
      b.paidAt.localeCompare(a.paidAt)
    );
    const notifications = mergeById(notifsByUid, notifsByEmail)
      .map((n) => ({
        ...n,
        createdAtIso: timestampToIso(n.createdAt),
      }))
      .sort((a, b) => (b.createdAtIso || '').localeCompare(a.createdAtIso || ''));
    const messages = messagesByUid
      .map((m) => ({
        ...m,
        createdAtIso: timestampToIso(m.createdAt),
      }))
      .sort((a, b) => (b.createdAtIso || '').localeCompare(a.createdAtIso || ''));
    const catalogPhotos = catalogPhotosByUid
      .map((p) => ({
        ...p,
        createdAtIso: timestampToIso(p.createdAt),
      }))
      .sort((a, b) => (b.createdAtIso || '').localeCompare(a.createdAtIso || ''));

    onChange({ children, attendance, payments, notifications, messages, holidays, catalogPhotos });
  };

  const unsubs: Unsubscribe[] = [];

  unsubs.push(
    onSnapshot(
      collection(db, 'academyHolidays'),
      (snap) => {
        holidays = snap.docs.map((d) => d.data() as AcademyHoliday);
        emit();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'academyHolidays')
    )
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'athletes'), where('parentUid', '==', uid)),
      (snap) => {
        childrenByUid = snap.docs.map((d) => d.data() as Athlete);
        emit();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'athletes')
    )
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'attendance'), where('parentUid', '==', uid)),
      (snap) => {
        attendanceByUid = snap.docs.map((d) => d.data() as AttendanceRecord);
        emit();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'attendance')
    )
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'payments'), where('parentUid', '==', uid)),
      (snap) => {
        paymentsByUid = snap.docs.map((d) => d.data() as PaymentRecord);
        emit();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'payments')
    )
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'notifications'), where('parentUid', '==', uid)),
      (snap) => {
        notifsByUid = snap.docs.map((d) => d.data() as AcademyNotification);
        emit();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'notifications')
    )
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'parentMessages'), where('parentUid', '==', uid)),
      (snap) => {
        messagesByUid = snap.docs.map((d) => d.data() as ParentMessage);
        emit();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'parentMessages')
    )
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'catalogPhotos'), where('submittedByUid', '==', uid)),
      (snap) => {
        catalogPhotosByUid = snap.docs.map((d) => d.data() as CatalogPhotoItem);
        emit();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'catalogPhotos')
    )
  );

  if (emailVerified && email) {
    unsubs.push(
      onSnapshot(
        query(collection(db, 'athletes'), where('parentEmail', '==', email)),
        (snap) => {
          childrenByEmail = snap.docs.map((d) => d.data() as Athlete);
          emit();
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'athletes')
      )
    );
    unsubs.push(
      onSnapshot(
        query(collection(db, 'attendance'), where('parentEmail', '==', email)),
        (snap) => {
          attendanceByEmail = snap.docs.map((d) => d.data() as AttendanceRecord);
          emit();
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'attendance')
      )
    );
    unsubs.push(
      onSnapshot(
        query(collection(db, 'payments'), where('parentEmail', '==', email)),
        (snap) => {
          paymentsByEmail = snap.docs.map((d) => d.data() as PaymentRecord);
          emit();
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'payments')
      )
    );
    unsubs.push(
      onSnapshot(
        query(collection(db, 'notifications'), where('parentEmail', '==', email)),
        (snap) => {
          notifsByEmail = snap.docs.map((d) => d.data() as AcademyNotification);
          emit();
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'notifications')
      )
    );
  }

  return () => {
    for (const u of unsubs) u();
  };
}

export function subscribeCoachPortal(
  onChange: (state: {
    athletes: Athlete[];
    attendance: AttendanceRecord[];
    payments: PaymentRecord[];
    notifications: AcademyNotification[];
    parents: UserProfile[];
    parentMessages: ParentMessage[];
    registrationRequests: RegistrationRequest[];
    pushSubscriptions: PushSubscriptionDoc[];
    holidays: AcademyHoliday[];
    catalogPhotos: CatalogPhotoItem[];
  }) => void
): Unsubscribe {
  let athletes: Athlete[] = [];
  let attendance: AttendanceRecord[] = [];
  let payments: PaymentRecord[] = [];
  let notifications: AcademyNotification[] = [];
  let parents: UserProfile[] = [];
  let parentMessages: ParentMessage[] = [];
  let registrationRequests: RegistrationRequest[] = [];
  let pushSubscriptions: PushSubscriptionDoc[] = [];
  let holidays: AcademyHoliday[] = [];
  let catalogPhotos: CatalogPhotoItem[] = [];

  const emit = () => {
    onChange({
      athletes: [...athletes].sort((a, b) => a.fullName.localeCompare(b.fullName, 'ar')),
      attendance,
      payments: [...payments].sort((a, b) => b.paidAt.localeCompare(a.paidAt)),
      notifications: notifications
        .map((n) => ({ ...n, createdAtIso: timestampToIso(n.createdAt) }))
        .sort((a, b) => (b.createdAtIso || '').localeCompare(a.createdAtIso || '')),
      parents: parents
        .filter((u) => u.role === 'parent')
        .map((u) => ({ ...u, createdAtIso: timestampToIso(u.createdAt) }))
        .sort((a, b) => (b.createdAtIso || '').localeCompare(a.createdAtIso || '')),
      parentMessages: parentMessages
        .map((m) => ({ ...m, createdAtIso: timestampToIso(m.createdAt) }))
        .sort((a, b) => (b.createdAtIso || '').localeCompare(a.createdAtIso || '')),
      registrationRequests: registrationRequests
        .map((r) => ({ ...r, createdAtIso: timestampToIso(r.createdAt) }))
        .sort((a, b) => (b.createdAtIso || '').localeCompare(a.createdAtIso || '')),
      pushSubscriptions,
      holidays: [...holidays].sort((a, b) => b.date.localeCompare(a.date)),
      catalogPhotos: catalogPhotos
        .map((p) => ({ ...p, createdAtIso: timestampToIso(p.createdAt) }))
        .sort((a, b) => (b.createdAtIso || '').localeCompare(a.createdAtIso || '')),
    });
  };

  const unsubs: Unsubscribe[] = [
    onSnapshot(
      collection(db, 'athletes'),
      (snap) => {
        athletes = snap.docs.map((d) => d.data() as Athlete);
        emit();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'athletes')
    ),
    onSnapshot(
      collection(db, 'attendance'),
      (snap) => {
        attendance = snap.docs.map((d) => d.data() as AttendanceRecord);
        emit();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'attendance')
    ),
    onSnapshot(
      collection(db, 'payments'),
      (snap) => {
        payments = snap.docs.map((d) => d.data() as PaymentRecord);
        emit();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'payments')
    ),
    onSnapshot(
      collection(db, 'notifications'),
      (snap) => {
        notifications = snap.docs.map((d) => d.data() as AcademyNotification);
        emit();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'notifications')
    ),
    onSnapshot(
      collection(db, 'users'),
      (snap) => {
        parents = snap.docs.map((d) => d.data() as UserProfile);
        emit();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'users')
    ),
    onSnapshot(
      collection(db, 'parentMessages'),
      (snap) => {
        parentMessages = snap.docs.map((d) => d.data() as ParentMessage);
        emit();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'parentMessages')
    ),
    onSnapshot(
      collection(db, 'registrationRequests'),
      (snap) => {
        registrationRequests = snap.docs.map((d) => d.data() as RegistrationRequest);
        emit();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'registrationRequests')
    ),
    onSnapshot(
      collection(db, 'pushSubscriptions'),
      (snap) => {
        pushSubscriptions = snap.docs.map((d) => d.data() as PushSubscriptionDoc);
        emit();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'pushSubscriptions')
    ),
    onSnapshot(
      collection(db, 'academyHolidays'),
      (snap) => {
        holidays = snap.docs.map((d) => d.data() as AcademyHoliday);
        emit();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'academyHolidays')
    ),
    onSnapshot(
      collection(db, 'catalogPhotos'),
      (snap) => {
        catalogPhotos = snap.docs.map((d) => d.data() as CatalogPhotoItem);
        emit();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'catalogPhotos')
    ),
  ];

  return () => {
    for (const u of unsubs) u();
  };
}

export async function parentSendMessage(
  profile: UserProfile,
  payload: {
    athlete?: Athlete | null;
    subject: string;
    message: string;
  }
): Promise<ParentMessage> {
  const cleanSubject = payload.subject.trim().slice(0, 140);
  const cleanMessage = payload.message.trim().slice(0, 1000);

  if (cleanSubject.length < 1) {
    throw new Error('يرجى إدخال عنوان أو موضوع الرسالة');
  }
  if (cleanMessage.length < 2) {
    throw new Error('يرجى كتابة نص الرسالة للكابتن');
  }

  const msgId = makeId('pmsg');
  const messageDoc: ParentMessage = {
    id: msgId,
    parentUid: profile.uid,
    parentName: (profile.fullName || 'ولي أمر').slice(0, 100),
    parentPhone: sanitizePhone(profile.phone || '') || '00000000',
    parentEmail: (profile.email || '').slice(0, 160),
    athleteId: payload.athlete?.id || '',
    athleteName: (payload.athlete?.fullName || 'استفسار عام').slice(0, 120),
    subject: cleanSubject,
    message: cleanMessage,
    readByCoach: false,
    coachReply: '',
    repliedAt: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'parentMessages', msgId), messageDoc);
    void dispatchCoachBackgroundPush({
      kind: 'parent_message',
      title: `رسالة جديدة من ولي الأمر: ${messageDoc.parentName}`,
      body: `${cleanSubject} — ${cleanMessage.slice(0, 140)}`,
      tag: msgId,
    });
    return {
      ...messageDoc,
      createdAtIso: new Date().toISOString(),
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `parentMessages/${msgId}`);
  }
}

export async function coachMarkParentMessageRead(messageId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'parentMessages', messageId), {
      readByCoach: true,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `parentMessages/${messageId}`);
  }
}

export async function coachReplyParentMessage(payload: {
  messageDoc: ParentMessage;
  replyText: string;
  fallbackAthlete?: Athlete | null;
  knownSubscriptions?: PushSubscriptionDoc[];
}): Promise<void> {
  const cleanReply = payload.replyText.trim().slice(0, 1000);
  if (!cleanReply) {
    throw new Error('يرجى كتابة نص الرد أولاً');
  }

  const nowIso = new Date().toISOString();
  const batch = writeBatch(db);
  batch.update(doc(db, 'parentMessages', payload.messageDoc.id), {
    readByCoach: true,
    coachReply: cleanReply,
    repliedAt: nowIso,
    updatedAt: serverTimestamp(),
  });

  const targetAthleteId = payload.messageDoc.athleteId || payload.fallbackAthlete?.id || '';
  const targetAthleteName =
    payload.messageDoc.athleteId && payload.messageDoc.athleteName
      ? payload.messageDoc.athleteName
      : payload.fallbackAthlete?.fullName || '';

  const replyTitle = `رد كابتن باهر على: ${payload.messageDoc.subject}`.slice(0, 140);

  if (targetAthleteId && targetAthleteName.length >= 2) {
    const notifId = makeId('notif');
    batch.set(doc(db, 'notifications', notifId), {
      id: notifId,
      parentUid: payload.messageDoc.parentUid,
      parentEmail: payload.messageDoc.parentEmail,
      athleteId: targetAthleteId,
      athleteName: targetAthleteName.slice(0, 120),
      type: 'general',
      title: replyTitle,
      message: cleanReply.slice(0, 600),
      read: false,
      createdAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
    void dispatchParentsBackgroundPush({
      title: replyTitle,
      body: cleanReply.slice(0, 300),
      tag: `reply_${payload.messageDoc.id}`,
      targets: [
        {
          parentUid: payload.messageDoc.parentUid,
          parentEmail: payload.messageDoc.parentEmail,
        },
      ],
      knownSubscriptions: payload.knownSubscriptions,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `parentMessages/${payload.messageDoc.id}`);
  }
}

export async function coachDeleteParentMessage(messageId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'parentMessages', messageId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `parentMessages/${messageId}`);
  }
}

export async function submitPublicRegistrationRequest(payload: {
  parentName: string;
  parentPhone: string;
  athleteName: string;
  age: number;
  discipline: Discipline;
  notes: string;
}): Promise<RegistrationRequest> {
  const cleanParentName = payload.parentName.trim().slice(0, 100);
  const cleanPhone = sanitizePhone(payload.parentPhone);
  const cleanAthleteName = payload.athleteName.trim().slice(0, 100);
  const ageNum = Math.min(35, Math.max(4, Math.round(Number(payload.age) || 10)));
  const cleanNotes = payload.notes.trim().slice(0, 400);

  if (cleanParentName.length < 2) {
    throw new Error('يرجى إدخال اسم ولي الأمر بالكامل');
  }
  if (cleanPhone.length < 8) {
    throw new Error('يرجى إدخال رقم موبايل / واتساب صحيح (8 أرقام على الأقل)');
  }
  if (cleanAthleteName.length < 2) {
    throw new Error('يرجى إدخال اسم اللاعب / الابن');
  }

  const requestId = makeId('req');
  const reqDoc: RegistrationRequest = {
    id: requestId,
    parentName: cleanParentName,
    parentPhone: cleanPhone,
    athleteName: cleanAthleteName,
    age: ageNum,
    discipline: payload.discipline,
    monthlyFee: DEFAULT_MONTHLY_FEE,
    notes: cleanNotes,
    status: 'pending',
    coachNote: '',
    linkedAthleteId: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'registrationRequests', requestId), reqDoc);
    void dispatchCoachBackgroundPush({
      kind: 'registration_request',
      title: 'طلب تسجيل لاعب جديد في الأكاديمية',
      body: `اللاعب: ${cleanAthleteName} (${ageNum} سنة) · ${payload.discipline} · ولي الأمر: ${cleanParentName} (${cleanPhone})`,
      tag: requestId,
      parentPhone: cleanPhone,
    });
    return {
      ...reqDoc,
      createdAtIso: new Date().toISOString(),
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `registrationRequests/${requestId}`);
  }
}

export async function coachUpdateRegistrationRequest(
  requestId: string,
  payload: {
    status: RegistrationRequestStatus;
    coachNote?: string;
    linkedAthleteId?: string;
  }
): Promise<void> {
  const patch: Record<string, unknown> = {
    status: payload.status,
    updatedAt: serverTimestamp(),
  };
  if (typeof payload.coachNote === 'string') {
    patch.coachNote = payload.coachNote.trim().slice(0, 400);
  }
  if (typeof payload.linkedAthleteId === 'string') {
    patch.linkedAthleteId = payload.linkedAthleteId.slice(0, 128);
  }

  try {
    await updateDoc(doc(db, 'registrationRequests', requestId), patch);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `registrationRequests/${requestId}`);
  }
}

export async function coachApproveRegistrationRequest(
  req: RegistrationRequest
): Promise<Athlete> {
  const athleteId = makeId('ath');
  const athleteDoc: Athlete = {
    id: athleteId,
    athleteCode: generateAthleteCode(),
    parentUid: '',
    parentEmail: '',
    parentName: req.parentName.trim().slice(0, 100),
    parentPhone: sanitizePhone(req.parentPhone),
    fullName: req.athleteName.trim().slice(0, 100),
    age: Math.min(35, Math.max(4, Math.round(Number(req.age) || 10))),
    discipline: req.discipline,
    groupSchedule: SCHEDULE_MAP[req.discipline],
    monthlyFee: req.monthlyFee || DEFAULT_MONTHLY_FEE,
    medicalNotes: (req.notes.trim() || 'لا توجد ملاحظات صحية').slice(0, 300),
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const batch = writeBatch(db);
  batch.set(doc(db, 'athletes', athleteId), athleteDoc);
  batch.update(doc(db, 'registrationRequests', req.id), {
    status: 'approved',
    linkedAthleteId: athleteId,
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
    return athleteDoc;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `registrationRequests/${req.id}`);
  }
}

export async function coachDeleteRegistrationRequest(requestId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'registrationRequests', requestId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `registrationRequests/${requestId}`);
  }
}

export async function coachAddAthlete(payload: {
  fullName: string;
  age: number;
  discipline: Discipline;
  monthlyFee: number;
  parentName: string;
  parentPhone: string;
  parentEmail?: string;
  medicalNotes: string;
}): Promise<Athlete> {
  const cleanName = payload.fullName.trim().slice(0, 100);
  const cleanParentName = payload.parentName.trim().slice(0, 100);
  const cleanPhone = sanitizePhone(payload.parentPhone);
  const cleanEmail = (payload.parentEmail || '').trim().toLowerCase().slice(0, 160);
  const ageNum = Math.min(35, Math.max(4, Math.round(Number(payload.age) || 10)));
  const feeNum = Math.max(0, Math.min(10000, Number(payload.monthlyFee) || DEFAULT_MONTHLY_FEE));

  if (cleanName.length < 2 || cleanParentName.length < 2 || cleanPhone.length < 8) {
    throw new Error('يرجى إدخال اسم اللاعب واسم ولي الأمر ورقم هاتف صحيح');
  }

  let matchedParentUid = '';
  if (cleanEmail) {
    const existingUsers = await getDocs(
      query(collection(db, 'users'), where('email', '==', cleanEmail))
    );
    if (!existingUsers.empty) {
      matchedParentUid = existingUsers.docs[0].id;
    }
  }

  const athleteId = makeId('ath');
  const athleteDoc: Athlete = {
    id: athleteId,
    athleteCode: generateAthleteCode(),
    parentUid: matchedParentUid,
    parentEmail: cleanEmail,
    parentName: cleanParentName,
    parentPhone: cleanPhone,
    fullName: cleanName,
    age: ageNum,
    discipline: payload.discipline,
    groupSchedule: SCHEDULE_MAP[payload.discipline],
    monthlyFee: feeNum,
    medicalNotes: (payload.medicalNotes.trim() || 'لا توجد ملاحظات صحية').slice(0, 300),
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'athletes', athleteId), athleteDoc);
    return athleteDoc;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `athletes/${athleteId}`);
  }
}

export async function coachUpdateAthlete(
  athleteId: string,
  payload: {
    discipline: Discipline;
    monthlyFee: number;
    medicalNotes: string;
  }
): Promise<void> {
  const feeNum = Math.max(0, Math.min(10000, Number(payload.monthlyFee) || DEFAULT_MONTHLY_FEE));
  try {
    await updateDoc(doc(db, 'athletes', athleteId), {
      discipline: payload.discipline,
      groupSchedule: SCHEDULE_MAP[payload.discipline],
      monthlyFee: feeNum,
      medicalNotes: (payload.medicalNotes.trim() || 'لا توجد ملاحظات صحية').slice(0, 300),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `athletes/${athleteId}`);
  }
}

export async function coachRecordAttendance(payload: {
  athlete: Athlete;
  existingRecord?: AttendanceRecord;
  action: 'check_in' | 'check_out' | 'absent';
  date: string;
  coachNote: string;
  knownSubscriptions?: PushSubscriptionDoc[];
}): Promise<void> {
  const { athlete, existingRecord, action, date, coachNote } = payload;
  const recordId = `${athlete.id}_${date}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  const month = date.slice(0, 7);
  const nowIso = new Date().toISOString();
  const cleanNote = coachNote.trim().slice(0, 300);

  let status: AttendanceStatus = 'present';
  if (action === 'check_out') status = 'checked_out';
  if (action === 'absent') status = 'absent';

  const checkInTime =
    action === 'absent' ? '' : existingRecord?.checkInTime || nowIso;
  const checkOutTime = action === 'check_out' ? nowIso : '';

  const batch = writeBatch(db);
  const attRef = doc(db, 'attendance', recordId);

  if (!existingRecord) {
    const newRec: AttendanceRecord = {
      id: recordId,
      athleteId: athlete.id,
      parentUid: athlete.parentUid,
      parentEmail: athlete.parentEmail,
      date,
      month,
      status,
      checkInTime,
      checkOutTime,
      coachNote: cleanNote,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    batch.set(attRef, newRec);
  } else {
    batch.update(attRef, {
      status,
      checkInTime,
      checkOutTime,
      coachNote: cleanNote || existingRecord.coachNote || '',
      parentUid: athlete.parentUid,
      parentEmail: athlete.parentEmail,
      updatedAt: serverTimestamp(),
    });
  }

  const timeLabel = formatArabicTime(nowIso);
  let notifType: NotificationType = 'check_in';
  let title = 'إشعار حضور تمرين';
  let message = `تم تسجيل حضور ${athlete.fullName} إلى أكاديمية البوب الساعة ${timeLabel}.`;

  if (action === 'check_out') {
    notifType = 'check_out';
    title = 'إشعار انصراف من الأكاديمية';
    message = `تم تسجيل انصراف ${athlete.fullName} من أكاديمية البوب الساعة ${timeLabel} بأمان بعد انتهاء التمرين.`;
  } else if (action === 'absent') {
    notifType = 'absent';
    title = 'إشعار غياب عن التمرين';
    message = `نحيطكم علماً بتسجيل غياب ${athlete.fullName} عن حصة اليوم (${date}).`;
  }

  if (cleanNote) {
    message += ` ملاحظة الكابتن: ${cleanNote}`;
  }

  const notifId = makeId('notif');
  const notifDoc: AcademyNotification = {
    id: notifId,
    parentUid: athlete.parentUid,
    parentEmail: athlete.parentEmail,
    athleteId: athlete.id,
    athleteName: athlete.fullName.slice(0, 120),
    type: notifType,
    title: title.slice(0, 140),
    message: message.slice(0, 600),
    read: false,
    createdAt: serverTimestamp(),
  };

  batch.set(doc(db, 'notifications', notifId), notifDoc);

  try {
    await batch.commit();
    void dispatchParentsBackgroundPush({
      title: notifDoc.title,
      body: notifDoc.message,
      tag: notifId,
      targets: [{ parentUid: athlete.parentUid, parentEmail: athlete.parentEmail }],
      knownSubscriptions: payload.knownSubscriptions,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `attendance/${recordId}`);
  }
}

export async function coachBulkAttendance(payload: {
  athletes: Athlete[];
  dayAttendance: AttendanceRecord[];
  action: 'check_in' | 'check_out';
  date: string;
  coachNote: string;
  knownSubscriptions?: PushSubscriptionDoc[];
}): Promise<number> {
  const { athletes, dayAttendance, action, date, coachNote } = payload;
  if (athletes.length === 0) return 0;

  const month = date.slice(0, 7);
  const nowIso = new Date().toISOString();
  const timeLabel = formatArabicTime(nowIso);
  const cleanNote = coachNote.trim().slice(0, 300);

  const batch = writeBatch(db);
  const pushItems: Array<{
    parentUid: string;
    parentEmail: string;
    title: string;
    message: string;
    notifId: string;
  }> = [];

  for (const athlete of athletes) {
    const recordId = `${athlete.id}_${date}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
    const existingRecord = dayAttendance.find((r) => r.athleteId === athlete.id);
    const status: AttendanceStatus = action === 'check_out' ? 'checked_out' : 'present';
    const checkInTime = existingRecord?.checkInTime || nowIso;
    const checkOutTime = action === 'check_out' ? nowIso : '';

    const attRef = doc(db, 'attendance', recordId);
    if (!existingRecord) {
      batch.set(attRef, {
        id: recordId,
        athleteId: athlete.id,
        parentUid: athlete.parentUid,
        parentEmail: athlete.parentEmail,
        date,
        month,
        status,
        checkInTime,
        checkOutTime,
        coachNote: cleanNote,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.update(attRef, {
        status,
        checkInTime,
        checkOutTime,
        coachNote: cleanNote || existingRecord.coachNote || '',
        parentUid: athlete.parentUid,
        parentEmail: athlete.parentEmail,
        updatedAt: serverTimestamp(),
      });
    }

    const notifId = makeId('notif');
    const title =
      action === 'check_out' ? 'إشعار انصراف من الأكاديمية' : 'إشعار حضور تمرين';
    let message =
      action === 'check_out'
        ? `تم تسجيل انصراف ${athlete.fullName} من أكاديمية البوب الساعة ${timeLabel} بأمان بعد انتهاء التمرين.`
        : `تم تسجيل حضور ${athlete.fullName} إلى أكاديمية البوب الساعة ${timeLabel}.`;
    if (cleanNote) message += ` ملاحظة الكابتن: ${cleanNote}`;

    batch.set(doc(db, 'notifications', notifId), {
      id: notifId,
      parentUid: athlete.parentUid,
      parentEmail: athlete.parentEmail,
      athleteId: athlete.id,
      athleteName: athlete.fullName.slice(0, 120),
      type: action,
      title: title.slice(0, 140),
      message: message.slice(0, 600),
      read: false,
      createdAt: serverTimestamp(),
    });

    pushItems.push({
      parentUid: athlete.parentUid,
      parentEmail: athlete.parentEmail,
      title: title.slice(0, 140),
      message: message.slice(0, 600),
      notifId,
    });
  }

  try {
    await batch.commit();
    for (const item of pushItems) {
      void dispatchParentsBackgroundPush({
        title: item.title,
        body: item.message,
        tag: item.notifId,
        targets: [{ parentUid: item.parentUid, parentEmail: item.parentEmail }],
        knownSubscriptions: payload.knownSubscriptions,
      });
    }
    return athletes.length;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'attendance');
  }
}

export async function coachSendNotification(payload: {
  athlete: Athlete;
  title: string;
  message: string;
  knownSubscriptions?: PushSubscriptionDoc[];
}): Promise<void> {
  const notifId = makeId('notif');
  const cleanTitle = (payload.title.trim() || 'رسالة من كابتن باهر مراد').slice(0, 140);
  const cleanMsg = payload.message.trim().slice(0, 600);
  if (!cleanMsg) {
    throw new Error('يرجى كتابة نص الإشعار');
  }

  try {
    await setDoc(doc(db, 'notifications', notifId), {
      id: notifId,
      parentUid: payload.athlete.parentUid,
      parentEmail: payload.athlete.parentEmail,
      athleteId: payload.athlete.id,
      athleteName: payload.athlete.fullName.slice(0, 120),
      type: 'general',
      title: cleanTitle,
      message: cleanMsg,
      read: false,
      createdAt: serverTimestamp(),
    });
    void dispatchParentsBackgroundPush({
      title: cleanTitle,
      body: cleanMsg,
      tag: notifId,
      targets: [
        { parentUid: payload.athlete.parentUid, parentEmail: payload.athlete.parentEmail },
      ],
      knownSubscriptions: payload.knownSubscriptions,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `notifications/${notifId}`);
  }
}

export async function coachBroadcastNotification(payload: {
  athletes: Athlete[];
  targetDiscipline: 'all' | Discipline;
  title: string;
  message: string;
  knownSubscriptions?: PushSubscriptionDoc[];
}): Promise<number> {
  const cleanTitle = (payload.title.trim() || 'إشعار جماعي من أكاديمية البوب').slice(0, 140);
  const cleanMsg = payload.message.trim().slice(0, 600);
  if (!cleanMsg) {
    throw new Error('يرجى كتابة نص الإشعار الجماعي');
  }

  const matching =
    payload.targetDiscipline === 'all'
      ? payload.athletes
      : payload.athletes.filter((a) => a.discipline === payload.targetDiscipline);

  const byParentKey = new Map<string, Athlete[]>();
  for (const ath of matching) {
    const key = ath.parentUid || ath.parentEmail || ath.id;
    const list = byParentKey.get(key) || [];
    list.push(ath);
    byParentKey.set(key, list);
  }

  if (byParentKey.size === 0) return 0;

  const batch = writeBatch(db);
  const targets: Array<{ parentUid?: string; parentEmail?: string }> = [];
  for (const children of byParentKey.values()) {
    const first = children[0];
    const notifId = makeId('notif');
    const names = children.map((c) => c.fullName).join(' و ').slice(0, 120);
    batch.set(doc(db, 'notifications', notifId), {
      id: notifId,
      parentUid: first.parentUid,
      parentEmail: first.parentEmail,
      athleteId: first.id,
      athleteName: names,
      type: 'general',
      title: cleanTitle,
      message: cleanMsg,
      read: false,
      createdAt: serverTimestamp(),
    });
    targets.push({ parentUid: first.parentUid, parentEmail: first.parentEmail });
  }

  try {
    await batch.commit();
    void dispatchParentsBackgroundPush({
      title: cleanTitle,
      body: cleanMsg,
      tag: `broadcast_${Date.now()}`,
      targets,
      knownSubscriptions: payload.knownSubscriptions,
    });
    return byParentKey.size;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'notifications');
  }
}

export async function coachRecordPayment(payload: {
  athlete: Athlete;
  month: string;
  amount: number;
  method: PaymentMethod;
  notes: string;
  knownSubscriptions?: PushSubscriptionDoc[];
}): Promise<void> {
  const amountNum = Number(payload.amount);
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    throw new Error('يرجى إدخال قيمة اشتراك صحيحة');
  }

  const paymentId = makeId('pay');
  const notifId = makeId('notif');
  const nowIso = new Date().toISOString();
  const title = 'تأكيد سداد الاشتراك الشهري';
  const msg = `تم تسجيل سداد اشتراك ${payload.athlete.fullName} لشهر ${payload.month} بقيمة ${amountNum} ج.م (${payload.method}).`.slice(
    0,
    600
  );

  const batch = writeBatch(db);
  batch.set(doc(db, 'payments', paymentId), {
    id: paymentId,
    athleteId: payload.athlete.id,
    parentUid: payload.athlete.parentUid,
    parentEmail: payload.athlete.parentEmail,
    month: payload.month,
    amount: amountNum,
    method: payload.method,
    paidAt: nowIso,
    recordedBy: COACH_DEFAULT_NAME,
    notes: (payload.notes.trim() || `سداد اشتراك شهر ${payload.month}`).slice(0, 300),
    createdAt: serverTimestamp(),
  });

  batch.set(doc(db, 'notifications', notifId), {
    id: notifId,
    parentUid: payload.athlete.parentUid,
    parentEmail: payload.athlete.parentEmail,
    athleteId: payload.athlete.id,
    athleteName: payload.athlete.fullName.slice(0, 120),
    type: 'payment',
    title,
    message: msg,
    read: false,
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
    void dispatchParentsBackgroundPush({
      title,
      body: msg,
      tag: notifId,
      targets: [
        { parentUid: payload.athlete.parentUid, parentEmail: payload.athlete.parentEmail },
      ],
      knownSubscriptions: payload.knownSubscriptions,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `payments/${paymentId}`);
  }
}

export async function coachDeleteAthlete(athleteId: string): Promise<void> {
  const path = `athletes/${athleteId}`;
  try {
    const [attSnap, paySnap, notifSnap] = await Promise.all([
      getDocs(query(collection(db, 'attendance'), where('athleteId', '==', athleteId))),
      getDocs(query(collection(db, 'payments'), where('athleteId', '==', athleteId))),
      getDocs(query(collection(db, 'notifications'), where('athleteId', '==', athleteId))),
    ]);

    const refsToDelete: DocumentReference[] = [
      doc(db, 'athletes', athleteId),
      ...attSnap.docs.map((d) => d.ref),
      ...paySnap.docs.map((d) => d.ref),
      ...notifSnap.docs.map((d) => d.ref),
    ];

    const CHUNK_SIZE = 400;
    for (let i = 0; i < refsToDelete.length; i += CHUNK_SIZE) {
      const chunk = refsToDelete.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const ref of chunk) {
        batch.delete(ref);
      }
      await batch.commit();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export interface CoachCreateParentAccountPayload {
  mode: 'existing_athlete' | 'new_athlete';
  athleteId?: string;
  linkMatchingPhoneAthletes?: boolean;
  parentName: string;
  parentPhone: string;
  usernameOrEmail: string;
  password: string;
  childName?: string;
  childAge?: number;
  discipline?: Discipline;
  monthlyFee?: number;
  medicalNotes?: string;
}

export interface CoachCreateParentAccountResult {
  uid: string;
  loginEmail: string;
  username: string;
  parentName: string;
  parentPhone: string;
  linkedAthleteNames: string[];
}

export async function coachCreateParentAccount(
  payload: CoachCreateParentAccountPayload
): Promise<CoachCreateParentAccountResult> {
  const cleanParentName = payload.parentName.trim().slice(0, 100);
  const cleanPhone = sanitizePhone(payload.parentPhone);
  const cleanPassword = convertArabicDigits(payload.password).trim();
  const { loginEmail, username } = normalizeParentLoginEmail(payload.usernameOrEmail);

  if (cleanParentName.length < 2) {
    throw new Error('يرجى إدخال اسم ولي الأمر بالكامل');
  }
  if (cleanPhone.length < 8) {
    throw new Error('يرجى إدخال رقم موبايل صحيح لولي الأمر (8 أرقام على الأقل)');
  }
  if (cleanPassword.length < 6 || cleanPassword.length > 64) {
    throw new Error('كلمة المرور يجب أن تتكون من 6 إلى 64 حرفاً أو رقماً');
  }

  let newAthName = '';
  let newAthAge = 10;
  let newAthFee = DEFAULT_MONTHLY_FEE;
  const newAthDisc: Discipline = payload.discipline || 'كيك بوكسينج';

  if (payload.mode === 'new_athlete') {
    newAthName = (payload.childName || '').trim().slice(0, 100);
    newAthAge = Math.min(35, Math.max(4, Math.round(Number(payload.childAge) || 10)));
    newAthFee = Math.max(0, Math.min(10000, Number(payload.monthlyFee) || DEFAULT_MONTHLY_FEE));
    if (newAthName.length < 2) {
      throw new Error('يرجى إدخال اسم اللاعب بالكامل');
    }
  } else if (!payload.athleteId) {
    throw new Error('يرجى اختيار اللاعب المراد ربطه بحساب ولي الأمر');
  }

  // Create Firebase Auth account on a secondary app with in-memory persistence so Captain Baher stays signed in
  const secondaryAppName = `parent-creator-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
  const secondaryAuth = initializeAuth(secondaryApp, {
    persistence: inMemoryPersistence,
  });
  let newParentUid = '';

  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, loginEmail, cleanPassword);
    newParentUid = cred.user.uid;
  } catch (authErr) {
    throw new Error(mapAuthErrorToArabic(authErr));
  } finally {
    await signOut(secondaryAuth).catch(() => {});
    await deleteApp(secondaryApp).catch(() => {});
  }

  const linkedAthleteNames: string[] = [];

  try {
    type BatchAction =
      | { kind: 'set'; ref: DocumentReference; data: Record<string, unknown> }
      | { kind: 'update'; ref: DocumentReference; data: Record<string, unknown> };

    const actions: BatchAction[] = [];

    actions.push({
      kind: 'set',
      ref: doc(db, 'users', newParentUid),
      data: {
        uid: newParentUid,
        fullName: cleanParentName,
        phone: cleanPhone,
        email: loginEmail,
        role: 'parent',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    });

    if (payload.mode === 'new_athlete') {
      const athleteId = makeId('ath');
      actions.push({
        kind: 'set',
        ref: doc(db, 'athletes', athleteId),
        data: {
          id: athleteId,
          athleteCode: generateAthleteCode(),
          parentUid: newParentUid,
          parentEmail: loginEmail,
          parentName: cleanParentName,
          parentPhone: cleanPhone,
          fullName: newAthName,
          age: newAthAge,
          discipline: newAthDisc,
          groupSchedule: SCHEDULE_MAP[newAthDisc],
          monthlyFee: newAthFee,
          medicalNotes: ((payload.medicalNotes || '').trim() || 'لا توجد ملاحظات صحية').slice(
            0,
            300
          ),
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      });
      linkedAthleteNames.push(newAthName);
    } else if (payload.athleteId) {
      const selectedSnap = await getDoc(doc(db, 'athletes', payload.athleteId));
      const athletesToLink: Athlete[] = [];
      if (selectedSnap.exists()) {
        athletesToLink.push(selectedSnap.data() as Athlete);
      }

      if (payload.linkMatchingPhoneAthletes !== false) {
        const samePhoneSnap = await getDocs(
          query(collection(db, 'athletes'), where('parentPhone', '==', cleanPhone))
        );
        for (const d of samePhoneSnap.docs) {
          const ath = d.data() as Athlete;
          if (!ath.parentUid && !athletesToLink.some((x) => x.id === ath.id)) {
            athletesToLink.push(ath);
          }
        }
      }

      for (const ath of athletesToLink) {
        linkedAthleteNames.push(ath.fullName);
        actions.push({
          kind: 'update',
          ref: doc(db, 'athletes', ath.id),
          data: {
            parentUid: newParentUid,
            parentEmail: loginEmail,
            parentName: cleanParentName,
            parentPhone: cleanPhone,
            updatedAt: serverTimestamp(),
          },
        });

        const [attSnap, paySnap, notifSnap] = await Promise.all([
          getDocs(query(collection(db, 'attendance'), where('athleteId', '==', ath.id))),
          getDocs(query(collection(db, 'payments'), where('athleteId', '==', ath.id))),
          getDocs(query(collection(db, 'notifications'), where('athleteId', '==', ath.id))),
        ]);

        for (const d of attSnap.docs) {
          actions.push({
            kind: 'update',
            ref: d.ref,
            data: {
              parentUid: newParentUid,
              parentEmail: loginEmail,
              updatedAt: serverTimestamp(),
            },
          });
        }
        for (const d of paySnap.docs) {
          actions.push({
            kind: 'update',
            ref: d.ref,
            data: {
              parentUid: newParentUid,
              parentEmail: loginEmail,
            },
          });
        }
        for (const d of notifSnap.docs) {
          actions.push({
            kind: 'update',
            ref: d.ref,
            data: {
              parentUid: newParentUid,
              parentEmail: loginEmail,
            },
          });
        }
      }
    }

    const CHUNK_SIZE = 400;
    for (let i = 0; i < actions.length; i += CHUNK_SIZE) {
      const chunk = actions.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const act of chunk) {
        if (act.kind === 'set') {
          batch.set(act.ref, act.data);
        } else {
          batch.update(act.ref, act.data);
        }
      }
      await batch.commit();
    }

    return {
      uid: newParentUid,
      loginEmail,
      username,
      parentName: cleanParentName,
      parentPhone: cleanPhone,
      linkedAthleteNames,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${newParentUid}`);
  }
}

export function buildMonthlyReport(
  athletes: Athlete[],
  attendance: AttendanceRecord[],
  payments: PaymentRecord[],
  month: string
): MonthlyReportResponse {
  const monthAttendance = attendance.filter((r) => r.month === month);
  const monthPayments = payments.filter((p) => p.month === month);

  const summaries: MonthlyAthleteSummary[] = athletes.map((athlete) => {
    const records = monthAttendance.filter((r) => r.athleteId === athlete.id);
    const presentDays = records.filter(
      (r) => r.status === 'present' || r.status === 'checked_out'
    ).length;
    const absentDays = records.filter((r) => r.status === 'absent').length;
    const totalSessions = presentDays + absentDays;
    const attendanceRate =
      totalSessions > 0 ? Math.round((presentDays / totalSessions) * 100) : 0;

    const athPayments = monthPayments.filter((p) => p.athleteId === athlete.id);
    const paidAmount = athPayments.reduce((sum, p) => sum + p.amount, 0);
    const isPaid = paidAmount >= athlete.monthlyFee;
    const latestPayment = [...athPayments].sort((a, b) => b.paidAt.localeCompare(a.paidAt))[0];

    const sortedAtt = [...records].sort((a, b) => b.date.localeCompare(a.date));
    const latestWithCheckIn = sortedAtt.find((r) => r.checkInTime);
    const latestWithCheckOut = sortedAtt.find((r) => r.checkOutTime);

    return {
      athleteId: athlete.id,
      athleteName: athlete.fullName,
      parentName: athlete.parentName,
      parentPhone: athlete.parentPhone,
      discipline: athlete.discipline,
      monthlyFee: athlete.monthlyFee,
      presentDays,
      absentDays,
      totalSessions,
      attendanceRate,
      paidAmount,
      isPaid,
      lastPaymentDate: latestPayment ? latestPayment.paidAt : null,
      lastCheckIn: latestWithCheckIn?.checkInTime || null,
      lastCheckOut: latestWithCheckOut?.checkOutTime || null,
    };
  });

  const totalPresentRecords = summaries.reduce((s, item) => s + item.presentDays, 0);
  const totalAbsentRecords = summaries.reduce((s, item) => s + item.absentDays, 0);
  const paidCount = summaries.filter((s) => s.isPaid).length;
  const unpaidCount = summaries.length - paidCount;
  const totalRevenue = summaries.reduce((s, item) => s + item.paidAmount, 0);
  const expectedRevenue = summaries.reduce((s, item) => s + item.monthlyFee, 0);

  return {
    month,
    totalAthletes: summaries.length,
    totalPresentRecords,
    totalAbsentRecords,
    paidCount,
    unpaidCount,
    totalRevenue,
    expectedRevenue,
    summaries,
  };
}

export async function coachDeclareHoliday(payload: {
  date: string;
  reason?: string;
  athletes: Athlete[];
  knownSubscriptions?: PushSubscriptionDoc[];
}): Promise<{ notifiedParents: number }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) {
    throw new Error('صيغة التاريخ غير صحيحة');
  }
  const cleanReason = (payload.reason || '').trim().slice(0, 200);
  const weekday = getArabicWeekdayName(payload.date);
  const title = `إجازة رسمية · لا يوجد تمرين (${weekday})`.slice(0, 140);
  const body = (
    cleanReason
      ? `نحيطكم علماً بأن يوم ${weekday} (${payload.date}) إجازة ولا يوجد تمرين في أكاديمية البوب. السبب: ${cleanReason}`
      : `نحيطكم علماً بأن يوم ${weekday} (${payload.date}) إجازة رسمية ولا يوجد تمرين في أكاديمية البوب للفنون القتالية.`
  ).slice(0, 600);

  const byParentKey = new Map<string, Athlete[]>();
  for (const ath of payload.athletes) {
    if (!ath.parentUid && !ath.parentEmail) continue;
    const key = ath.parentUid || ath.parentEmail || ath.id;
    const list = byParentKey.get(key) || [];
    list.push(ath);
    byParentKey.set(key, list);
  }

  const batch = writeBatch(db);
  batch.set(doc(db, 'academyHolidays', payload.date), {
    id: payload.date,
    date: payload.date,
    reason: cleanReason,
    createdAt: serverTimestamp(),
  });

  const targets: Array<{ parentUid?: string; parentEmail?: string }> = [];
  for (const children of byParentKey.values()) {
    const first = children[0];
    const notifId = makeId('notif');
    const names = children.map((c) => c.fullName).join(' و ').slice(0, 120);
    batch.set(doc(db, 'notifications', notifId), {
      id: notifId,
      parentUid: first.parentUid,
      parentEmail: first.parentEmail,
      athleteId: first.id,
      athleteName: names,
      type: 'holiday',
      title,
      message: body,
      read: false,
      createdAt: serverTimestamp(),
    });
    targets.push({ parentUid: first.parentUid, parentEmail: first.parentEmail });
  }

  try {
    await batch.commit();
    void notifyServerHolidayChange(payload.date, true, cleanReason);
    if (targets.length > 0) {
      void dispatchParentsBackgroundPush({
        title,
        body,
        tag: `holiday_${payload.date}`,
        targets,
        knownSubscriptions: payload.knownSubscriptions,
      });
    }
    return { notifiedParents: targets.length };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `academyHolidays/${payload.date}`);
  }
}

export async function coachCancelHoliday(payload: {
  date: string;
  athletes: Athlete[];
  notifyParents?: boolean;
  knownSubscriptions?: PushSubscriptionDoc[];
}): Promise<void> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) {
    throw new Error('صيغة التاريخ غير صحيحة');
  }
  const weekday = getArabicWeekdayName(payload.date);
  try {
    await deleteDoc(doc(db, 'academyHolidays', payload.date));
    void notifyServerHolidayChange(payload.date, false, '');

    if (payload.notifyParents) {
      const title = `استئناف التمرين (${weekday}) · أكاديمية البوب`.slice(0, 140);
      const body = `نحيطكم علماً بإلغاء الإجازة واستئناف التمرين يوم ${weekday} (${payload.date}) في موعده الساعة 5:00 مساءً.`.slice(
        0,
        600
      );
      const byParentKey = new Map<string, Athlete[]>();
      for (const ath of payload.athletes) {
        if (!ath.parentUid && !ath.parentEmail) continue;
        const key = ath.parentUid || ath.parentEmail || ath.id;
        const list = byParentKey.get(key) || [];
        list.push(ath);
        byParentKey.set(key, list);
      }
      const batch = writeBatch(db);
      const targets: Array<{ parentUid?: string; parentEmail?: string }> = [];
      for (const children of byParentKey.values()) {
        const first = children[0];
        const notifId = makeId('notif');
        const names = children.map((c) => c.fullName).join(' و ').slice(0, 120);
        batch.set(doc(db, 'notifications', notifId), {
          id: notifId,
          parentUid: first.parentUid,
          parentEmail: first.parentEmail,
          athleteId: first.id,
          athleteName: names,
          type: 'general',
          title,
          message: body,
          read: false,
          createdAt: serverTimestamp(),
        });
        targets.push({ parentUid: first.parentUid, parentEmail: first.parentEmail });
      }
      if (targets.length > 0) {
        await batch.commit();
        void dispatchParentsBackgroundPush({
          title,
          body,
          tag: `resume_${payload.date}`,
          targets,
          knownSubscriptions: payload.knownSubscriptions,
        });
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `academyHolidays/${payload.date}`);
  }
}

export function subscribeApprovedCatalogPhotos(
  onChange: (photos: CatalogPhotoItem[]) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'catalogPhotos'), where('status', '==', 'approved')),
    (snap) => {
      const photos = snap.docs
        .map((d) => {
          const data = d.data() as CatalogPhotoItem;
          return {
            ...data,
            createdAtIso: timestampToIso(data.createdAt),
          };
        })
        .sort((a, b) => (b.createdAtIso || '').localeCompare(a.createdAtIso || ''));
      onChange(photos);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'catalogPhotos')
  );
}

export async function parentSubmitCatalogPhoto(
  profile: UserProfile,
  payload: {
    title: string;
    caption: string;
    category: CatalogCategory;
    imageUrl: string;
    athlete?: Athlete | null;
  }
): Promise<CatalogPhotoItem> {
  const cleanTitle = payload.title.trim().slice(0, 120);
  const cleanCaption = payload.caption.trim().slice(0, 300);
  if (cleanTitle.length < 2) {
    throw new Error('يرجى كتابة عنوان واضح للصورة (حرفين على الأقل)');
  }
  if (!payload.imageUrl || payload.imageUrl.length < 30 || payload.imageUrl.length > 450000) {
    throw new Error('الصورة غير صالحة أو حجمها كبير جداً');
  }

  const photoId = makeId('photo');
  const photoDoc: CatalogPhotoItem = {
    id: photoId,
    title: cleanTitle,
    caption: cleanCaption,
    category: payload.category,
    imageUrl: payload.imageUrl,
    status: 'pending',
    submittedByUid: profile.uid,
    submittedByName: (profile.fullName || 'ولي أمر').slice(0, 100),
    submittedByRole: 'parent',
    athleteId: payload.athlete?.id || '',
    athleteName: (payload.athlete?.fullName || '').slice(0, 120),
    coachNote: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'catalogPhotos', photoId), photoDoc);
    void dispatchCoachBackgroundPush({
      kind: 'catalog_photo',
      title: `صورة جديدة للكتالوج من ${photoDoc.submittedByName}`,
      body: `بانتظار موافقتك لنشرها في الكتالوج: ${cleanTitle}`,
      tag: photoId,
    });
    return {
      ...photoDoc,
      createdAtIso: new Date().toISOString(),
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `catalogPhotos/${photoId}`);
  }
}

export async function coachPublishCatalogPhoto(
  profile: UserProfile,
  payload: {
    title: string;
    caption: string;
    category: CatalogCategory;
    imageUrl: string;
  }
): Promise<CatalogPhotoItem> {
  const cleanTitle = payload.title.trim().slice(0, 120);
  const cleanCaption = payload.caption.trim().slice(0, 300);
  if (cleanTitle.length < 2) {
    throw new Error('يرجى كتابة عنوان للصورة قبل نشرها في الكتالوج');
  }
  if (!payload.imageUrl || payload.imageUrl.length < 30 || payload.imageUrl.length > 450000) {
    throw new Error('الصورة غير صالحة أو حجمها أكبر من الحد المسموح');
  }

  const photoId = makeId('photo');
  const photoDoc: CatalogPhotoItem = {
    id: photoId,
    title: cleanTitle,
    caption: cleanCaption,
    category: payload.category,
    imageUrl: payload.imageUrl,
    status: 'approved',
    submittedByUid: profile.uid,
    submittedByName: (profile.fullName || COACH_DEFAULT_NAME).slice(0, 100),
    submittedByRole: 'coach',
    athleteId: '',
    athleteName: '',
    coachNote: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'catalogPhotos', photoId), photoDoc);
    return {
      ...photoDoc,
      createdAtIso: new Date().toISOString(),
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `catalogPhotos/${photoId}`);
  }
}

export async function coachReviewCatalogPhoto(payload: {
  photo: CatalogPhotoItem;
  status: CatalogPhotoStatus;
  coachNote?: string;
  targetAthlete?: Athlete | null;
  knownSubscriptions?: PushSubscriptionDoc[];
}): Promise<void> {
  const cleanNote = (payload.coachNote ?? payload.photo.coachNote ?? '').trim().slice(0, 300);
  const batch = writeBatch(db);
  batch.update(doc(db, 'catalogPhotos', payload.photo.id), {
    status: payload.status,
    coachNote: cleanNote,
    updatedAt: serverTimestamp(),
  });

  const targetAthId = payload.photo.athleteId || payload.targetAthlete?.id || '';
  const targetAthName = payload.photo.athleteName || payload.targetAthlete?.fullName || '';
  const targetParentUid =
    payload.targetAthlete?.parentUid ||
    (payload.photo.submittedByRole === 'parent' ? payload.photo.submittedByUid : '');
  const targetParentEmail = payload.targetAthlete?.parentEmail || '';

  const shouldNotifyParent =
    payload.photo.submittedByRole === 'parent' &&
    Boolean(targetAthId) &&
    targetAthName.length >= 2 &&
    (payload.status === 'approved' || payload.status === 'rejected');

  if (shouldNotifyParent) {
    const notifId = makeId('notif');
    const title =
      payload.status === 'approved'
        ? 'تمت الموافقة ونشر صورتك في كتالوج الأكاديمية'
        : 'ملاحظة على الصورة المرسلة للكتالوج';
    const message =
      payload.status === 'approved'
        ? `وافق كابتن باهر مراد على نشر صورة "${payload.photo.title}" في الكتالوج الرسمي لأكاديمية البوب.`
        : `تعذر نشر صورة "${payload.photo.title}" في الكتالوج حالياً.${cleanNote ? ` السبب: ${cleanNote}` : ''}`;

    batch.set(doc(db, 'notifications', notifId), {
      id: notifId,
      parentUid: targetParentUid,
      parentEmail: targetParentEmail,
      athleteId: targetAthId,
      athleteName: targetAthName.slice(0, 120),
      type: 'general',
      title: title.slice(0, 140),
      message: message.slice(0, 600),
      read: false,
      createdAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
    if (shouldNotifyParent && (targetParentUid || targetParentEmail)) {
      const title =
        payload.status === 'approved'
          ? 'تم نشر صورتك في كتالوج أكاديمية البوب'
          : 'تحديث حول الصورة المرسلة للكتالوج';
      const body =
        payload.status === 'approved'
          ? `وافق كابتن باهر مراد على إضافة "${payload.photo.title}" إلى الكتالوج.`
          : `لم يتم نشر "${payload.photo.title}"${cleanNote ? `: ${cleanNote}` : ''}`;
      void dispatchParentsBackgroundPush({
        title,
        body,
        tag: `photo_${payload.photo.id}`,
        targets: [{ parentUid: targetParentUid, parentEmail: targetParentEmail }],
        knownSubscriptions: payload.knownSubscriptions,
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `catalogPhotos/${payload.photo.id}`);
  }
}

export async function deleteCatalogPhoto(photoId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'catalogPhotos', photoId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `catalogPhotos/${photoId}`);
  }
}


