import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { OperationType, app, auth, db, handleFirestoreError } from './firebase';
import type { AcademyHoliday, PushSubscriptionDoc, UserProfile } from '../types';

export type PushEnableResult =
  | {
      status: 'enabled';
      fcmTokenRegistered: boolean;
      backgroundPushRegistered: boolean;
      message: string;
    }
  | { status: 'ios_requires_pwa'; message: string }
  | { status: 'denied'; message: string }
  | { status: 'unsupported'; message: string }
  | { status: 'error'; message: string };

const FCM_SW_URL = '/firebase-messaging-sw.js';
const FCM_SW_SCOPE = '/firebase-cloud-messaging-push-scope';
const PUSH_SW_URL = '/push-sw.js';
const PUSH_SW_SCOPE = '/alboob-push-scope';

export function detectPlatformState() {
  if (typeof window === 'undefined') {
    return { isIOS: false, isAndroid: false, isStandalone: false };
  }
  const ua = window.navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isAndroid = /android/.test(ua);
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return { isIOS, isAndroid, isStandalone };
}

function getPlatformLabel(): string {
  const { isIOS, isAndroid, isStandalone } = detectPlatformState();
  if (isIOS) return isStandalone ? 'ios_pwa' : 'ios_web';
  if (isAndroid) return isStandalone ? 'android_pwa' : 'android_web';
  return isStandalone ? 'desktop_pwa' : 'desktop_web';
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function arrayBufferToBase64Url(buf: ArrayBuffer | null): string {
  if (!buf) return '';
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function waitForServiceWorkerActive(reg: ServiceWorkerRegistration): Promise<void> {
  if (reg.active) return;
  const sw = reg.installing || reg.waiting;
  if (!sw) return;
  await new Promise<void>((resolve) => {
    const onState = () => {
      if (sw.state === 'activated' || sw.state === 'redundant') {
        sw.removeEventListener('statechange', onState);
        resolve();
      }
    };
    sw.addEventListener('statechange', onState);
    setTimeout(() => {
      sw.removeEventListener('statechange', onState);
      resolve();
    }, 4000);
  });
}

export async function registerFcmServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    return await navigator.serviceWorker.register(FCM_SW_URL, {
      scope: FCM_SW_SCOPE,
    });
  } catch (err) {
    console.warn('FCM service worker registration warning:', err);
    return null;
  }
}

export async function registerBackgroundPushServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    const reg = await navigator.serviceWorker.register(PUSH_SW_URL, {
      scope: PUSH_SW_SCOPE,
    });
    await waitForServiceWorkerActive(reg);
    return reg;
  } catch (err) {
    console.warn('Background push service worker registration warning:', err);
    return null;
  }
}

