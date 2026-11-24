export type UserRole = 'coach' | 'parent';

export type Discipline = 'كيك بوكسينج' | 'كونغ فو' | 'MMA';

export type AttendanceStatus = 'present' | 'checked_out' | 'absent';

export type PaymentMethod =
  | 'نقدي'
  | 'إنستاباي'
  | 'فودافون كاش'
  | 'تحويل بنكي';

export type NotificationType =
  | 'check_in'
  | 'check_out'
  | 'absent'
  | 'payment'
  | 'general'
  | 'holiday';

export interface UserProfile {
  uid: string;
  role: UserRole;
  fullName: string;
  phone: string;
  email: string;
  createdAtIso?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Athlete {
  id: string;
  athleteCode?: string;
  parentUid: string;
  parentEmail: string;
  parentName: string;
  parentPhone: string;
  fullName: string;
  age: number;
  discipline: Discipline;
  groupSchedule: string;
  monthlyFee: number;
  medicalNotes: string;
  active: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AttendanceRecord {
  id: string;
  athleteId: string;
  parentUid: string;
  parentEmail: string;
  date: string;
  month: string;
  status: AttendanceStatus;
  checkInTime: string;
  checkOutTime: string;
  coachNote: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PaymentRecord {
  id: string;
  athleteId: string;
  parentUid: string;
  parentEmail: string;
  month: string;
  amount: number;
  method: PaymentMethod;
  paidAt: string;
  recordedBy: string;
  notes: string;
  createdAt?: unknown;
}

export interface AcademyNotification {
  id: string;
  parentUid: string;
  parentEmail: string;
  athleteId: string;
  athleteName: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAtIso?: string;
  createdAt?: unknown;
}

export interface ParentMessage {
  id: string;
  parentUid: string;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
  athleteId: string;
  athleteName: string;
  subject: string;
  message: string;
  readByCoach: boolean;
  coachReply: string;
  repliedAt: string;
  createdAtIso?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type RegistrationRequestStatus = 'pending' | 'contacted' | 'approved' | 'rejected';

export interface RegistrationRequest {
  id: string;
  parentName: string;
  parentPhone: string;
  athleteName: string;
  age: number;
  discipline: Discipline;
  monthlyFee: number;
  notes: string;
  status: RegistrationRequestStatus;
  coachNote: string;
  linkedAthleteId: string;
  createdAtIso?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface MonthlyAthleteSummary {
  athleteId: string;
  athleteName: string;
  parentName: string;
  parentPhone: string;
  discipline: Discipline;
  monthlyFee: number;
  presentDays: number;
  absentDays: number;
  totalSessions: number;
  attendanceRate: number;
  paidAmount: number;
  isPaid: boolean;
  lastPaymentDate: string | null;
  lastCheckIn: string | null;
  lastCheckOut: string | null;
}

export interface MonthlyReportResponse {
  month: string;
  totalAthletes: number;
  totalPresentRecords: number;
  totalAbsentRecords: number;
  paidCount: number;
  unpaidCount: number;
  totalRevenue: number;
  expectedRevenue: number;
  summaries: MonthlyAthleteSummary[];
}

export interface PushSubscriptionDoc {
  id: string;
  uid: string;
  email: string;
  role: UserRole;
  endpoint: string;
  p256dh: string;
  auth: string;
  platform: string;
  updatedAt?: unknown;
}

export interface AcademyHoliday {
  id: string;
  date: string;
  reason: string;
  createdAt?: unknown;
}

export type CatalogCategory = 'champions' | 'coach' | 'training' | 'identity';

export type CatalogPhotoStatus = 'pending' | 'approved' | 'rejected';

export interface CatalogPhotoItem {
  id: string;
  title: string;
  caption: string;
  category: CatalogCategory;
  imageUrl: string;
  status: CatalogPhotoStatus;
  submittedByUid: string;
  submittedByName: string;
  submittedByRole: UserRole;
  athleteId: string;
  athleteName: string;
  coachNote: string;
  createdAtIso?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}


