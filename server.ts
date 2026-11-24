import express, { type Request, type Response } from 'express';
import { getApp, getApps, initializeApp as initializeAdminApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as webpush from 'web-push';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT) || 3000;
const COACH_ADMIN_EMAIL = 'bahermuorad2@gmail.com';
const CAIRO_TZ = 'Africa/Cairo';
const AUTO_REMINDER_START_HOUR = 10;
const AUTO_REMINDER_END_HOUR = 17;

interface FirebaseAppletConfig {
  projectId?: string;
}

function loadFirebaseProjectId(): string {
  try {
    const raw = fs.readFileSync(path.join(__dirname, 'firebase-applet-config.json'), 'utf8');
    const parsed = JSON.parse(raw) as FirebaseAppletConfig;
    return parsed.projectId || '';
  } catch {
    return '';
  }
}

const projectId = loadFirebaseProjectId();
const adminApp = getApps().length
  ? getApp()
  : initializeAdminApp(projectId ? { projectId } : undefined);
const adminAuth = getAuth(adminApp);

const PUSH_DATA_DIR = path.join(__dirname, '.push-data');
const VAPID_FILE = path.join(PUSH_DATA_DIR, 'vapid.json');
const SUBS_FILE = path.join(PUSH_DATA_DIR, 'subscriptions.json');
const HOLIDAYS_FILE = path.join(PUSH_DATA_DIR, 'holidays.json');
const REMINDER_LOG_FILE = path.join(PUSH_DATA_DIR, 'reminder-log.json');

interface VapidKeysConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

interface StoredPushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  uid: string;
  email: string;
  role: 'coach' | 'parent';
  platform: string;
  updatedAt: string;
}

interface StoredHoliday {
  date: string;
  reason: string;
  updatedAt: string;
}

interface ReminderLogEntry {
  sentAt: string;
  sent: number;
  manual?: boolean;
}

function ensurePushDataDir() {
  if (!fs.existsSync(PUSH_DATA_DIR)) {
    fs.mkdirSync(PUSH_DATA_DIR, { recursive: true });
  }
}

function loadOrCreateVapidKeys(): VapidKeysConfig {
  const envPub = (process.env.VAPID_PUBLIC_KEY || '').trim();
  const envPriv = (process.env.VAPID_PRIVATE_KEY || '').trim();
  const envSub = (process.env.VAPID_SUBJECT || 'mailto:bahermuorad2@gmail.com').trim();

  if (envPub && envPriv) {
    return { publicKey: envPub, privateKey: envPriv, subject: envSub };
  }

  ensurePushDataDir();
  if (fs.existsSync(VAPID_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(VAPID_FILE, 'utf8')) as Partial<VapidKeysConfig>;
      if (parsed.publicKey && parsed.privateKey) {
        return {
          publicKey: parsed.publicKey,
          privateKey: parsed.privateKey,
          subject: parsed.subject || envSub,
        };
      }
    } catch {
      // regenerate below
    }
  }

  const generated = webpush.generateVAPIDKeys();
  const config: VapidKeysConfig = {
    publicKey: generated.publicKey,
    privateKey: generated.privateKey,
    subject: envSub,
  };
  fs.writeFileSync(VAPID_FILE, JSON.stringify(config, null, 2), 'utf8');
  return config;
}

const vapidKeys = loadOrCreateVapidKeys();
webpush.setVapidDetails(vapidKeys.subject, vapidKeys.publicKey, vapidKeys.privateKey);

function readSubscriptions(): StoredPushSubscription[] {
  ensurePushDataDir();
  if (!fs.existsSync(SUBS_FILE)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(SUBS_FILE, 'utf8'));
    return Array.isArray(parsed) ? (parsed as StoredPushSubscription[]) : [];
  } catch {
    return [];
  }
}

function writeSubscriptions(subs: StoredPushSubscription[]) {
  ensurePushDataDir();
  fs.writeFileSync(SUBS_FILE, JSON.stringify(subs, null, 2), 'utf8');
}

function readHolidays(): Record<string, StoredHoliday> {
  ensurePushDataDir();
  if (!fs.existsSync(HOLIDAYS_FILE)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(HOLIDAYS_FILE, 'utf8'));
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, StoredHoliday>) : {};
  } catch {
    return {};
  }
}

function writeHolidays(holidays: Record<string, StoredHoliday>) {
  ensurePushDataDir();
  fs.writeFileSync(HOLIDAYS_FILE, JSON.stringify(holidays, null, 2), 'utf8');
}

