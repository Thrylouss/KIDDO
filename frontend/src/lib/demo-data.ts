import type {
  Child,
  DashboardSummary,
  DashboardSummaryEnhanced,
  DashboardRecent,
  DashboardExpiring,
  ReportRevenue,
  ReportSubscriptions,
  Group,
  ParentProfile,
  TeacherProfile,
  User,
} from "@/types";

export const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export const DEMO_USER: User = {
  id: 1,
  name: "Yulduz bog'chasi",
  phone: "+998901234567",
  email: "demo@kiddo.uz",
  role: "admin",
  organization_id: 1,
  is_active: true,
  created_at: "2024-01-01T00:00:00Z",
};

export const DEMO_SUPER_ADMIN_USER: User = {
  id: 99,
  name: "Super Admin",
  phone: "+998901111111",
  email: "superadmin@kiddo.uz",
  role: "super_admin",
  organization_id: null,
  is_active: true,
  created_at: "2024-01-01T00:00:00Z",
};

export const DEMO_TEACHER_USER: User = {
  id: 50,
  name: "Maftuna Xolmatova",
  phone: "+998901234001",
  email: "teacher@kiddo.uz",
  role: "teacher",
  organization_id: 1,
  is_active: true,
  created_at: "2024-01-01T00:00:00Z",
};

export function setDemoRole(role: "admin" | "super_admin" | "teacher"): void {
  if (typeof window !== "undefined") sessionStorage.setItem("demo_role", role);
}

export function clearDemoRole(): void {
  if (typeof window !== "undefined") sessionStorage.removeItem("demo_role");
}

export function getDemoUser(): User | null {
  if (typeof window === "undefined") return null;
  const role = sessionStorage.getItem("demo_role");
  if (role === "super_admin") return DEMO_SUPER_ADMIN_USER;
  if (role === "teacher") return DEMO_TEACHER_USER;
  if (role === "admin") return DEMO_USER;
  return null;
}

export const DEMO_GROUPS: Group[] = [
  {
    id: 1,
    organization_id: 1,
    name: "Kamalak guruhi",
    age_category: "3–4 yosh",
    capacity: 20,
    is_active: true,
    children_count: 14,
    teacher_profiles_count: 2,
  },
  {
    id: 2,
    organization_id: 1,
    name: "Nilufar guruhi",
    age_category: "4–5 yosh",
    capacity: 18,
    is_active: true,
    children_count: 16,
    teacher_profiles_count: 1,
  },
  {
    id: 3,
    organization_id: 1,
    name: "Bahor guruhi",
    age_category: "5–6 yosh",
    capacity: 15,
    is_active: true,
    children_count: 9,
    teacher_profiles_count: 1,
  },
  {
    id: 4,
    organization_id: 1,
    name: "Quyosh guruhi",
    age_category: "2–3 yosh",
    capacity: 12,
    is_active: true,
    children_count: 7,
    teacher_profiles_count: 1,
  },
];

export const DEMO_SUMMARY: DashboardSummary = {
  bolalar_soni:      46,
  guruhlar_soni:     4,
  tarbiyachilar_soni: 5,
  ota_onalar_soni:   38,
};