async function fetchVapidPublicKey(): Promise<string | null> {
  try {
    const res = await fetch('/api/push/vapid-public-key', { cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as { publicKey?: unknown };
    return typeof data.publicKey === 'string' && data.publicKey.length > 20 ? data.publicKey : null;
  } catch {
    return null;
  }
}

function makeSubDocId(uid: string, endpoint: string): string {
  let hash = 0;
  for (let i = 0; i < endpoint.length; i++) {
    hash = (hash * 31 + endpoint.charCodeAt(i)) | 0;
  }
  const suffix = Math.abs(hash).toString(36);
  return `psub_${uid}_${suffix}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
}

async function savePushSubscriptionToFirestore(
  profile: UserProfile,
  subJson: PushSubscriptionJSON,
  platform: string
): Promise<void> {
  const endpoint = (subJson.endpoint || '').slice(0, 1000);
  const p256dh = (subJson.keys?.p256dh || '').slice(0, 300);
  const authKey = (subJson.keys?.auth || '').slice(0, 200);
  if (!endpoint || !p256dh || !authKey) return;

  const subId = makeSubDocId(profile.uid, endpoint);
  const path = `pushSubscriptions/${subId}`;

  try {
    const ref = doc(db, 'pushSubscriptions', subId);
    const existing = await getDoc(ref);
    if (existing.exists()) {
      await updateDoc(ref, {
        endpoint,
        p256dh,
        auth: authKey,
        platform: platform.slice(0, 40),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        id: subId,
        uid: profile.uid,
        email: (profile.email || 'user@alboob.app').slice(0, 160),
        role: profile.role,
        endpoint,
        p256dh,
        auth: authKey,
        platform: platform.slice(0, 40),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

async function saveFcmTokenToFirestore(
  profile: UserProfile,
  token: string,
  platform: string
): Promise<void> {
  const tokenSuffix = token.slice(-16).replace(/[^a-zA-Z0-9_-]/g, '_');
  const tokenId = `fcm_${profile.uid}_${tokenSuffix}`.slice(0, 120);
  const path = `fcmTokens/${tokenId}`;

  try {
    const ref = doc(db, 'fcmTokens', tokenId);
    const existing = await getDoc(ref);
    if (existing.exists()) {
      await updateDoc(ref, {
        token: token.slice(0, 500),
        platform: platform.slice(0, 40),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        id: tokenId,
        uid: profile.uid,
        email: profile.email.slice(0, 160),
        role: profile.role,
        token: token.slice(0, 500),
        platform: platform.slice(0, 40),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function subscribeDeviceToWebPush(
  profile?: UserProfile | null
): Promise<{ registered: boolean; subscriptionJson: PushSubscriptionJSON | null }> {
  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window)
  ) {
    return { registered: false, subscriptionJson: null };
  }

  try {
    const [publicKey, reg] = await Promise.all([
      fetchVapidPublicKey(),
      registerBackgroundPushServiceWorker(),
    ]);
    if (!publicKey || !reg || !reg.pushManager) {
      return { registered: false, subscriptionJson: null };
    }

    let sub = await reg.pushManager.getSubscription();
    if (sub) {
      const existingKey = arrayBufferToBase64Url(sub.options?.applicationServerKey || null);
      if (existingKey && existingKey !== publicKey) {
        await sub.unsubscribe().catch(() => false);
        sub = null;
      }
    }

    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    const subJson = sub.toJSON();
    const platform = getPlatformLabel();

    const idToken = await auth.currentUser?.getIdToken().catch(() => null);
    if (idToken && subJson.endpoint && subJson.keys?.p256dh && subJson.keys?.auth) {
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ subscription: subJson, platform }),
      }).catch(() => {});
    }

    if (profile) {
      await savePushSubscriptionToFirestore(profile, subJson, platform).catch(() => {});
    }

    return {
      registered: Boolean(subJson.endpoint && subJson.keys?.p256dh && subJson.keys?.auth),
      subscriptionJson: subJson,
    };
  } catch (err) {
    console.warn('Web Push subscription warning:', err);
    return { registered: false, subscriptionJson: null };
  }
}

export async function syncPushSubscriptionIfGranted(profile: UserProfile | null): Promise<void> {
  if (!profile || typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  const { isIOS, isStandalone } = detectPlatformState();
  if (isIOS && !isStandalone) return;
  await subscribeDeviceToWebPush(profile);
}

export async function sendTestBackgroundPush(
  profile: UserProfile | null
): Promise<{ ok: boolean; sent: number; message: string }> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { ok: false, sent: 0, message: 'المتصفح لا يدعم الإشعارات.' };
  }
  if (Notification.permission !== 'granted') {
    return { ok: false, sent: 0, message: 'يرجى تفعيل إذن الإشعارات أولاً.' };
  }

  try {
    const { subscriptionJson } = await subscribeDeviceToWebPush(profile);
    const idToken = await auth.currentUser?.getIdToken().catch(() => null);
    if (!idToken) {
      await showLocalPushNotification(
        'أكاديمية البوب للفنون القتالية',
        'إشعار تجريبي محلي — سجّل الدخول لتجربة إشعار الخلفية من الخادم.',
        'alboob-test-local'
      );
      return { ok: true, sent: 1, message: 'تم إرسال إشعار تجريبي محلي بنجاح.' };
    }

    const res = await fetch('/api/push/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ currentSubscription: subscriptionJson }),
    });

    if (!res.ok) {
      throw new Error('تعذر التواصل مع خادم الإشعارات.');
    }
    const data = (await res.json()) as { sent?: number };
    const sentCount = Number(data.sent) || 0;
    return {
      ok: sentCount > 0,
      sent: sentCount,
      message:
        sentCount > 0
          ? 'تم إرسال إشعار الخلفية الحقيقي من الخادم إلى جهازك بنجاح!'
          : 'لم يتم العثور على اشتراك نشط لهذا الجهاز، اضغط إعادة التفعيل.',
    };
  } catch (err) {
    return {
      ok: false,
      sent: 0,
      message: err instanceof Error ? err.message : 'تعذر إرسال الإشعار التجريبي.',
    };
  }
}

export async function dispatchParentsBackgroundPush(params: {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  targets: Array<{ parentUid?: string; parentEmail?: string }>;
  knownSubscriptions?: PushSubscriptionDoc[];
}): Promise<void> {
  try {
    const idToken = await auth.currentUser?.getIdToken().catch(() => null);
    if (!idToken) return;

    const uidSet = new Set(params.targets.map((t) => t.parentUid).filter(Boolean));
    const emailSet = new Set(
      params.targets
        .map((t) => (t.parentEmail || '').trim().toLowerCase())
        .filter(Boolean)
    );

    const fallbackSubscriptions = (params.knownSubscriptions || [])
      .filter(
        (sub) =>
          sub.role === 'parent' &&
          (uidSet.has(sub.uid) || (sub.email && emailSet.has(sub.email.toLowerCase())))
      )
      .map((sub) => ({
        endpoint: sub.endpoint,
        p256dh: sub.p256dh,
        auth: sub.auth,
      }));

    await fetch('/api/push/send-parents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        title: params.title,
        body: params.body,
        url: params.url || '/',
        tag: params.tag,
        targets: params.targets,
        fallbackSubscriptions,
      }),
    });
  } catch {
    // Non-blocking: Firestore write already succeeded
  }
}

export async function dispatchCoachBackgroundPush(params: {
  kind: 'parent_message' | 'registration_request' | 'catalog_photo';
  title: string;
  body: string;
  url?: string;
  tag?: string;
  parentPhone?: string;
}): Promise<void> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (params.kind === 'parent_message' || params.kind === 'catalog_photo') {
      const idToken = await auth.currentUser?.getIdToken().catch(() => null);
      if (!idToken) return;
      headers.Authorization = `Bearer ${idToken}`;
    }

    await fetch('/api/push/notify-coach', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        kind: params.kind,
        title: params.title,
        body: params.body,
        url: params.url || '/',
        tag: params.tag,
        parentPhone: params.parentPhone,
      }),
    });
  } catch {
    // Non-blocking: Firestore write already succeeded
  }
}

export interface ServerScheduleStatus {
  todayDate: string;
  arabicDayName: string;
  isTrainingDay: boolean;
  isHoliday: boolean;
  holidayReason: string;
  autoReminderHourCairo: number;
  autoReminderSentToday: boolean;
  autoReminderSentAt: string | null;
  registeredParentDevices: number;
}

export async function fetchScheduleStatus(): Promise<ServerScheduleStatus | null> {
  try {
    const res = await fetch('/api/push/schedule-status', { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as ServerScheduleStatus;
  } catch {
    return null;
  }
}

export async function syncCoachScheduleAndSubscriptions(
  holidays: AcademyHoliday[],
  subscriptions: PushSubscriptionDoc[]
): Promise<void> {
  try {
    const idToken = await auth.currentUser?.getIdToken().catch(() => null);
    if (!idToken) return;
    await fetch('/api/push/sync-schedule', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        holidays: holidays.map((h) => ({ date: h.date, reason: h.reason })),
        subscriptions: subscriptions.map((s) => ({
          uid: s.uid,
          email: s.email,
          role: s.role,
          endpoint: s.endpoint,
          p256dh: s.p256dh,
          auth: s.auth,
          platform: s.platform,
        })),
      }),
    });
  } catch {
    // non-blocking
  }
}

export async function notifyServerHolidayChange(
  date: string,
  isHoliday: boolean,
  reason = ''
): Promise<void> {
  try {
    const idToken = await auth.currentUser?.getIdToken().catch(() => null);
    if (!idToken) return;
    await fetch('/api/push/set-holiday', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ date, isHoliday, reason }),
    });
  } catch {
    // non-blocking
  }
}

export async function triggerTrainingReminderNow(
  subscriptions: PushSubscriptionDoc[]
): Promise<{ ok: boolean; sent: number; skipped?: boolean; reason?: string }> {
  try {
    const idToken = await auth.currentUser?.getIdToken().catch(() => null);
    if (!idToken) return { ok: false, sent: 0 };

    const res = await fetch('/api/push/trigger-training-reminder', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        fallbackSubscriptions: subscriptions
          .filter((s) => s.role === 'parent')
          .map((s) => ({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth })),
      }),
    });
    if (!res.ok) return { ok: false, sent: 0 };
    return (await res.json()) as { ok: boolean; sent: number; skipped?: boolean; reason?: string };
  } catch {
    return { ok: false, sent: 0 };
  }
}

export async function showLocalPushNotification(
  title: string,
  body: string,
  tag = 'alboob-notif'
): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    if ('serviceWorker' in navigator) {
      const pushReg = await navigator.serviceWorker.getRegistration(PUSH_SW_SCOPE);
      const fcmReg = await navigator.serviceWorker.getRegistration(FCM_SW_SCOPE);
      const activeReg =
        pushReg || fcmReg || (await navigator.serviceWorker.getRegistration('/'));
      if (activeReg && activeReg.showNotification) {
        await activeReg.showNotification(title, {
          body,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          dir: 'rtl',
          lang: 'ar',
          tag,
        });
        return;
      }
    }
    new Notification(title, {
      body,
      icon: '/pwa-192x192.png',
      dir: 'rtl',
      lang: 'ar',
      tag,
    });
  } catch {
    // Fallback if browser blocks background Notification constructor
  }
}

export async function attachForegroundFcmListener(
  onPayload: (title: string, body: string) => void
): Promise<(() => void) | null> {
  try {
    const supported = await isSupported();
    if (!supported) return null;
    const messaging = getMessaging(app);
    return onMessage(messaging, (payload) => {
      const title =
        payload.notification?.title ||
        payload.data?.title ||
        'أكاديمية البوب للفنون القتالية';
      const body =
        payload.notification?.body ||
        payload.data?.body ||
        'لديك إشعار جديد من الأكاديمية';
      onPayload(title, body);
    });
  } catch {
    return null;
  }
}

export async function enablePushNotifications(
  profile?: UserProfile | null
): Promise<PushEnableResult> {
  const { isIOS, isStandalone } = detectPlatformState();

  if (isIOS && !isStandalone) {
    return {
      status: 'ios_requires_pwa',
      message:
        'على أجهزة iPhone و iPad يجب أولاً تثبيت التطبيق على الشاشة الرئيسية عبر متصفح Safari ثم فتحه لتفعيل الإشعارات الفورية.',
    };
  }

  if (typeof window === 'undefined' || !('Notification' in window)) {
    return {
      status: 'unsupported',
      message: 'هذا المتصفح لا يدعم إشعارات الدفع الفورية (Web Push).',
    };
  }

  if (Notification.permission === 'denied') {
    return {
      status: 'denied',
      message:
        'تم حظر إذن الإشعارات مسبقاً في إعدادات المتصفح. يرجى السماح بالإشعارات من أيقونة القفل/الإعدادات بجانب عنوان الموقع.',
    };
  }

  try {
    const permission =
      Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission();

    if (permission !== 'granted') {
      return {
        status: 'denied',
        message:
          'لم يتم منح إذن الإشعارات. يمكنك تفعيله في أي وقت من إعدادات المتصفح بجانب رابط الموقع.',
      };
    }

    const webPushRes = await subscribeDeviceToWebPush(profile);
    const backgroundPushRegistered = webPushRes.registered;

    // Also preserve legacy FCM token registration if VITE_FIREBASE_VAPID_KEY is configured
    const swReg = await registerFcmServiceWorker();
    const vapidKey = (import.meta.env.VITE_FIREBASE_VAPID_KEY || '').trim();
    const messagingSupported = await isSupported().catch(() => false);

    let fcmTokenRegistered = false;
    if (messagingSupported && vapidKey && swReg) {
      try {
        const messaging = getMessaging(app);
        const token = await getToken(messaging, {
          vapidKey,
          serviceWorkerRegistration: swReg,
        });
        if (token && profile) {
          await saveFcmTokenToFirestore(profile, token, getPlatformLabel());
          fcmTokenRegistered = true;
        }
      } catch (tokenErr) {
        console.warn('FCM getToken notice:', tokenErr);
      }
    }

    await showLocalPushNotification(
      'أكاديمية البوب للفنون القتالية',
      profile?.role === 'coach'
        ? 'تم تفعيل إشعارات الخلفية لحساب المدرب! ستصلك تنبيهات طلبات التسجيل ورسائل أولياء الأمور حتى عند إغلاق التطبيق.'
        : 'تم تفعيل إشعارات الخلفية بنجاح! ستصلك تنبيهات الحضور والانصراف مباشرة حتى عند إغلاق التطبيق.',
      'alboob-welcome'
    );

    return {
      status: 'enabled',
      fcmTokenRegistered: backgroundPushRegistered || fcmTokenRegistered,
      backgroundPushRegistered,
      message: backgroundPushRegistered
        ? 'تم تفعيل إشعارات الخلفية الفورية وربط هذا الجهاز بنجاح (تعمل حتى عند إغلاق التطبيق).'
        : fcmTokenRegistered
          ? 'تم تفعيل الإشعارات الفورية وربط الجهاز بنجاح.'
          : 'تم تفعيل إشعارات التنبيه الفورية على هذا المتصفح.',
    };
  } catch (err) {
    return {
      status: 'error',
      message:
        err instanceof Error ? err.message : 'حدث خطأ أثناء تفعيل الإشعارات الفورية.',
    };
  }
}
