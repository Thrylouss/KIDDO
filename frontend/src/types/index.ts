export type Role = "super_admin" | "admin" | "teacher" | "parent";

export interface Plan {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  price_monthly: string;       // was "price: string" before
  price_yearly: string | null;
  currency: string;
  trial_days: number;
  max_children: number | null;
  max_teachers: number | null;
  max_groups: number | null;
  features: string[];
  is_active: boolean;
  sort_order: number;
  subscriptions_count?: number;
}

export interface Subscription {
  id: number;
  status: "active" | "trial" | "past_due" | "expired" | "cancelled";  // past_due replaces pending_payment
  ends_at: string | null;        // was expires_at
  trial_ends_at: string | null;  // NEW
  days_remaining: number;
  plan: { id: number; name: string; price_monthly?: string } | null;
}

export interface FullSubscription extends Subscription {
  organization_id: number;
  organization: { id: number; name: string } | null;
  plan_id: number;
  starts_at: string | null;
  auto_renew: boolean;
  cancelled_at: string | null;
  cancelled_reason: string | null;
  is_expiring_soon: boolean;
  created_at: string;
}

/** Tashkilot turi (faollik holatidan alohida). */
export type OrgType = "davlat" | "xususiy";
/** Faollik holati (SaaS obuna holati — subscription'da, alohida). */
export type OrgStatus = "active" | "inactive" | "suspended" | "archived";

export interface OrganizationSummary {
  id: number;
  name: string;
  type?: OrgType | null;
  type_label?: string | null;
  official_code?: string | null;
  phone: string | null;
  email?: string | null;
  website?: string | null;
  region?: string | null;
  street?: string | null;
  director_email?: string | null;
  notes?: string | null;
  status?: OrgStatus;
  status_label?: string;
  status_reason?: string | null;
  suspended_until?: string | null;
  status_changed_at?: string | null;
  address: string | null;
  /** DMTT reyestri maydonlari (Excel import) */
  district?: string | null;
  number?: string | null;
  mfy?: string | null;
  capacity?: number | null;
  director_name?: string | null;
  director_phone?: string | null;
  /** Test/demo tashkilot (DEV TEST MODE) — platforma statistikasiga qo'shilmaydi */
  is_demo?: boolean;
  is_active: boolean;
  created_at: string;
  admin: { id: number; name: string; phone: string | null; username?: string | null } | null;
  subscription: Subscription | null;
  /** Faqat ro'yxat endpointi qaytaradi (faol guruh/tarbiyachilar). */
  children_count?: number | null;
  groups_count?: number | null;
  teachers_count?: number | null;
}

/** Bugungi davomat agregati (bola darajasidagi yozuvlarsiz). */
export interface AttendanceTotals {
  sana: string;
  jami: number;
  keldi: number;
  kelmadi: number;
  sababli: number;
  belgilanmagan: number;
}

export interface OrganizationDetail extends OrganizationSummary {
  admins: (Pick<User, "id" | "name" | "phone" | "email" | "is_active"> & {
    username?: string | null;
    must_change_password?: boolean;
    last_login_at?: string | null;
  })[];
  groups_count: number;
  children_count: number;
  teacher_profiles_count: number;
  parent_profiles_count: number;
  bugungi_davomat?: AttendanceTotals;
  status_changed_by?: string | null;
}

/** Bog'chalar sahifasi statistikasi (haqiqiy ma'lumotlar). */
export interface OrgStats {
  total: number;
  davlat: number;
  xususiy: number;
  turi_yoq: number;
  active: number;
  inactive: number;
  suspended: number;
  archived: number;
  recent: { id: number; name: string; type: OrgType | null; district: string | null; status: OrgStatus; created_at: string }[];
}

export interface OrgFilterOptions {
  districts: string[];
  regions: string[];
  mfys: string[];
  /** directory — tasdiqlangan hududiy ma'lumotnoma; organizations — bazadagi bog'chalar qiymatlari */
  source?: "directory" | "organizations";
}

export interface OrgStatusChange {
  id: number;
  from_status: OrgStatus | null;
  to_status: OrgStatus;
  from_label: string | null;
  to_label: string;
  reason: string | null;
  suspended_until: string | null;
  changed_by: string | null;
  created_at: string;
}

export interface OrgGroupRow {
  id: number;
  name: string;
  age_category: string | null;
  capacity: number | null;
  is_active: boolean;
  children_count: number;
  teachers: string[];
}