export const DEMO_CHILDREN: Child[] = [
  { id: 1,  organization_id: 1, group_id: 1, first_name: "Azizbek",  last_name: "Karimov",     birth_date: "2021-03-15", gender: "erkak", is_active: true,  group: { id: 1, name: "Kamalak guruhi" } },
  { id: 2,  organization_id: 1, group_id: 1, first_name: "Malika",   last_name: "Yusupova",    birth_date: "2021-07-22", gender: "ayol",  is_active: true,  group: { id: 1, name: "Kamalak guruhi" } },
  { id: 3,  organization_id: 1, group_id: 1, first_name: "Sardor",   last_name: "Toshmatov",   birth_date: "2021-01-10", gender: "erkak", is_active: true,  group: { id: 1, name: "Kamalak guruhi" } },
  { id: 4,  organization_id: 1, group_id: 1, first_name: "Shahlo",   last_name: "Normatova",   birth_date: "2021-09-03", gender: "ayol",  is_active: true,  group: { id: 1, name: "Kamalak guruhi" } },
  { id: 5,  organization_id: 1, group_id: 2, first_name: "Gulnora",  last_name: "Ergasheva",   birth_date: "2020-05-30", gender: "ayol",  is_active: true,  group: { id: 2, name: "Nilufar guruhi" } },
  { id: 6,  organization_id: 1, group_id: 2, first_name: "Jasur",    last_name: "Nazarov",     birth_date: "2020-09-14", gender: "erkak", is_active: true,  group: { id: 2, name: "Nilufar guruhi" } },
  { id: 7,  organization_id: 1, group_id: 2, first_name: "Zulfiya",  last_name: "Mirzayeva",   birth_date: "2020-11-08", gender: "ayol",  is_active: true,  group: { id: 2, name: "Nilufar guruhi" } },
  { id: 8,  organization_id: 1, group_id: 2, first_name: "Otabek",   last_name: "Holiqov",     birth_date: "2020-03-27", gender: "erkak", is_active: false, group: { id: 2, name: "Nilufar guruhi" } },
  { id: 9,  organization_id: 1, group_id: 3, first_name: "Bobur",    last_name: "Xasanov",     birth_date: "2019-04-12", gender: "erkak", is_active: true,  group: { id: 3, name: "Bahor guruhi" } },
  { id: 10, organization_id: 1, group_id: 3, first_name: "Nilufar",  last_name: "Raximova",    birth_date: "2019-08-25", gender: "ayol",  is_active: true,  group: { id: 3, name: "Bahor guruhi" } },
  { id: 11, organization_id: 1, group_id: 3, first_name: "Firdavs",  last_name: "Usmonov",     birth_date: "2019-02-18", gender: "erkak", is_active: true,  group: { id: 3, name: "Bahor guruhi" } },
  { id: 12, organization_id: 1, group_id: 3, first_name: "Iroda",    last_name: "Sultonova",   birth_date: "2019-12-01", gender: "ayol",  is_active: true,  group: { id: 3, name: "Bahor guruhi" } },
  { id: 13, organization_id: 1, group_id: 4, first_name: "Lobar",    last_name: "Abdullayeva", birth_date: "2022-06-05", gender: "ayol",  is_active: true,  group: { id: 4, name: "Quyosh guruhi" } },
  { id: 14, organization_id: 1, group_id: 4, first_name: "Sherzod",  last_name: "Qodirov",     birth_date: "2022-01-17", gender: "erkak", is_active: true,  group: { id: 4, name: "Quyosh guruhi" } },
  { id: 15, organization_id: 1, group_id: null, first_name: "Kamol", last_name: "Hamidov",     birth_date: "2020-07-19", gender: "erkak", is_active: true,  group: null },
];

export const DEMO_TEACHERS: TeacherProfile[] = [
  {
    id: 1,
    user_id: 10,
    organization_id: 1,
    first_name: "Maftuna",
    last_name:  "Xolmatova",
    phone:      "+998901234001",
    position:   "Bosh tarbiyachi",
    is_active:  true,
    groups:     [{ id: 1, name: "Kamalak guruhi" }, { id: 2, name: "Nilufar guruhi" }],
  },
  {
    id: 2,
    user_id: 11,
    organization_id: 1,
    first_name: "Dilnoza",
    last_name:  "Tursunova",
    phone:      "+998901234002",
    position:   "Tarbiyachi",
    is_active:  true,
    groups:     [{ id: 1, name: "Kamalak guruhi" }],
  },
  {
    id: 3,
    user_id: 12,
    organization_id: 1,
    first_name: "Sarvinoz",
    last_name:  "Qosimova",
    phone:      "+998901234003",
    position:   "Tarbiyachi",
    is_active:  true,
    groups:     [{ id: 3, name: "Bahor guruhi" }],
  },
  {
    id: 4,
    user_id: 13,
    organization_id: 1,
    first_name: "Kamola",
    last_name:  "Nazarova",
    phone:      "+998901234004",
    position:   "Tarbiyachi",
    is_active:  true,
    groups:     [{ id: 4, name: "Quyosh guruhi" }],
  },
  {
    id: 5,
    user_id: 14,
    organization_id: 1,
    first_name: "Nodira",
    last_name:  "Rustamova",
    phone:      "+998901234005",
    position:   "Yordamchi tarbiyachi",
    is_active:  false,
    groups:     [],
  },
];