function readReminderLog(): Record<string, ReminderLogEntry> {
  ensurePushDataDir();
  if (!fs.existsSync(REMINDER_LOG_FILE)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(REMINDER_LOG_FILE, 'utf8'));
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, ReminderLogEntry>) : {};
  } catch {
    return {};
  }
}

function writeReminderLog(log: Record<string, ReminderLogEntry>) {
  ensurePushDataDir();
  fs.writeFileSync(REMINDER_LOG_FILE, JSON.stringify(log, null, 2), 'utf8');
}

function getCairoNowInfo() {
  const now = new Date();
  const dateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: CAIRO_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const dateStr = dateFormatter.format(now);

  const timeParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: CAIRO_TZ,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const weekdayShort = timeParts.find((p) => p.type === 'weekday')?.value || '';
  const hour = Number(timeParts.find((p) => p.type === 'hour')?.value || '0');
  const minute = Number(timeParts.find((p) => p.type === 'minute')?.value || '0');

  const weekdayArabicMap: Record<string, string> = {
    Sun: 'الأحد',
    Mon: 'الإثنين',
    Tue: 'الثلاثاء',
    Wed: 'الأربعاء',
    Thu: 'الخميس',
    Fri: 'الجمعة',
    Sat: 'السبت',
  };

  const isTrainingDay = weekdayShort === 'Mon' || weekdayShort === 'Wed' || weekdayShort === 'Fri';
  return {
    dateStr,
    weekdayShort,
    arabicDayName: weekdayArabicMap[weekdayShort] || weekdayShort,
    isTrainingDay,
    hour,
    minute,
  };
}

interface VerifiedCaller {
  uid: string;
  email: string;
  emailVerified: boolean;
  isCoach: boolean;
}

async function verifyRequestUser(req: Request): Promise<VerifiedCaller | null> {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  if (!token) return null;

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const email = (decoded.email || '').trim().toLowerCase();
    const emailVerified = decoded.email_verified === true;
    return {
      uid: decoded.uid,
      email,
      emailVerified,
      isCoach: emailVerified && email === COACH_ADMIN_EMAIL.toLowerCase(),
    };
  } catch {
    return null;
  }
}

const registrationRateMap = new Map<string, number[]>();
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX_REQUESTS = 8;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const prev = (registrationRateMap.get(ip) || []).filter((ts) => now - ts < RATE_WINDOW_MS);
  if (prev.length >= RATE_MAX_REQUESTS) {
    registrationRateMap.set(ip, prev);
    return true;
  }
  prev.push(now);
  registrationRateMap.set(ip, prev);
  return false;
}

async function sendWebPushBatch(
  targets: Array<{ endpoint: string; keys: { p256dh: string; auth: string } }>,
  payload: { title: string; body: string; url: string; tag: string }
): Promise<{ sent: number; failed: number; prunedEndpoints: string[] }> {
  const uniqueByEndpoint = new Map<
    string,
    { endpoint: string; keys: { p256dh: string; auth: string } }
  >();
  for (const t of targets) {
    if (t.endpoint && t.keys?.p256dh && t.keys?.auth && !uniqueByEndpoint.has(t.endpoint)) {
      uniqueByEndpoint.set(t.endpoint, t);
    }
  }

  const list = Array.from(uniqueByEndpoint.values());
  if (list.length === 0) {
    return { sent: 0, failed: 0, prunedEndpoints: [] };
  }

  const encodedPayload = JSON.stringify({
    title: payload.title.slice(0, 140),
    body: payload.body.slice(0, 400),
    url: payload.url || '/',
    tag: payload.tag || `alboob-${Date.now()}`,
  });

  let sent = 0;
  let failed = 0;
  const prunedEndpoints: string[] = [];

  await Promise.all(
    list.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.keys.p256dh,
              auth: sub.keys.auth,
            },
          },
          encodedPayload,
          { TTL: 60 * 60 * 12 }
        );
        sent += 1;
      } catch (err: unknown) {
        failed += 1;
        const statusCode =
          typeof err === 'object' && err !== null && 'statusCode' in err
            ? Number((err as { statusCode?: unknown }).statusCode)
            : 0;
        if (statusCode === 404 || statusCode === 410) {
          prunedEndpoints.push(sub.endpoint);
        }
      }
    })
  );

  if (prunedEndpoints.length > 0) {
    const pruneSet = new Set(prunedEndpoints);
    const current = readSubscriptions();
    const filtered = current.filter((s) => !pruneSet.has(s.endpoint));
    if (filtered.length !== current.length) {
      writeSubscriptions(filtered);
    }
  }

  return { sent, failed, prunedEndpoints };
}