export interface OrgTeacherRow {
  id: number;
  name: string | null;
  phone: string | null;
  username: string | null;
  is_active: boolean;
  last_login_at: string | null;
  groups: string[];
}

export interface OrgChildrenSummary {
  jami: number;
  faol: number;
  nofaol: number;
  jins: { ogil: number; qiz: number };
  guruhlar: { group: string; count: number }[];
  yosh: { age: number | null; count: number }[];
}

export interface PlatformSummary {
  jami_bogchalar: number;
  faol_bogchalar: number;
  muddati_yaqin: number;
  tolov_kutilmoqda: number;
  oxirgi_bogchalar: OrganizationSummary[];
  obuna_holati: {
    active: number;
    trial: number;
    past_due: number;     // was pending_payment
    expired: number;
    cancelled: number;
  };
  billing?: {
    mrr: number;
    arr: number;
    monthly_revenue: number;
    pending_revenue: number;
  };
}

export interface User {
  id: number;
  name: string;
  /** Foydalanuvchi nomi (login); telefon orqali kiradiganlarda null */
  username?: string | null;
  /** Vaqtinchalik parol bilan kirgan — avval parolni almashtirishi kerak */
  must_change_password?: boolean;
  phone: string | null;
  email: string | null;
  role: Role;
  organization_id: number | null;
  is_active: boolean;
  created_at: string;
}