export const DEMO_PARENTS: ParentProfile[] = [
  {
    id: 1,
    user_id: 20,
    organization_id: 1,
    first_name: "Baxtiyor",
    last_name:  "Karimov",
    phone:      "+998901234101",
    children:   [{ id: 1, first_name: "Azizbek", last_name: "Karimov" }],
  },
  {
    id: 2,
    user_id: 21,
    organization_id: 1,
    first_name: "Mohira",
    last_name:  "Yusupova",
    phone:      "+998901234102",
    children:   [{ id: 2, first_name: "Malika", last_name: "Yusupova" }],
  },
  {
    id: 3,
    user_id: 22,
    organization_id: 1,
    first_name: "Sarvarbek",
    last_name:  "Toshmatov",
    phone:      "+998901234103",
    children:   [{ id: 3, first_name: "Sardor", last_name: "Toshmatov" }],
  },
  {
    id: 4,
    user_id: null,
    organization_id: 1,
    first_name: "Muazzam",
    last_name:  "Ergasheva",
    phone:      "+998901234104",
    children:   [{ id: 5, first_name: "Gulnora", last_name: "Ergasheva" }],
  },
  {
    id: 5,
    user_id: 23,
    organization_id: 1,
    first_name: "Dostonbek",
    last_name:  "Nazarov",
    phone:      "+998901234105",
    children:   [{ id: 6, first_name: "Jasur", last_name: "Nazarov" }],
  },
  {
    id: 6,
    user_id: null,
    organization_id: 1,
    first_name: "Hamid",
    last_name:  "Mirzayev",
    phone:      "+998901234106",
    children:   [{ id: 7, first_name: "Zulfiya", last_name: "Mirzayeva" }],
  },
  {
    id: 7,
    user_id: 24,
    organization_id: 1,
    first_name: "Ulugbek",
    last_name:  "Xasanov",
    phone:      "+998901234107",
    children:   [{ id: 9, first_name: "Bobur", last_name: "Xasanov" }],
  },
  {
    id: 8,
    user_id: null,
    organization_id: 1,
    first_name: "Nargiza",
    last_name:  "Raximova",
    phone:      "+998901234108",
    children:   [
      { id: 10, first_name: "Nilufar",  last_name: "Raximova" },
      { id: 11, first_name: "Firdavs",  last_name: "Usmonov"  },
    ],
  },
];

// ── Super Admin demo data ──────────────────────────────────────────────────────

const _SA_BOGCHALAR = [
  { id: 1, name: "Yulduz bog'chasi",   phone: "+998711001001", is_active: true, created_at: "2025-01-15T09:00:00Z", subscription: { status: "active", ends_at: "2026-12-31", plan: "Premium" } },
  { id: 2, name: "Nilufar bog'chasi",  phone: "+998711001002", is_active: true, created_at: "2025-02-10T09:00:00Z", subscription: { status: "active", ends_at: "2026-11-30", plan: "Asosiy" } },
  { id: 3, name: "Bahor bog'chasi",    phone: "+998711001003", is_active: true, created_at: "2025-03-05T09:00:00Z", subscription: { status: "active", ends_at: "2026-11-05", plan: "Asosiy" } },
  { id: 4, name: "Kamalak bog'chasi",  phone: "+998711001004", is_active: true, created_at: "2025-04-20T09:00:00Z", subscription: { status: "trial",  ends_at: "2026-11-10", plan: "Asosiy" } },
  { id: 5, name: "Mehr bog'chasi",     phone: "+998711001005", is_active: true, created_at: "2025-05-01T09:00:00Z", subscription: { status: "active", ends_at: "2026-12-15", plan: "Premium" } },
];