function isValidPushEndpoint(endpoint: unknown): endpoint is string {
  return (
    typeof endpoint === 'string' &&
    endpoint.startsWith('https://') &&
    endpoint.length >= 12 &&
    endpoint.length <= 1000
  );
}

function makeFallbackTag(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

async function sendAutomaticTrainingReminder(options?: {
  force?: boolean;
  extraSubscriptions?: Array<{ endpoint: string; keys: { p256dh: string; auth: string } }>;
}): Promise<{ skipped: boolean; reason?: string; sent: number; dateStr: string }> {
  const cairo = getCairoNowInfo();
  const holidays = readHolidays();
  const log = readReminderLog();

  if (holidays[cairo.dateStr] && !options?.force) {
    return { skipped: true, reason: 'holiday', sent: 0, dateStr: cairo.dateStr };
  }

  if (!options?.force) {
    if (!cairo.isTrainingDay) {
      return { skipped: true, reason: 'not_training_day', sent: 0, dateStr: cairo.dateStr };
    }
    if (cairo.hour < AUTO_REMINDER_START_HOUR || cairo.hour >= AUTO_REMINDER_END_HOUR) {
      return { skipped: true, reason: 'outside_window', sent: 0, dateStr: cairo.dateStr };
    }
    if (log[cairo.dateStr]) {
      return { skipped: true, reason: 'already_sent', sent: log[cairo.dateStr].sent, dateStr: cairo.dateStr };
    }
  }

  const parentSubs = readSubscriptions()
    .filter((s) => s.role === 'parent')
    .map((s) => ({ endpoint: s.endpoint, keys: s.keys }));

  const targets = [...parentSubs, ...(options?.extraSubscriptions || [])];

  const title = `تذكير بموعد تمرين اليوم (${cairo.arabicDayName}) · أكاديمية البوب`;
  const body = `نذكركم بوجود تمرين اليوم (${cairo.arabicDayName}) الساعة 5:00 مساءً لجميع الألعاب (كيك بوكسينج · كونغ فو · MMA) في أكاديمية البوب مع كابتن باهر مراد.`;

  const result = await sendWebPushBatch(targets, {
    title,
    body,
    url: '/',
    tag: `training-reminder-${cairo.dateStr}`,
  });

  if (result.sent > 0 || options?.force || targets.length === 0) {
    log[cairo.dateStr] = {
      sentAt: new Date().toISOString(),
      sent: result.sent,
      manual: Boolean(options?.force),
    };
    writeReminderLog(log);
  }

  return { skipped: false, sent: result.sent, dateStr: cairo.dateStr };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '64kb' }));

  app.get('/api/push/vapid-public-key', (_req: Request, res: Response) => {
    res.json({ publicKey: vapidKeys.publicKey });
  });

  app.get('/api/push/schedule-status', (_req: Request, res: Response) => {
    const cairo = getCairoNowInfo();
    const holidays = readHolidays();
    const log = readReminderLog();
    const todayHoliday = holidays[cairo.dateStr] || null;
    const todayLog = log[cairo.dateStr] || null;
    const parentCount = readSubscriptions().filter((s) => s.role === 'parent').length;

    res.json({
      todayDate: cairo.dateStr,
      arabicDayName: cairo.arabicDayName,
      isTrainingDay: cairo.isTrainingDay,
      isHoliday: Boolean(todayHoliday),
      holidayReason: todayHoliday?.reason || '',
      autoReminderHourCairo: AUTO_REMINDER_START_HOUR,
      autoReminderSentToday: Boolean(todayLog),
      autoReminderSentAt: todayLog?.sentAt || null,
      registeredParentDevices: parentCount,
    });
  });

  app.post('/api/push/subscribe', async (req: Request, res: Response) => {
    const caller = await verifyRequestUser(req);
    if (!caller) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const body = req.body as {
      subscription?: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
      platform?: unknown;
    };

    const endpoint = body?.subscription?.endpoint;
    const p256dh = body?.subscription?.keys?.p256dh;
    const authKey = body?.subscription?.keys?.auth;
    const platform =
      typeof body?.platform === 'string' && body.platform.trim()
        ? body.platform.trim().slice(0, 40)
        : 'web';

    if (
      !isValidPushEndpoint(endpoint) ||
      typeof p256dh !== 'string' ||
      p256dh.length < 10 ||
      p256dh.length > 300 ||
      typeof authKey !== 'string' ||
      authKey.length < 8 ||
      authKey.length > 200
    ) {
      res.status(400).json({ error: 'Invalid Web Push subscription payload' });
      return;
    }

    const subs = readSubscriptions().filter((s) => s.endpoint !== endpoint);
    subs.push({
      endpoint,
      keys: { p256dh, auth: authKey },
      uid: caller.uid,
      email: caller.email,
      role: caller.isCoach ? 'coach' : 'parent',
      platform,
      updatedAt: new Date().toISOString(),
    });
    writeSubscriptions(subs);

    res.json({ ok: true, role: caller.isCoach ? 'coach' : 'parent' });
  });

  app.post('/api/push/unsubscribe', async (req: Request, res: Response) => {
    const caller = await verifyRequestUser(req);
    if (!caller) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const body = req.body as { endpoint?: unknown; all?: unknown };
    const endpoint = typeof body?.endpoint === 'string' ? body.endpoint : '';
    const all = body?.all === true;

    const current = readSubscriptions();
    const next = current.filter((s) => {
      if (s.uid !== caller.uid) return true;
      if (all) return false;
      return s.endpoint !== endpoint;
    });
    writeSubscriptions(next);

    res.json({ ok: true, removed: current.length - next.length });
  });

  app.post('/api/push/sync-schedule', async (req: Request, res: Response) => {
    const caller = await verifyRequestUser(req);
    if (!caller || !caller.isCoach) {
      res.status(403).json({ error: 'Forbidden: Coach authentication required' });
      return;
    }

    const body = req.body as {
      holidays?: Array<{ date?: unknown; reason?: unknown }>;
      subscriptions?: Array<{
        uid?: unknown;
        email?: unknown;
        role?: unknown;
        endpoint?: unknown;
        p256dh?: unknown;
        auth?: unknown;
        platform?: unknown;
      }>;
    };

    if (Array.isArray(body?.holidays)) {
      const nextHolidays: Record<string, StoredHoliday> = {};
      for (const h of body.holidays) {
        if (typeof h?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(h.date)) {
          nextHolidays[h.date] = {
            date: h.date,
            reason: typeof h.reason === 'string' ? h.reason.slice(0, 200) : '',
            updatedAt: new Date().toISOString(),
          };
        }
      }
      writeHolidays(nextHolidays);
    }

    if (Array.isArray(body?.subscriptions)) {
      const current = readSubscriptions();
      const byEndpoint = new Map<string, StoredPushSubscription>(
        current.map((s) => [s.endpoint, s])
      );
      for (const item of body.subscriptions) {
        if (
          isValidPushEndpoint(item?.endpoint) &&
          typeof item?.p256dh === 'string' &&
          item.p256dh.length >= 10 &&
          typeof item?.auth === 'string' &&
          item.auth.length >= 8 &&
          typeof item?.uid === 'string' &&
          item.uid.length > 0
        ) {
          if (!byEndpoint.has(item.endpoint)) {
            byEndpoint.set(item.endpoint, {
              endpoint: item.endpoint,
              keys: { p256dh: item.p256dh, auth: item.auth },
              uid: item.uid,
              email: typeof item.email === 'string' ? item.email : '',
              role: item.role === 'coach' ? 'coach' : 'parent',
              platform: typeof item.platform === 'string' ? item.platform : 'web',
              updatedAt: new Date().toISOString(),
            });
          }
        }
      }
      writeSubscriptions(Array.from(byEndpoint.values()));
    }

    // Check if an automatic reminder is pending for today after syncing
    await sendAutomaticTrainingReminder().catch(() => {});

    res.json({ ok: true });
  });

  app.post('/api/push/set-holiday', async (req: Request, res: Response) => {
    const caller = await verifyRequestUser(req);
    if (!caller || !caller.isCoach) {
      res.status(403).json({ error: 'Forbidden: Coach authentication required' });
      return;
    }

    const body = req.body as {
      date?: unknown;
      isHoliday?: unknown;
      reason?: unknown;
    };

    const date = typeof body?.date === 'string' ? body.date.trim() : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: 'Invalid date format (YYYY-MM-DD)' });
      return;
    }

    const holidays = readHolidays();
    if (body?.isHoliday === false) {
      delete holidays[date];
    } else {
      holidays[date] = {
        date,
        reason: typeof body?.reason === 'string' ? body.reason.trim().slice(0, 200) : '',
        updatedAt: new Date().toISOString(),
      };
    }
    writeHolidays(holidays);
    res.json({ ok: true, date, isHoliday: body?.isHoliday !== false });
  });

  app.post('/api/push/trigger-training-reminder', async (req: Request, res: Response) => {
    const caller = await verifyRequestUser(req);
    if (!caller || !caller.isCoach) {
      res.status(403).json({ error: 'Forbidden: Coach authentication required' });
      return;
    }

    const body = req.body as {
      fallbackSubscriptions?: Array<{ endpoint?: unknown; p256dh?: unknown; auth?: unknown }>;
    };

    const extras: Array<{ endpoint: string; keys: { p256dh: string; auth: string } }> = [];
    if (Array.isArray(body?.fallbackSubscriptions)) {
      for (const fb of body.fallbackSubscriptions) {
        if (
          isValidPushEndpoint(fb?.endpoint) &&
          typeof fb?.p256dh === 'string' &&
          fb.p256dh.length >= 10 &&
          typeof fb?.auth === 'string' &&
          fb.auth.length >= 8
        ) {
          extras.push({
            endpoint: fb.endpoint,
            keys: { p256dh: fb.p256dh, auth: fb.auth },
          });
        }
      }
    }

    const result = await sendAutomaticTrainingReminder({
      force: true,
      extraSubscriptions: extras,
    });
    res.json({ ok: true, ...result });
  });

  app.post('/api/push/send-parents', async (req: Request, res: Response) => {
    const caller = await verifyRequestUser(req);
    if (!caller || !caller.isCoach) {
      res.status(403).json({ error: 'Forbidden: Coach authentication required' });
      return;
    }

    const body = req.body as {
      title?: unknown;
      body?: unknown;
      url?: unknown;
      tag?: unknown;
      targets?: Array<{ parentUid?: unknown; parentEmail?: unknown }>;
      fallbackSubscriptions?: Array<{ endpoint?: unknown; p256dh?: unknown; auth?: unknown }>;
    };

    const title =
      typeof body?.title === 'string' && body.title.trim()
        ? body.title.trim().slice(0, 140)
        : 'أكاديمية البوب للفنون القتالية';
    const messageBody = typeof body?.body === 'string' ? body.body.trim().slice(0, 400) : '';
    if (!messageBody) {
      res.status(400).json({ error: 'Missing notification body' });
      return;
    }
    const url = typeof body?.url === 'string' && body.url.startsWith('/') ? body.url : '/';
    const tag =
      typeof body?.tag === 'string' && body.tag.trim()
        ? body.tag.trim().slice(0, 80)
        : makeFallbackTag('parent');

    const targetUids = new Set<string>();
    const targetEmails = new Set<string>();
    if (Array.isArray(body?.targets)) {
      for (const t of body.targets) {
        if (typeof t?.parentUid === 'string' && t.parentUid.trim()) {
          targetUids.add(t.parentUid.trim());
        }
        if (typeof t?.parentEmail === 'string' && t.parentEmail.trim()) {
          targetEmails.add(t.parentEmail.trim().toLowerCase());
        }
      }
    }

    const stored = readSubscriptions().filter(
      (s) =>
        s.role === 'parent' &&
        (targetUids.has(s.uid) || (s.email && targetEmails.has(s.email.toLowerCase())))
    );

    const targets: Array<{ endpoint: string; keys: { p256dh: string; auth: string } }> = stored.map(
      (s) => ({ endpoint: s.endpoint, keys: s.keys })
    );

    if (Array.isArray(body?.fallbackSubscriptions)) {
      for (const fb of body.fallbackSubscriptions) {
        if (
          isValidPushEndpoint(fb?.endpoint) &&
          typeof fb?.p256dh === 'string' &&
          fb.p256dh.length >= 10 &&
          typeof fb?.auth === 'string' &&
          fb.auth.length >= 8
        ) {
          targets.push({
            endpoint: fb.endpoint,
            keys: { p256dh: fb.p256dh, auth: fb.auth },
          });
        }
      }
    }

    const result = await sendWebPushBatch(targets, {
      title,
      body: messageBody,
      url,
      tag,
    });
    res.json({ ok: true, ...result });
  });

  app.post('/api/push/notify-coach', async (req: Request, res: Response) => {
    const body = req.body as {
      kind?: unknown;
      title?: unknown;
      body?: unknown;
      url?: unknown;
      tag?: unknown;
      parentPhone?: unknown;
    };

    const kind = body?.kind;
    if (
      kind !== 'parent_message' &&
      kind !== 'registration_request' &&
      kind !== 'catalog_photo'
    ) {
      res.status(400).json({ error: 'Invalid notification kind' });
      return;
    }

    if (kind === 'parent_message' || kind === 'catalog_photo') {
      const caller = await verifyRequestUser(req);
      if (!caller) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
    } else {
      const phone = typeof body?.parentPhone === 'string' ? body.parentPhone.trim() : '';
      if (phone.length < 8 || phone.length > 20 || !/^[0-9+\-\s]+$/.test(phone)) {
        res.status(400).json({ error: 'Invalid parent phone number' });
        return;
      }
      const clientIp =
        (typeof req.headers['x-forwarded-for'] === 'string'
          ? req.headers['x-forwarded-for'].split(',')[0].trim()
          : '') ||
        req.ip ||
        'unknown';
      if (isRateLimited(clientIp)) {
        res.status(429).json({ error: 'Too many requests' });
        return;
      }
    }

    const title = typeof body?.title === 'string' ? body.title.trim().slice(0, 140) : '';
    const messageBody = typeof body?.body === 'string' ? body.body.trim().slice(0, 400) : '';
    if (!title || !messageBody) {
      res.status(400).json({ error: 'Missing title or body' });
      return;
    }

    const url = typeof body?.url === 'string' && body.url.startsWith('/') ? body.url : '/';
    const tag =
      typeof body?.tag === 'string' && body.tag.trim()
        ? body.tag.trim().slice(0, 80)
        : makeFallbackTag('coach');

    const coachSubs = readSubscriptions().filter(
      (s) => s.role === 'coach' && s.email.toLowerCase() === COACH_ADMIN_EMAIL.toLowerCase()
    );

    const result = await sendWebPushBatch(
      coachSubs.map((s) => ({ endpoint: s.endpoint, keys: s.keys })),
      { title, body: messageBody, url, tag }
    );
    res.json({ ok: true, ...result });
  });

  app.post('/api/push/test', async (req: Request, res: Response) => {
    const caller = await verifyRequestUser(req);
    if (!caller) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const body = req.body as {
      currentSubscription?: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
    };

    const userSubs = readSubscriptions()
      .filter((s) => s.uid === caller.uid)
      .map((s) => ({ endpoint: s.endpoint, keys: s.keys }));

    const cur = body?.currentSubscription;
    if (
      isValidPushEndpoint(cur?.endpoint) &&
      typeof cur?.keys?.p256dh === 'string' &&
      cur.keys.p256dh.length >= 10 &&
      typeof cur?.keys?.auth === 'string' &&
      cur.keys.auth.length >= 8
    ) {
      userSubs.push({
        endpoint: cur.endpoint,
        keys: { p256dh: cur.keys.p256dh, auth: cur.keys.auth },
      });
    }

    const result = await sendWebPushBatch(userSubs, {
      title: 'أكاديمية البوب للفنون القتالية',
      body: caller.isCoach
        ? 'تم التحقق بنجاح! ستصلك إشعارات طلبات التسجيل ورسائل أولياء الأمور في الخلفية حتى عند إغلاق التطبيق.'
        : 'تم التحقق بنجاح! ستصلك إشعارات التذكير بالتمرين والحضور والانصراف والاشتراكات في الخلفية حتى عند إغلاق التطبيق.',
      url: '/',
      tag: 'alboob-push-test',
    });

    res.json({ ok: true, ...result });
  });

  // Automatic Training-Day Reminder Scheduler (Mon/Wed/Fri at 10:00-17:00 Cairo time)
  setTimeout(() => {
    void sendAutomaticTrainingReminder().catch(() => {});
  }, 5000);
  setInterval(() => {
    void sendAutomaticTrainingReminder().catch(() => {});
  }, 60 * 1000);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, ws: false },
      appType: 'spa',
    });
    app.get('/@vite/client', async (_req, res, next) => {
      try {
        const result = await vite.transformRequest('/@vite/client');
        if (!result) {
          next();
          return;
        }
        const patched = result.code
          .replace(
            'transport.connect(createHMRHandler(handleMessage));',
            '/* HMR disabled in preview */'
          )
          .replace(
            'else throw new SendBeforeConnectError("send was called before connect");',
            'else return;'
          );
        res.type('application/javascript').send(patched);
      } catch (err) {
        next(err);
      }
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Al-Pop Martial Arts Academy server listening on http://localhost:${PORT}`);
  });
}

startServer();
