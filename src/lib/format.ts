export function formatArabicTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('ar-EG', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(iso));
  } catch {
    return '—';
  }
}

export function formatArabicDate(dateStr: string): string {
  try {
    const dt = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00`);
    return new Intl.DateTimeFormat('ar-EG', {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
    }).format(dt);
  } catch {
    return dateStr;
  }
}

export function formatArabicMonth(monthStr: string): string {
  try {
    const dt = new Date(`${monthStr}-01T12:00:00`);
    return new Intl.DateTimeFormat('ar-EG', {
      month: 'long',
      year: 'numeric',
    }).format(dt);
  } catch {
    return monthStr;
  }
}

export function formatCurrencyEGP(amount: number): string {
  return `${amount.toLocaleString('en-US')} ج.م`;
}

export function getCurrentMonthString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function getTodayDateString(): string {
  try {
    const formatted = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Cairo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    if (/^\d{4}-\d{2}-\d{2}$/.test(formatted)) {
      return formatted;
    }
  } catch {
    // fallback below
  }
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isTrainingDayDate(dateStr: string): boolean {
  try {
    const dt = new Date(`${dateStr}T12:00:00Z`);
    const day = dt.getUTCDay();
    // Monday (1), Wednesday (3), Friday (5)
    return day === 1 || day === 3 || day === 5;
  } catch {
    return false;
  }
}

export function getArabicWeekdayName(dateStr: string): string {
  try {
    const dt = new Date(`${dateStr}T12:00:00Z`);
    const names = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    return names[dt.getUTCDay()] || dateStr;
  } catch {
    return dateStr;
  }
}

export function generateAthleteCode(): string {
  const num = 10000 + Math.floor(Math.random() * 90000);
  return `ALB-${num}`;
}

export function getAthleteDisplayCode(athlete: {
  id: string;
  athleteCode?: string;
}): string {
  const explicit = (athlete.athleteCode || '').trim();
  if (explicit) return explicit;
  let hash = 0;
  for (let i = 0; i < athlete.id.length; i += 1) {
    hash = (hash * 31 + athlete.id.charCodeAt(i)) % 90000;
  }
  return `ALB-${10000 + Math.abs(hash)}`;
}

export function getNextTrainingSessionInfo(
  todayStr: string,
  holidays: Array<{ date: string; reason?: string }>
): {
  date: string;
  arabicDate: string;
  weekdayName: string;
  isToday: boolean;
  timeLabel: string;
} {
  const holidaySet = new Set(holidays.map((h) => h.date));
  const base = new Date(`${todayStr}T12:00:00Z`);

  for (let offset = 0; offset <= 14; offset += 1) {
    const candidate = new Date(base.getTime() + offset * 86400000);
    const y = candidate.getUTCFullYear();
    const m = String(candidate.getUTCMonth() + 1).padStart(2, '0');
    const d = String(candidate.getUTCDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    if (isTrainingDayDate(dateStr) && !holidaySet.has(dateStr)) {
      return {
        date: dateStr,
        arabicDate: formatArabicDate(dateStr),
        weekdayName: getArabicWeekdayName(dateStr),
        isToday: offset === 0,
        timeLabel: '5:00 مساءً',
      };
    }
  }

  return {
    date: todayStr,
    arabicDate: formatArabicDate(todayStr),
    weekdayName: getArabicWeekdayName(todayStr),
    isToday: false,
    timeLabel: '5:00 مساءً',
  };
}

export const DEFAULT_MONTHLY_FEE = 250;

export const DISCIPLINES = ['كيك بوكسينج', 'كونغ فو', 'MMA'] as const;

export const PAYMENT_METHODS = [
  'نقدي',
  'إنستاباي',
  'فودافون كاش',
  'تحويل بنكي',
] as const;