export const DEMO_SA_DASHBOARD: DashboardSummaryEnhanced = {
  period: { from: "2026-10-01", to: "2026-10-27" },
  jami_bogchalar: 12,
  faol_bogchalar: 10,
  nofaol_bogchalar: 2,
  yangi_bogchalar: 2,
  muddati_yaqin: 3,
  tolov_kutilmoqda: 2,
  jami_foydalanuvchilar: 156,
  oxirgi_bogchalar: _SA_BOGCHALAR,
  obuna_holati: { active: 8, trial: 2, past_due: 1, expired: 1, cancelled: 0 },
  billing: {
    mrr: 12_000_000,
    arr: 144_000_000,
    monthly_revenue: 12_000_000,
    pending_revenue: 2_500_000,
    period_paid: 12_000_000,
    prev_period_paid: 10_500_000,
    total_paid: 108_000_000,
    total_refunded: 1_500_000,
  },
};

export const DEMO_SA_REVENUE: ReportRevenue = {
  period: { from: "2026-01-01", to: "2026-10-27" },
  group_by: "month",
  series: [
    { period: "2026-01", label: "Yanvar",  total: 7_500_000,  count: 9  },
    { period: "2026-02", label: "Fevral",  total: 8_000_000,  count: 10 },
    { period: "2026-03", label: "Mart",    total: 9_000_000,  count: 10 },
    { period: "2026-04", label: "Aprel",   total: 9_500_000,  count: 11 },
    { period: "2026-05", label: "May",     total: 10_000_000, count: 11 },
    { period: "2026-06", label: "Iyun",    total: 10_500_000, count: 11 },
    { period: "2026-07", label: "Iyul",    total: 11_000_000, count: 12 },
    { period: "2026-08", label: "Avgust",  total: 11_500_000, count: 12 },
    { period: "2026-09", label: "Sentabr", total: 11_500_000, count: 12 },
    { period: "2026-10", label: "Oktabr",  total: 12_000_000, count: 12 },
  ],
  total: 100_500_000,
  by_plan: [
    { plan_name: "Asosiy",  total: 60_000_000 },
    { plan_name: "Premium", total: 40_500_000 },
  ],
  by_method: [
    { method: "Click", count: 80, total: 72_000_000 },
    { method: "Payme", count: 20, total: 28_500_000 },
  ],
};

export const DEMO_SA_SUBSCRIPTIONS: ReportSubscriptions = {
  period: { from: "2026-10-01", to: "2026-10-27" },
  status_distribution: { active: 8, trial: 2, past_due: 1, expired: 1, cancelled: 0 },
  plan_distribution: [
    { plan_id: 1, plan_name: "Asosiy",  count: 7 },
    { plan_id: 2, plan_name: "Premium", count: 5 },
  ],
  new_in_period: 2,
  cancelled_in_period: 0,
  expired_in_period: 1,
  expiring_soon: 3,
  mrr: 12_000_000,
  arr: 144_000_000,
};