export interface Organization {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Group {
  id: number;
  organization_id: number;
  name: string;
  age_category: string | null;
  capacity: number | null;
  is_active: boolean;
  children_count?: number;
  teacher_profiles_count?: number;
}

export interface Child {
  id: number;
  organization_id: number;
  group_id: number | null;
  first_name: string;
  last_name: string;
  birth_date: string;
  gender: "erkak" | "ayol";
  is_active: boolean;
  group?: Pick<Group, "id" | "name"> | null;
}

// ── Davomat ─────────────────────────────────────────────────────────────────

export type AttendanceState = "present" | "absent" | "excused";

export type ExcuseReason = "kasallik" | "oilaviy" | "boshqa";

export interface AttendanceChild {
  id: number;
  first_name: string;
  last_name: string;
  status: AttendanceState | null;
  /** Faqat «Sababli» uchun (kasallik, oilaviy, boshqa). */
  excuse_reason?: ExcuseReason | null;
  note: string | null;
}

export interface AttendanceSummary {
  total: number;
  present: number;
  absent: number;
  excused: number;
  unmarked: number;
}

/** GET /v1/admin/attendance va GET /v1/teacher/dashboard javobining umumiy qismi. */
export interface AttendanceDay {
  groups: Pick<Group, "id" | "name">[];
  group: (Pick<Group, "id" | "name" | "age_category" | "capacity">) | null;
  date: string;
  editable: boolean;
  editable_from: string;
  children: AttendanceChild[];
  summary: AttendanceSummary | null;
}

// ── Kundalik faoliyat (GET/PUT /v1/{teacher|admin}/daily) ───────────────────

export type MealType = "nonushta" | "ikkinchi_nonushta" | "tushlik" | "peshinlik" | "kechki_ovqat";

export interface DailyMeal {
  id: number;
  meal_type: MealType;
  served_at: string;   // "HH:MM"
  /** false — bola ovqatlanmagan. */
  ate: boolean;
  note: string | null;
}

export interface DailySleep {
  id: number;
  started_at: string;
  ended_at: string | null;
  note: string | null;
  is_sleeping: boolean;
  status_text: string | null;
}

export type ActivityDirection = "jismoniy" | "nutq" | "matematika" | "tasviriy" | "musiqa" | "atrof_olam" | "ijtimoiy" | "boshqa";

export interface DailyActivity {
  id: number;
  title: string;
  direction: ActivityDirection | null;
  description: string | null;
  result: string | null;
  starts_at: string | null;
  ends_at: string | null;
  duration_minutes: number | null;
  participants: { id: number; first_name: string; last_name: string }[];
}

/** GET /v1/teacher/children/{id}/history */
export interface ChildHistory {
  from: string;
  to: string;
  days: {
    date: string;
    attendance: AttendanceState | null;
    excuse_reason: ExcuseReason | null;
    note: string | null;
    meals: { meal_type: MealType; served_at: string; ate: boolean; note: string | null }[];
    sleep: { started_at: string; ended_at: string | null; note: string | null; is_sleeping: boolean; status_text: string | null } | null;
    activities: { title: string; starts_at: string | null }[];
  }[];
}

// ── Xabarlar (GET/POST /v1/teacher/messages) ────────────────────────────────

export interface SentMessage {
  id: number;
  audience: "child" | "group";
  group: { id: number; name: string } | null;
  child: { id: number; first_name: string; last_name: string } | null;
  sender: string | null;
  subject: string | null;
  body: string;
  created_at: string;
  recipients_count: number;
  read_count: number;
  recipients: { name: string | null; child: string | null; read_at: string | null }[];
}

export interface DailyChild {
  id: number;
  first_name: string;
  last_name: string;
  attendance: AttendanceState | null;
  meals: DailyMeal[];
  sleep: DailySleep | null;
}

export interface DailyDay {
  groups: Pick<Group, "id" | "name">[];
  group: Pick<Group, "id" | "name"> | null;
  date: string;
  editable: boolean;
  editable_from: string;
  meal_types: MealType[];
  children: DailyChild[];
  activities: DailyActivity[];
  message?: string;
}

export interface TeacherDashboard extends AttendanceDay {
  teacher: { id: number; name: string; position: string | null };
}

export interface AttendanceRecordInput {
  child_id: number;
  status: AttendanceState;
  excuse_reason?: ExcuseReason | null;
  note: string | null;
}

// ── Oylik davomat (GET /v1/{teacher|admin}/attendance/monthly) ──────────────

export interface MonthlyAttendanceCell {
  status: AttendanceState;
  excuse_reason: ExcuseReason | null;
  note: string | null;
}

export interface MonthlyTotals {
  present: number;
  absent: number;
  excused: number;
  unmarked: number;
}

export interface MonthlyAttendance {
  organization: { name: string | null };
  group: { id: number; name: string };
  groups: { id: number; name: string }[];
  month: string;
  from: string;
  to: string;
  days: { date: string; day: number; weekday: number; weekend: boolean; future: boolean }[];
  children: {
    id: number;
    first_name: string;
    last_name: string;
    middle_name: string | null;
    days: Record<string, MonthlyAttendanceCell>;
    totals: MonthlyTotals;
  }[];
  totals: MonthlyTotals & { working_days: number };
  excused_notes: { date: string; child_id: number; child_name: string; reason: ExcuseReason | null; note: string | null }[];
}

// ── Tarbiyachi: guruh bolalari (GET /v1/teacher/children) ───────────────────

export interface TeacherChild {
  id: number;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  birth_date: string;
  gender: "erkak" | "ayol";
  is_active: boolean;
  photo_url: string | null;
  group: { id: number; name: string; age_category: string | null } | null;
  contact: { name: string; phone: string } | null;
}

export interface TeacherChildProfile extends TeacherChild {
  admitted_at: string | null;
  medical_notes: string | null;
  parents: { id: number; first_name: string; last_name: string; phone: string; relation_type: ParentRelation; is_primary: boolean }[];
}

/** GET /v1/parent/children/{id}/attendance */
export interface ParentAttendance {
  child: { id: number; first_name: string; last_name: string };
  from: string;
  to: string;
  records: { date: string; status: AttendanceState; note: string | null }[];
  summary: { present: number; absent: number; excused: number };
}

/** GET /v1/parent/children — ota-onaga bog'langan farzand. */
export interface ParentChild {
  id: number;
  first_name: string;
  last_name: string;
  birth_date: string;
  gender: "erkak" | "ayol";
  is_active: boolean;
  relation_type: string;
  group: Pick<Group, "id" | "name"> | null;
}

export interface TeacherProfile {
  id: number;
  user_id: number;
  organization_id: number;
  first_name: string;
  last_name: string;
  /** Username bilan kiradigan tarbiyachida null bo'lishi mumkin */
  phone: string | null;
  position: string;
  is_active: boolean;
  groups?: Pick<Group, "id" | "name">[];
  user?: { id: number; username?: string | null; must_change_password?: boolean; last_login_at?: string | null } | null;
}

export type ParentRelation = "ona" | "ota" | "vasiy";

/** child_parent jadvalidagi bog'lanish ma'lumoti (GET /v1/admin/parents → children[].pivot). */
export interface ParentChildLink {
  relation_type: ParentRelation;
  is_primary: boolean;
}

export interface ParentProfile {
  id: number;
  user_id: number | null;
  organization_id: number;
  first_name: string;
  last_name: string;
  /** Username bilan kiradigan ota-onada null bo'lishi mumkin */
  phone: string | null;
  relation_type: ParentRelation;
  children?: (Pick<Child, "id" | "first_name" | "last_name"> & { pivot?: ParentChildLink })[];
  /** Akkaunt (GET /v1/admin/parents → user): faollik, login va «parolni almashtirishi kerak» holati. */
  user?: { id: number; is_active: boolean; username?: string | null; must_change_password?: boolean; last_login_at?: string | null } | null;
}

export interface DashboardSummary {
  bogcha?: { id: number; name: string; address: string | null; phone: string | null } | null;
  /** Joriy oy to'lov holati (faqat real API) */
  tolovlar?: { oy: string; jami: number; tolagan: number; tolanmagan: number; summa: number } | null;
  bolalar_soni: number;
  /** Faol (arxivlanmagan) bolalar — faqat real API */
  faol_bolalar_soni?: number;
  guruhlar_soni: number;
  tarbiyachilar_soni: number;
  ota_onalar_soni: number;
  /** Shu bog'chaning oxirgi 5 ta kundalik mashg'uloti — faqat real API */
  songgi_faoliyatlar?: {
    id: number; title: string; direction: string | null; date: string; starts_at: string | null;
    group: { id: number; name: string } | null;
  }[];
  /** Faqat real API qaytaradi (demo ma'lumotda yo'q). */
  bugungi_davomat?: {
    sana: string;
    jami: number;
    keldi: number;
    kelmadi: number;
    sababli: number;
    belgilanmagan: number;
  };
}

export interface OrgPayment {
  id: number;
  amount: string;
  currency: string;
  status: "pending" | "paid" | "failed" | "refunded";
  payment_method: string | null;  // was provider
  invoice_number: string | null;  // NEW
  transaction_id: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  plan_name: string | null;
}

export interface OrgActivity {
  id: number;
  action: string;
  description: string;
  created_at: string;
  user: { id: number; name: string } | null;
}

export interface Invoice {                     // NEW
  id: number;
  organization_id: number;
  subscription_id: number | null;
  invoice_number: string;
  amount: string;
  currency: string;
  status: "draft" | "pending" | "paid" | "overdue" | "cancelled";
  due_at: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface UserSummary {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  role: Role;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  organization: { id: number; name: string; phone?: string | null } | null;
}

export interface UserDetail extends UserSummary {
  recent_activity: {
    id: number;
    action: string;
    description: string;
    ip_address: string | null;
    created_at: string;
  }[];
}

export interface SubscriptionMetrics {
  active: number;
  trial: number;
  past_due: number;
  expired: number;
  cancelled: number;
  mrr: number;
}

export interface SubscriptionDetail extends FullSubscription {
  organization_detail: { id: number; name: string; phone: string | null; address: string | null } | null;
  plan_detail: {
    id: number;
    name: string;
    description: string | null;
    price_monthly: string;
    price_yearly: string | null;
    currency: string;
    trial_days: number;
    max_children: number | null;
    max_teachers: number | null;
    max_groups: number | null;
    features: string[];
  } | null;
  payment_summary: {
    total_paid: number;
    total_pending: number;
    latest_payment_at: string | null;
  };
  recent_invoices: {
    id: number;
    invoice_number: string;
    amount: string;
    currency: string;
    status: string;
    due_at: string | null;
    paid_at: string | null;
    created_at: string;
  }[];
  recent_payments: {
    id: number;
    amount: string;
    currency: string;
    status: string;
    payment_method: string | null;
    paid_at: string | null;
    created_at: string;
  }[];
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export interface PaymentSummary {
  total_revenue: number;
  monthly_revenue: number;
  pending_revenue: number;
  failed_count: number;
}

export interface PaymentSummaryFull {
  gross_revenue: number;
  net_revenue: number;
  total_revenue: number;
  refunded_amount: number;
  today_revenue: number;
  monthly_revenue: number;
  pending_revenue: number;
  paid_count: number;
  pending_count: number;
  failed_count: number;
  refunded_count: number;
  total_count: number;
}

export interface PaymentRecord {
  id: number;
  organization: { id: number; name: string } | null;
  subscription_id: number | null;
  invoice_id: number | null;
  invoice_number: string | null;
  amount: string;
  currency: string;
  status: "paid" | "pending" | "failed" | "refunded";
  payment_method: string | null;
  transaction_id: string | null;
  paid_at: string | null;
  due_at: string | null;
  plan_name: string | null;
  notes: string | null;
  created_at: string;
}

export interface PaymentDetailRecord extends PaymentRecord {
  organization: { id: number; name: string; phone: string | null } | null;
  subscription: {
    id: number;
    status: string;
    ends_at: string | null;
    plan: { id: number; name: string; price_monthly: string; currency: string } | null;
  } | null;
  invoice: {
    id: number;
    invoice_number: string;
    status: string;
    due_at: string | null;
    paid_at: string | null;
  } | null;
}

export interface InvoiceRecord {
  id: number;
  invoice_number: string;
  organization: { id: number; name: string } | null;
  subscription_id: number | null;
  amount: string;
  currency: string;
  status: "draft" | "pending" | "paid" | "overdue" | "cancelled";
  due_at: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface InvoiceDetailRecord extends InvoiceRecord {
  subscription: {
    id: number;
    status: string;
    ends_at: string | null;
    plan_id: number;
  } | null;
  payments: {
    id: number;
    amount: string;
    currency: string;
    status: string;
    payment_method: string | null;
    paid_at: string | null;
    created_at: string;
  }[];
}

export interface InvoiceSummary {
  total: number;
  draft: number;
  pending: number;
  paid: number;
  overdue: number;
  cancelled: number;
  total_pending_amount: number;
  total_paid_amount: number;
  total_overdue_amount: number;
}

export interface Notification {
  id: number;
  title: string;
  message: string;
  type: "info" | "warning" | "alert" | "payment";
  is_read: boolean;
  created_at: string;
}

// ── Report types ───────────────────────────────────────────────────

export interface ReportPeriod {
  from: string;
  to: string;
}

export interface ReportOverview {
  period: ReportPeriod;
  organizations: {
    total: number;
    active: number;
    inactive: number;
    new: number;
  };
  subscriptions: {
    active: number;
    trial: number;
    past_due: number;
    expired: number;
    cancelled: number;
    new: number;
    mrr: number;
    arr: number;
  };
  revenue: {
    total_paid: number;
    total_pending: number;
    total_refunded: number;
    gross_revenue: number;
    period_paid: number;
    period_pending: number;
    avg_revenue_per_org: number;
  };
  invoices: {
    total: number;
    draft: number;
    pending: number;
    paid: number;
    overdue: number;
    cancelled: number;
    paid_amount: number;
    pending_amount: number;
  };
}

export interface RevenueSeriesItem {
  period: string;
  label: string;
  total: number;
  count: number;
}

export interface ReportRevenue {
  period: ReportPeriod;
  group_by: "day" | "month";
  series: RevenueSeriesItem[];
  total: number;
  by_plan: { plan_name: string; total: number }[];
  by_method: { method: string; count: number; total: number }[];
}

export interface ReportSubscriptions {
  period: ReportPeriod;
  status_distribution: {
    active: number;
    trial: number;
    past_due: number;
    expired: number;
    cancelled: number;
  };
  plan_distribution: { plan_id: number; plan_name: string; count: number }[];
  new_in_period: number;
  cancelled_in_period: number;
  expired_in_period: number;
  expiring_soon: number;
  mrr: number;
  arr: number;
}

export interface ReportOrganizations {
  period: ReportPeriod;
  counts: {
    total: number;
    active: number;
    inactive: number;
    suspended?: number;
    archived?: number;
    new_in_period: number;
    with_unpaid_invoices: number;
    with_expired_subs: number;
  };
  plan_distribution: { plan_id: number; plan_name: string; count: number }[];
  growth_series: { period: string; label: string; count: number }[];
}

export interface ReportUsers {
  period: ReportPeriod;
  counts: {
    total: number;
    active: number;
    inactive: number;
    new_in_period: number;
  };
  by_role: {
    super_admin: number;
    admin: number;
    teacher: number;
    parent: number;
  };
  by_organization: { organization_id: number; organization_name: string; count: number }[];
}

export interface DashboardSummaryEnhanced {
  period: ReportPeriod;
  /** Haqiqiy va arxivlanmagan tashkilotlar (arxiv — arxiv_bogchalar) */
  jami_bogchalar: number;
  faol_bogchalar: number;
  /** Faol emas + vaqtincha to'xtatilgan */
  nofaol_bogchalar: number;
  faol_emas_bogchalar?: number;
  toxtatilgan_bogchalar?: number;
  arxiv_bogchalar?: number;
  yangi_bogchalar: number;
  /** Test/demo tashkilotlar — yuqoridagi statistikaga qo'shilmagan */
  demo_bogchalar?: number;
  muddati_yaqin: number;
  tolov_kutilmoqda: number;
  jami_foydalanuvchilar: number;
  oxirgi_bogchalar: {
    id: number;
    name: string;
    phone: string | null;
    is_active: boolean;
    created_at: string;
    address?: string | null;
    children_count?: number;
    groups_count?: number;
    teachers_count?: number;
    subscription: { status: string; ends_at: string | null; plan: string | null } | null;
  }[];
  obuna_holati: {
    active: number;
    trial: number;
    past_due: number;
    expired: number;
    cancelled: number;
  };
  billing: {
    mrr: number;
    arr: number;
    monthly_revenue: number;
    pending_revenue: number;
    period_paid: number;
    prev_period_paid: number;
    total_paid: number;
    total_refunded: number;
  };
  /** Barcha bog'chalar bo'yicha agregat sonlar. */
  platforma?: {
    jami_bolalar: number;
    jami_guruhlar: number;
    jami_tarbiyachilar: number;
    bugungi_davomat: AttendanceTotals;
  };
}

export interface DashboardRecent {
  payments: {
    id: number;
    organization: { id: number; name: string } | null;
    amount: string;
    currency: string;
    status: string;
    payment_method: string | null;
    paid_at: string | null;
    created_at: string;
  }[];
  invoices: {
    id: number;
    invoice_number: string;
    organization: { id: number; name: string } | null;
    amount: string;
    currency: string;
    status: string;
    due_at: string | null;
    paid_at: string | null;
    created_at: string;
  }[];
  activity: ActivityLogEntry[];
}

export interface ActivityLogEntry {
  id: number;
  action: string;
  description: string;
  ip_address: string | null;
  created_at: string;
  user: { id: number; name: string } | null;
  organization: { id: number; name: string } | null;
}

export interface DashboardExpiring {
  subscriptions: {
    id: number;
    organization: { id: number; name: string } | null;
    plan: string | null;
    status: "active" | "trial";
    ends_at: string | null;
    days_remaining: number;
  }[];
  total: number;
}

/** Excel importining bitta qatori (backend normallashtirgan). */
export interface OrganizationImportRow {
  row: number;
  name: string | null;
  number: string | null;
  address: string | null;
  mfy: string | null;
  capacity: number | null;
  director_name: string | null;
  director_phone: string | null;
  /** Fayldagi «Turi» ustuni (bo'sh bo'lsa — import formasidagi tur qo'llanadi) */
  type?: "davlat" | "xususiy" | null;
  /** Excel sarlavhasi → katakning asl (o'zgartirilmagan) qiymati */
  source: Record<string, string>;
  /** Alohida ustundan emas, boshqa ustundan ajratilgan maydonlar: number → "name", mfy → "address" */
  derived: Partial<Record<"number" | "mfy", "name" | "address">>;
  /** Faylda bo'lmagan maydonlar — to'ldirilmaydi */
  missing: string[];
  errors: string[];
  warnings: string[];
  /** Tuzilgan ro'yxat: daraja, maydon, Excel'dagi ustun nomi va sabab */
  issues?: OrganizationImportIssue[];
  official_code?: string | null;
  status: "ok" | "warning" | "error";
}

export interface OrganizationImportIssue {
  level: "error" | "warning";
  field: string;
  column: string;
  message: string;
}

export interface OrganizationImportColumn {
  field: string;
  label: string;
  required: boolean;
  /** Faylda topilgan sarlavha; null — faylda yo'q */
  header: string | null;
}

export interface OrganizationImportPreview {
  rows: OrganizationImportRow[];
  summary: { total: number; ok: number; warning: number; error: number };
  columns?: OrganizationImportColumn[];
  /** Faylda xatoli qator bo'lmasa — true */
  can_import?: boolean;
}