export const DEMO_SA_RECENT: DashboardRecent = {
  payments: [
    { id: 1, organization: { id: 1, name: "Yulduz bog'chasi" },  amount: "1200000", currency: "UZS", status: "paid",    payment_method: "Click", paid_at: "2026-10-25T10:30:00Z", created_at: "2026-10-25T10:00:00Z" },
    { id: 2, organization: { id: 2, name: "Nilufar bog'chasi" }, amount: "800000",  currency: "UZS", status: "paid",    payment_method: "Payme", paid_at: "2026-10-24T14:15:00Z", created_at: "2026-10-24T14:00:00Z" },
    { id: 3, organization: { id: 4, name: "Kamalak bog'chasi" }, amount: "800000",  currency: "UZS", status: "pending", payment_method: null,    paid_at: null,                   created_at: "2026-10-23T09:45:00Z" },
    { id: 4, organization: { id: 5, name: "Mehr bog'chasi" },    amount: "1200000", currency: "UZS", status: "paid",    payment_method: "Click", paid_at: "2026-10-22T11:00:00Z", created_at: "2026-10-22T10:30:00Z" },
    { id: 5, organization: { id: 3, name: "Bahor bog'chasi" },   amount: "800000",  currency: "UZS", status: "failed",  payment_method: "Click", paid_at: null,                   created_at: "2026-10-21T16:20:00Z" },
  ],
  invoices: [
    { id: 1, invoice_number: "INV-2026-001", organization: { id: 1, name: "Yulduz bog'chasi" },  amount: "1200000", currency: "UZS", status: "paid",    due_at: "2026-11-01", paid_at: "2026-10-25T10:30:00Z", created_at: "2026-10-15T09:00:00Z" },
    { id: 2, invoice_number: "INV-2026-002", organization: { id: 2, name: "Nilufar bog'chasi" }, amount: "800000",  currency: "UZS", status: "paid",    due_at: "2026-11-01", paid_at: "2026-10-24T14:15:00Z", created_at: "2026-10-15T09:00:00Z" },
    { id: 3, invoice_number: "INV-2026-003", organization: { id: 4, name: "Kamalak bog'chasi" }, amount: "800000",  currency: "UZS", status: "pending", due_at: "2026-11-01", paid_at: null,                   created_at: "2026-10-15T09:00:00Z" },
    { id: 4, invoice_number: "INV-2026-004", organization: { id: 3, name: "Bahor bog'chasi" },   amount: "800000",  currency: "UZS", status: "overdue", due_at: "2026-10-20", paid_at: null,                   created_at: "2026-10-01T09:00:00Z" },
  ],
  activity: [
    { id: 1, action: "login",         description: "Tizimga kirdi",                          ip_address: "10.0.0.1", created_at: "2026-10-27T08:15:00Z", user: { id: 2,  name: "Nilufar bog'chasi" },  organization: { id: 2, name: "Nilufar bog'chasi" } },
    { id: 2, action: "payment_paid",  description: "To'lov qabul qilindi: 1 200 000 UZS",    ip_address: null,       created_at: "2026-10-25T10:30:00Z", user: null,                                   organization: { id: 1, name: "Yulduz bog'chasi" } },
    { id: 3, action: "child_added",   description: "Yangi bola qo'shildi: Dilnoza Qodirov",  ip_address: "10.0.0.5", created_at: "2026-10-24T11:00:00Z", user: { id: 3,  name: "Bahor bog'chasi" },    organization: { id: 3, name: "Bahor bog'chasi" } },
    { id: 4, action: "subscription",  description: "Obuna yangilandi: Premium tarif",         ip_address: null,       created_at: "2026-10-23T09:45:00Z", user: null,                                   organization: { id: 5, name: "Mehr bog'chasi" } },
    { id: 5, action: "teacher_added", description: "Yangi tarbiyachi qo'shildi",               ip_address: "10.0.0.3", created_at: "2026-10-22T14:30:00Z", user: { id: 4,  name: "Kamalak bog'chasi" }, organization: { id: 4, name: "Kamalak bog'chasi" } },
  ],
};

export const DEMO_SA_EXPIRING: DashboardExpiring = {
  subscriptions: [
    { id: 3, organization: { id: 3, name: "Bahor bog'chasi" },    plan: "Asosiy",  status: "active", ends_at: "2026-11-05", days_remaining: 9  },
    { id: 4, organization: { id: 4, name: "Kamalak bog'chasi" },  plan: "Asosiy",  status: "trial",  ends_at: "2026-11-10", days_remaining: 14 },
    { id: 6, organization: { id: 6, name: "Gulbahor bog'chasi" }, plan: "Premium", status: "active", ends_at: "2026-11-12", days_remaining: 16 },
  ],
  total: 3,
};

export const DEMO_TEACHER_DASHBOARD = {
  teacher: { id: 1, name: "Maftuna Xolmatova", position: "Bosh tarbiyachi" },
  group:   { id: 1, name: "Kamalak guruhi", age_category: "3–4 yosh", capacity: 14 },
  today: {
    date: "2026-10-27",
    total: 12,
    present: 9,
    absent: 3,
    children: [
      { id: 1,  first_name: "Azizbek",  last_name: "Karimov",     status: "present" as const },
      { id: 2,  first_name: "Malika",   last_name: "Yusupova",    status: "present" as const },
      { id: 3,  first_name: "Sardor",   last_name: "Toshmatov",   status: "absent"  as const },
      { id: 4,  first_name: "Shahlo",   last_name: "Normatova",   status: "present" as const },
      { id: 5,  first_name: "Humoyun",  last_name: "Mirzayev",    status: "present" as const },
      { id: 6,  first_name: "Dildora",  last_name: "Qodirova",    status: "absent"  as const },
      { id: 7,  first_name: "Islom",    last_name: "Tursunov",    status: "present" as const },
      { id: 8,  first_name: "Nozima",   last_name: "Xolmatova",   status: "present" as const },
      { id: 9,  first_name: "Behruz",   last_name: "Ergashev",    status: "present" as const },
      { id: 10, first_name: "Sitora",   last_name: "Raximova",    status: "absent"  as const },
      { id: 11, first_name: "Akbar",    last_name: "Nazarov",     status: "present" as const },
      { id: 12, first_name: "Feruza",   last_name: "Hamidova",    status: "present" as const },
    ],
  },
  schedule: [
    { time: "07:30", activity: "Bolalarni qabul qilish" },
    { time: "08:00", activity: "Ertalabki badantarbiya" },
    { time: "08:30", activity: "Nonushta" },
    { time: "09:00", activity: "Mashg'ulotlar" },
    { time: "10:30", activity: "Tashqarida o'yin" },
    { time: "12:00", activity: "Tushlik" },
    { time: "12:30", activity: "Kunduzgi uyqu" },
    { time: "14:30", activity: "Uyg'onish, badantarbiya" },
    { time: "15:00", activity: "Peshin ovqat" },
    { time: "16:00", activity: "Erkin o'yin va ijod" },
    { time: "17:30", activity: "Bolalarni topshirish" },
  ],
};

export type TeacherDashboardData = typeof DEMO_TEACHER_DASHBOARD;

// ── Attendance localStorage helpers (demo-only) ───────────────────────────────

export type AttendanceStatus = "present" | "absent";

const DEMO_ATTENDANCE_KEY_PREFIX = "kiddo_demo_att_";

export function getDemoAttendance(date: string): Record<number, AttendanceStatus> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DEMO_ATTENDANCE_KEY_PREFIX + date);
    return raw ? (JSON.parse(raw) as Record<number, AttendanceStatus>) : null;
  } catch {
    return null;
  }
}

export function saveDemoAttendance(date: string, statuses: Record<number, AttendanceStatus>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(DEMO_ATTENDANCE_KEY_PREFIX + date, JSON.stringify(statuses));
}

export function clearDemoAttendance(date: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(DEMO_ATTENDANCE_KEY_PREFIX + date);
}

// ─────────────────────────────────────────────────────────────────────────────

type RequestOptions = { method?: string };

export function handleDemoRequest<T>(path: string, options: RequestOptions): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();

  return new Promise<T>((resolve) => {
    setTimeout(() => {
      // Write operations succeed silently — modals close, pages reload same demo data
      if (method !== "GET") {
        resolve(undefined as T);
        return;
      }

      if (path === "/v1/me") {
        const u = getDemoUser();
        resolve(u ? ({ user: u } as T) : (undefined as T));
      } else if (path.startsWith("/v1/super-admin/dashboard/recent")) {
        resolve(DEMO_SA_RECENT as T);
      } else if (path.startsWith("/v1/super-admin/dashboard/expiring")) {
        resolve(DEMO_SA_EXPIRING as T);
      } else if (path.startsWith("/v1/super-admin/dashboard")) {
        resolve(DEMO_SA_DASHBOARD as T);
      } else if (path.startsWith("/v1/super-admin/reports/revenue")) {
        resolve(DEMO_SA_REVENUE as T);
      } else if (path.startsWith("/v1/super-admin/reports/subscriptions")) {
        resolve(DEMO_SA_SUBSCRIPTIONS as T);
      } else if (path.startsWith("/v1/teacher/dashboard")) {
        resolve(DEMO_TEACHER_DASHBOARD as T);
      } else if (path.startsWith("/v1/admin/dashboard")) {
        resolve(DEMO_SUMMARY as T);
      } else if (path.startsWith("/v1/admin/groups")) {
        resolve({ data: DEMO_GROUPS } as T);
      } else if (path.startsWith("/v1/admin/children")) {
        resolve({ data: DEMO_CHILDREN } as T);
      } else if (path.startsWith("/v1/admin/teachers")) {
        resolve({ data: DEMO_TEACHERS } as T);
      } else if (path.startsWith("/v1/admin/parents")) {
        resolve({ data: DEMO_PARENTS } as T);
      } else {
        resolve(undefined as T);
      }
    }, 280);
  });
}
