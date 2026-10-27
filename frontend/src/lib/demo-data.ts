import type {
  Child,
  DashboardSummary,
  DashboardSummaryEnhanced,
  DashboardRecent,
  DashboardExpiring,
  OrganizationSummary,
  Plan,
  ReportRevenue,
  ReportSubscriptions,
  FullSubscription,
  SubscriptionMetrics,
  PaymentRecord,
  PaymentSummaryFull,
  InvoiceRecord,
  InvoiceSummary,
  ActivityLogEntry,
  Notification,
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

export const DEMO_SA_PLANS: Plan[] = [
  {
    id: 1, name: "Asosiy", slug: "asosiy",
    description: "Kichik va o'rta bog'chalar uchun",
    price_monthly: "800000", price_yearly: "8000000", currency: "UZS",
    trial_days: 14, max_children: 50, max_teachers: 10, max_groups: 5,
    features: ["Bolalar ro'yxati", "Davomat", "Ota-onalar"],
    is_active: true, sort_order: 1, subscriptions_count: 7,
  },
  {
    id: 2, name: "Premium", slug: "premium",
    description: "Katta bog'chalar uchun to'liq paket",
    price_monthly: "1200000", price_yearly: "12000000", currency: "UZS",
    trial_days: 14, max_children: null, max_teachers: null, max_groups: null,
    features: ["Bolalar ro'yxati", "Davomat", "Ota-onalar", "Hisobot", "Rasm yuklash"],
    is_active: true, sort_order: 2, subscriptions_count: 5,
  },
];

export const DEMO_SA_ORGANIZATIONS: OrganizationSummary[] = [
  { id: 1,  name: "Yulduz bog'chasi",   phone: "+998711001001", address: "Toshkent, Yunusobod t.",        is_active: true,  created_at: "2025-01-15T09:00:00Z", admin: { id: 101, name: "Alisher Karimov",   phone: "+998901110001" }, subscription: { id: 1,  status: "active",   ends_at: "2026-12-31", trial_ends_at: null, days_remaining: 65, plan: { id: 2, name: "Premium" } } },
  { id: 2,  name: "Nilufar bog'chasi",  phone: "+998711001002", address: "Toshkent, Mirzo Ulug'bek t.",  is_active: true,  created_at: "2025-02-10T09:00:00Z", admin: { id: 102, name: "Mohira Yusupova",   phone: "+998901110002" }, subscription: { id: 2,  status: "active",   ends_at: "2026-11-30", trial_ends_at: null, days_remaining: 34, plan: { id: 1, name: "Asosiy"  } } },
  { id: 3,  name: "Bahor bog'chasi",    phone: "+998711001003", address: "Samarqand, Registon ko'ch.",   is_active: true,  created_at: "2025-03-05T09:00:00Z", admin: { id: 103, name: "Sarvarbek Toshmatov", phone: "+998901110003" }, subscription: { id: 3,  status: "active",   ends_at: "2026-11-05", trial_ends_at: null, days_remaining: 9,  plan: { id: 1, name: "Asosiy"  } } },
  { id: 4,  name: "Kamalak bog'chasi",  phone: "+998711001004", address: "Buxoro, Markaziy ko'ch.",      is_active: true,  created_at: "2025-04-20T09:00:00Z", admin: { id: 104, name: "Umida Nazarova",    phone: "+998901110004" }, subscription: { id: 4,  status: "trial",    ends_at: "2026-11-10", trial_ends_at: "2026-11-10", days_remaining: 14, plan: { id: 1, name: "Asosiy"  } } },
  { id: 5,  name: "Mehr bog'chasi",     phone: "+998711001005", address: "Toshkent, Sergeli t.",         is_active: true,  created_at: "2025-05-01T09:00:00Z", admin: { id: 105, name: "Bobur Xasanov",     phone: "+998901110005" }, subscription: { id: 5,  status: "active",   ends_at: "2026-12-15", trial_ends_at: null, days_remaining: 49, plan: { id: 2, name: "Premium" } } },
  { id: 6,  name: "Gulbahor bog'chasi", phone: "+998711001006", address: "Andijon, Navbahor ko'ch.",     is_active: true,  created_at: "2025-06-12T09:00:00Z", admin: { id: 106, name: "Kamola Ergasheva",  phone: "+998901110006" }, subscription: { id: 6,  status: "active",   ends_at: "2026-11-12", trial_ends_at: null, days_remaining: 16, plan: { id: 2, name: "Premium" } } },
  { id: 7,  name: "Navruz bog'chasi",   phone: "+998711001007", address: "Namangan, Navruz ko'ch.",      is_active: true,  created_at: "2025-07-08T09:00:00Z", admin: { id: 107, name: "Dilnoza Mirzayeva", phone: "+998901110007" }, subscription: { id: 7,  status: "active",   ends_at: "2026-12-20", trial_ends_at: null, days_remaining: 54, plan: { id: 1, name: "Asosiy"  } } },
  { id: 8,  name: "Oftob bog'chasi",    phone: "+998711001008", address: "Farg'ona, Mustaqillik ko'ch.", is_active: true,  created_at: "2025-08-15T09:00:00Z", admin: { id: 108, name: "Jasur Rahimov",     phone: "+998901110008" }, subscription: { id: 8,  status: "active",   ends_at: "2027-01-31", trial_ends_at: null, days_remaining: 96, plan: { id: 1, name: "Asosiy"  } } },
  { id: 9,  name: "Sharq bog'chasi",    phone: "+998711001009", address: "Qo'qon, Sharq ko'ch.",         is_active: true,  created_at: "2025-09-01T09:00:00Z", admin: null,                                                           subscription: { id: 9,  status: "past_due", ends_at: "2026-10-15", trial_ends_at: null, days_remaining: 0,  plan: { id: 1, name: "Asosiy"  } } },
  { id: 10, name: "G'uncha bog'chasi",  phone: "+998711001010", address: "Toshkent, Shayxontohur t.",    is_active: true,  created_at: "2025-09-20T09:00:00Z", admin: { id: 110, name: "Nozima Qodirova",   phone: "+998901110010" }, subscription: { id: 10, status: "active",   ends_at: "2026-12-05", trial_ends_at: null, days_remaining: 39, plan: { id: 1, name: "Asosiy"  } } },
  { id: 11, name: "Armon bog'chasi",    phone: "+998711001011", address: "Jizzax, Rashidov ko'ch.",      is_active: false, created_at: "2025-10-05T09:00:00Z", admin: { id: 111, name: "Husayn Tursunov",   phone: "+998901110011" }, subscription: { id: 11, status: "expired",  ends_at: "2026-09-01", trial_ends_at: null, days_remaining: 0,  plan: { id: 1, name: "Asosiy"  } } },
  { id: 12, name: "Baxt bog'chasi",     phone: "+998711001012", address: "Qarshi, Baxt ko'ch.",          is_active: true,  created_at: "2025-10-15T09:00:00Z", admin: { id: 112, name: "Lola Ismoilova",    phone: "+998901110012" }, subscription: { id: 12, status: "trial",    ends_at: "2026-11-20", trial_ends_at: "2026-11-20", days_remaining: 24, plan: { id: 2, name: "Premium" } } },
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

export const DEMO_SA_FULL_SUBSCRIPTIONS: FullSubscription[] = DEMO_SA_ORGANIZATIONS.map(org => ({
  id:              org.subscription!.id,
  organization_id: org.id,
  organization:    { id: org.id, name: org.name },
  plan_id:         org.subscription!.plan!.id,
  status:          org.subscription!.status,
  ends_at:         org.subscription!.ends_at,
  trial_ends_at:   org.subscription!.trial_ends_at,
  days_remaining:  org.subscription!.days_remaining,
  plan: {
    id:            org.subscription!.plan!.id,
    name:          org.subscription!.plan!.name,
    price_monthly: org.subscription!.plan!.id === 1 ? "800000" : "1200000",
  },
  starts_at:        "2025-10-01T00:00:00Z",
  auto_renew:       org.subscription!.status === "active",
  cancelled_at:     null,
  cancelled_reason: null,
  is_expiring_soon: org.subscription!.days_remaining <= 14,
  created_at:       org.created_at,
}));

export const DEMO_SA_SUBSCRIPTION_METRICS: SubscriptionMetrics = {
  active:    8,
  trial:     2,
  past_due:  1,
  expired:   1,
  cancelled: 0,
  mrr:       7_600_000,
};

// paid: ids 1,2,4,6,7,8,9 → 1 200 000+800 000+1 200 000+800 000+1 200 000+800 000+800 000 = 6 800 000
// pending: ids 3,10 → 1 600 000   failed: id 5 → 800 000
export const DEMO_SA_PAYMENTS: PaymentRecord[] = [
  { id: 1,  organization: { id: 1,  name: "Yulduz bog'chasi" },   subscription_id: 1,  invoice_id: 1,  invoice_number: "INV-2026-001", amount: "1200000", currency: "UZS", status: "paid",    payment_method: "Click", transaction_id: "CLK-001", paid_at: "2026-10-25T10:30:00Z", due_at: "2026-11-01", plan_name: "Premium", notes: null, created_at: "2026-10-25T10:00:00Z" },
  { id: 2,  organization: { id: 2,  name: "Nilufar bog'chasi" },  subscription_id: 2,  invoice_id: 2,  invoice_number: "INV-2026-002", amount: "800000",  currency: "UZS", status: "paid",    payment_method: "Payme", transaction_id: "PAY-002", paid_at: "2026-10-24T14:15:00Z", due_at: "2026-11-01", plan_name: "Asosiy",  notes: null, created_at: "2026-10-24T14:00:00Z" },
  { id: 3,  organization: { id: 4,  name: "Kamalak bog'chasi" },  subscription_id: 4,  invoice_id: 3,  invoice_number: "INV-2026-003", amount: "800000",  currency: "UZS", status: "pending",  payment_method: null,    transaction_id: null,      paid_at: null,                   due_at: "2026-11-01", plan_name: "Asosiy",  notes: null, created_at: "2026-10-23T09:45:00Z" },
  { id: 4,  organization: { id: 5,  name: "Mehr bog'chasi" },     subscription_id: 5,  invoice_id: 4,  invoice_number: "INV-2026-004", amount: "1200000", currency: "UZS", status: "paid",    payment_method: "Click", transaction_id: "CLK-004", paid_at: "2026-10-22T11:00:00Z", due_at: "2026-10-31", plan_name: "Premium", notes: null, created_at: "2026-10-22T10:30:00Z" },
  { id: 5,  organization: { id: 3,  name: "Bahor bog'chasi" },    subscription_id: 3,  invoice_id: 5,  invoice_number: "INV-2026-005", amount: "800000",  currency: "UZS", status: "failed",   payment_method: "Click", transaction_id: null,      paid_at: null,                   due_at: "2026-10-20", plan_name: "Asosiy",  notes: null, created_at: "2026-10-21T16:20:00Z" },
  { id: 6,  organization: { id: 7,  name: "Navruz bog'chasi" },   subscription_id: 7,  invoice_id: 6,  invoice_number: "INV-2026-006", amount: "800000",  currency: "UZS", status: "paid",    payment_method: "Payme", transaction_id: "PAY-006", paid_at: "2026-10-20T09:00:00Z", due_at: "2026-10-31", plan_name: "Asosiy",  notes: null, created_at: "2026-10-19T10:00:00Z" },
  { id: 7,  organization: { id: 6,  name: "Gulbahor bog'chasi" }, subscription_id: 6,  invoice_id: 7,  invoice_number: "INV-2026-007", amount: "1200000", currency: "UZS", status: "paid",    payment_method: "Click", transaction_id: "CLK-007", paid_at: "2026-10-18T13:00:00Z", due_at: "2026-10-31", plan_name: "Premium", notes: null, created_at: "2026-10-18T12:00:00Z" },
  { id: 8,  organization: { id: 8,  name: "Oftob bog'chasi" },    subscription_id: 8,  invoice_id: 8,  invoice_number: "INV-2026-008", amount: "800000",  currency: "UZS", status: "paid",    payment_method: "Click", transaction_id: "CLK-008", paid_at: "2026-10-15T10:00:00Z", due_at: "2026-10-31", plan_name: "Asosiy",  notes: null, created_at: "2026-10-14T09:00:00Z" },
  { id: 9,  organization: { id: 10, name: "G'uncha bog'chasi" },  subscription_id: 10, invoice_id: 9,  invoice_number: "INV-2026-009", amount: "800000",  currency: "UZS", status: "paid",    payment_method: "Payme", transaction_id: "PAY-009", paid_at: "2026-10-10T11:00:00Z", due_at: "2026-10-31", plan_name: "Asosiy",  notes: null, created_at: "2026-10-09T10:00:00Z" },
  { id: 10, organization: { id: 9,  name: "Sharq bog'chasi" },    subscription_id: 9,  invoice_id: 10, invoice_number: "INV-2026-010", amount: "800000",  currency: "UZS", status: "pending",  payment_method: null,    transaction_id: null,      paid_at: null,                   due_at: "2026-10-15", plan_name: "Asosiy",  notes: null, created_at: "2026-10-01T09:00:00Z" },
];

export const DEMO_SA_PAYMENT_SUMMARY: PaymentSummaryFull = {
  gross_revenue:   6_800_000,
  net_revenue:     6_800_000,
  total_revenue:   6_800_000,
  refunded_amount: 0,
  today_revenue:   0,
  monthly_revenue: 6_800_000,
  pending_revenue: 1_600_000,
  paid_count:      7,
  pending_count:   2,
  failed_count:    1,
  refunded_count:  0,
  total_count:     10,
};

// paid: ids 1,2,5,6,7 → 5 200 000   pending: id 3 → 800 000   overdue: ids 4,8 → 1 600 000
export const DEMO_SA_INVOICES: InvoiceRecord[] = [
  { id: 1, invoice_number: "INV-2026-001", organization: { id: 1,  name: "Yulduz bog'chasi" },   subscription_id: 1,  amount: "1200000", currency: "UZS", status: "paid",    due_at: "2026-11-01", paid_at: "2026-10-25T10:30:00Z", notes: null, created_at: "2026-10-15T09:00:00Z" },
  { id: 2, invoice_number: "INV-2026-002", organization: { id: 2,  name: "Nilufar bog'chasi" },  subscription_id: 2,  amount: "800000",  currency: "UZS", status: "paid",    due_at: "2026-11-01", paid_at: "2026-10-24T14:15:00Z", notes: null, created_at: "2026-10-15T09:00:00Z" },
  { id: 3, invoice_number: "INV-2026-003", organization: { id: 4,  name: "Kamalak bog'chasi" },  subscription_id: 4,  amount: "800000",  currency: "UZS", status: "pending",  due_at: "2026-11-01", paid_at: null,                   notes: null, created_at: "2026-10-15T09:00:00Z" },
  { id: 4, invoice_number: "INV-2026-004", organization: { id: 3,  name: "Bahor bog'chasi" },    subscription_id: 3,  amount: "800000",  currency: "UZS", status: "overdue",  due_at: "2026-10-20", paid_at: null,                   notes: null, created_at: "2026-10-01T09:00:00Z" },
  { id: 5, invoice_number: "INV-2026-005", organization: { id: 5,  name: "Mehr bog'chasi" },     subscription_id: 5,  amount: "1200000", currency: "UZS", status: "paid",    due_at: "2026-10-31", paid_at: "2026-10-22T11:00:00Z", notes: null, created_at: "2026-10-01T09:00:00Z" },
  { id: 6, invoice_number: "INV-2026-006", organization: { id: 7,  name: "Navruz bog'chasi" },   subscription_id: 7,  amount: "800000",  currency: "UZS", status: "paid",    due_at: "2026-10-31", paid_at: "2026-10-20T09:00:00Z", notes: null, created_at: "2026-10-01T09:00:00Z" },
  { id: 7, invoice_number: "INV-2026-007", organization: { id: 6,  name: "Gulbahor bog'chasi" }, subscription_id: 6,  amount: "1200000", currency: "UZS", status: "paid",    due_at: "2026-10-31", paid_at: "2026-10-18T13:00:00Z", notes: null, created_at: "2026-10-01T09:00:00Z" },
  { id: 8, invoice_number: "INV-2026-008", organization: { id: 9,  name: "Sharq bog'chasi" },    subscription_id: 9,  amount: "800000",  currency: "UZS", status: "overdue",  due_at: "2026-10-15", paid_at: null,                   notes: null, created_at: "2026-09-15T09:00:00Z" },
];

export const DEMO_SA_INVOICE_SUMMARY: InvoiceSummary = {
  total:                8,
  draft:                0,
  pending:              1,
  paid:                 5,
  overdue:              2,
  cancelled:            0,
  total_pending_amount: 800_000,
  total_paid_amount:    5_200_000,
  total_overdue_amount: 1_600_000,
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

// ── SA Activity Logs ───────────────────────────────────────────────────────────

export const DEMO_SA_ACTIVITY_LOGS: ActivityLogEntry[] = [
  { id: 15, action: "subscription.renewed",    description: "Armon bog'chasi — obuna yangilandi (Premium, 12 oy)",   ip_address: "10.0.0.5",  created_at: "2026-10-27T11:20:00Z", user: { id: 99, name: "Super Admin" }, organization: { id: 11, name: "Armon bog'chasi" } },
  { id: 14, action: "invoice.sent",            description: "INV-2026-011 hisob-faktura yuborildi — Nilufar bog'chasi", ip_address: "10.0.0.5", created_at: "2026-10-26T15:45:00Z", user: { id: 99, name: "Super Admin" }, organization: { id: 9,  name: "Nilufar bog'chasi" } },
  { id: 13, action: "organization.created",    description: "Yangi bog'cha ro'yxatdan o'tdi — Orzular bog'chasi",   ip_address: "185.0.1.12", created_at: "2026-10-25T09:10:00Z", user: { id: 99, name: "Super Admin" }, organization: { id: 12, name: "Orzular bog'chasi" } },
  { id: 12, action: "subscription.entered",    description: "Yangi obuna boshlandi — Orzular bog'chasi (Asosiy, sinov)", ip_address: "185.0.1.12", created_at: "2026-10-25T09:12:00Z", user: { id: 99, name: "Super Admin" }, organization: { id: 12, name: "Orzular bog'chasi" } },
  { id: 11, action: "payment.received",        description: "To'lov qabul qilindi — Yulduz bog'chasi 1 200 000 UZS", ip_address: "10.0.0.5",  created_at: "2026-10-25T10:30:00Z", user: { id: 99, name: "Super Admin" }, organization: { id: 1,  name: "Yulduz bog'chasi" } },
  { id: 10, action: "user.created",            description: "Admin foydalanuvchi yaratildi — Gulnora Rashidova",    ip_address: "10.0.0.5",  created_at: "2026-10-24T14:00:00Z", user: { id: 99, name: "Super Admin" }, organization: { id: 12, name: "Orzular bog'chasi" } },
  { id: 9,  action: "subscription.cancelled",  description: "Obuna bekor qilindi — Bahor bog'chasi (to'lov muammosi)", ip_address: "10.0.0.5", created_at: "2026-10-23T16:20:00Z", user: { id: 99, name: "Super Admin" }, organization: { id: 3,  name: "Bahor bog'chasi" } },
  { id: 8,  action: "organization.deactivated","description": "Bog'cha faolsizlantirildi — Samarqand bog'chasi",   ip_address: "10.0.0.5",  created_at: "2026-10-22T11:05:00Z", user: { id: 99, name: "Super Admin" }, organization: { id: 8,  name: "Samarqand bog'chasi" } },
  { id: 7,  action: "plan.created",            description: "Yangi tarif yaratildi — Enterprise (2 400 000 UZS/oy)", ip_address: "10.0.0.5", created_at: "2026-10-21T10:00:00Z", user: { id: 99, name: "Super Admin" }, organization: null },
  { id: 6,  action: "subscription.renewed",    description: "Obuna yangilandi — Kamalak bog'chasi (Asosiy, 6 oy)", ip_address: "10.0.0.5",  created_at: "2026-10-20T09:30:00Z", user: { id: 99, name: "Super Admin" }, organization: { id: 4,  name: "Kamalak bog'chasi" } },
  { id: 5,  action: "invoice.sent",            description: "INV-2026-008 hisob-faktura yuborildi — Mehr bog'chasi", ip_address: "10.0.0.5", created_at: "2026-10-19T14:50:00Z", user: { id: 99, name: "Super Admin" }, organization: { id: 6,  name: "Mehr bog'chasi" } },
  { id: 4,  action: "organization.created",    description: "Yangi bog'cha ro'yxatdan o'tdi — Mehr bog'chasi",     ip_address: "198.0.2.44", created_at: "2026-10-15T08:00:00Z", user: { id: 99, name: "Super Admin" }, organization: { id: 6,  name: "Mehr bog'chasi" } },
  { id: 3,  action: "user.created",            description: "Admin foydalanuvchi yaratildi — Aziz Karimov",        ip_address: "10.0.0.5",  created_at: "2026-10-10T13:20:00Z", user: { id: 99, name: "Super Admin" }, organization: { id: 5,  name: "Gulbahor bog'chasi" } },
  { id: 2,  action: "subscription.entered",    description: "Yangi obuna boshlandi — Mehr bog'chasi (Premium, sinov)", ip_address: "198.0.2.44", created_at: "2026-10-15T08:05:00Z", user: { id: 99, name: "Super Admin" }, organization: { id: 6,  name: "Mehr bog'chasi" } },
  { id: 1,  action: "organization.created",    description: "Tizim ishga tushirildi — birinchi bog'cha qo'shildi", ip_address: "10.0.0.1",  created_at: "2026-09-01T07:00:00Z", user: { id: 99, name: "Super Admin" }, organization: { id: 1,  name: "Yulduz bog'chasi" } },
];

// ── SA Notifications ───────────────────────────────────────────────────────────

export const DEMO_SA_NOTIFICATIONS: Notification[] = [
  { id: 8, title: "Yangi bog'cha ro'yxatdan o'tdi",      message: "Orzular bog'chasi platformaga qo'shildi va sinov obunasi boshlandi.",      type: "info",    is_read: false, created_at: "2026-10-25T09:12:00Z" },
  { id: 7, title: "To'lov muvaffaqiyatli qabul qilindi", message: "Yulduz bog'chasi — 1 200 000 UZS Premium tarif uchun to'lov amalga oshdi.", type: "payment", is_read: false, created_at: "2026-10-25T10:30:00Z" },
  { id: 6, title: "Obuna muddati tugashiga yaqin",       message: "Kamalak bog'chasi obunasi 14 kun ichida tugaydi. Yangilash tavsiya etiladi.", type: "warning", is_read: false, created_at: "2026-10-24T08:00:00Z" },
  { id: 5, title: "To'lov muvaffaqiyatsiz",              message: "Bahor bog'chasi — INV-2026-005 hisob-faktura uchun to'lov amalga oshmadi.",  type: "alert",   is_read: true,  created_at: "2026-10-23T16:25:00Z" },
  { id: 4, title: "Obuna bekor qilindi",                 message: "Bahor bog'chasi obunasi to'lov muammosi sababli bekor qilindi.",             type: "alert",   is_read: true,  created_at: "2026-10-23T16:30:00Z" },
  { id: 3, title: "Oylik daromad hisoboti",              message: "Oktyabr 2026: 6 800 000 UZS yig'ildi. O'tgan oyga nisbatan +12%.",          type: "info",    is_read: true,  created_at: "2026-10-20T09:00:00Z" },
  { id: 2, title: "Yangi tarif qo'shildi",               message: "Enterprise tarifi (2 400 000 UZS/oy) muvaffaqiyatli yaratildi.",            type: "info",    is_read: true,  created_at: "2026-10-21T10:05:00Z" },
  { id: 1, title: "Obuna yangilandi",                    message: "Armon bog'chasi — Premium tarif 12 oyga muvaffaqiyatli yangilandi.",         type: "payment", is_read: true,  created_at: "2026-10-19T11:00:00Z" },
];

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
      } else if (path.startsWith("/v1/super-admin/organizations")) {
        const qsIdx = path.indexOf("?");
        const params = qsIdx >= 0 ? new URLSearchParams(path.slice(qsIdx + 1)) : new URLSearchParams();
        const search  = (params.get("search") ?? "").toLowerCase();
        const status  = params.get("status") ?? "";
        const sort    = params.get("sort") ?? "newest";
        const page    = Math.max(1, parseInt(params.get("page") ?? "1"));
        const perPage = 15;

        let list = [...DEMO_SA_ORGANIZATIONS];

        if (search) {
          list = list.filter(o =>
            o.name.toLowerCase().includes(search) ||
            (o.phone ?? "").includes(search) ||
            (o.admin?.name ?? "").toLowerCase().includes(search)
          );
        }

        if      (status === "active")          list = list.filter(o => o.is_active && o.subscription?.status === "active");
        else if (status === "inactive")        list = list.filter(o => !o.is_active);
        else if (status === "trial")           list = list.filter(o => o.subscription?.status === "trial");
        else if (status === "paid")            list = list.filter(o => o.subscription?.status === "active");
        else if (status === "payment_overdue") list = list.filter(o => o.subscription?.status === "past_due");
        else if (status === "expired")         list = list.filter(o => o.subscription?.status === "expired");
        else if (status === "cancelled")       list = list.filter(o => o.subscription?.status === "cancelled");

        if      (sort === "newest")              list = [...list].reverse();
        else if (sort === "name")                list = [...list].sort((a, b) => a.name.localeCompare(b.name));
        else if (sort === "subscription_expiry") list = [...list].sort((a, b) => (a.subscription?.days_remaining ?? 9999) - (b.subscription?.days_remaining ?? 9999));
        // "oldest" = default insertion order (already oldest-first)

        const total = list.length;
        resolve({
          data: list.slice((page - 1) * perPage, page * perPage),
          meta: { current_page: page, last_page: Math.max(1, Math.ceil(total / perPage)), per_page: perPage, total },
        } as T);
      } else if (path.startsWith("/v1/super-admin/plans")) {
        resolve({ data: DEMO_SA_PLANS } as T);
      } else if (path.startsWith("/v1/super-admin/subscriptions/metrics")) {
        resolve({ data: DEMO_SA_SUBSCRIPTION_METRICS } as T);
      } else if (path.startsWith("/v1/super-admin/subscriptions")) {
        const qsIdx = path.indexOf("?");
        const params = qsIdx >= 0 ? new URLSearchParams(path.slice(qsIdx + 1)) : new URLSearchParams();
        const search  = (params.get("search") ?? "").toLowerCase();
        const status  = params.get("status") ?? "";
        const sort    = params.get("sort") ?? "newest";
        const page    = Math.max(1, parseInt(params.get("page") ?? "1"));
        const perPage = parseInt(params.get("per_page") ?? "20");
        let list = [...DEMO_SA_FULL_SUBSCRIPTIONS];
        if (search) list = list.filter(s => (s.organization?.name ?? "").toLowerCase().includes(search));
        if (status) list = list.filter(s => s.status === status);
        if (sort === "ending_soon") list = [...list].sort((a, b) => a.days_remaining - b.days_remaining);
        else list = [...list].reverse(); // newest = reverse insertion order
        const total = list.length;
        resolve({
          data: list.slice((page - 1) * perPage, page * perPage),
          meta: { current_page: page, last_page: Math.max(1, Math.ceil(total / perPage)), per_page: perPage, total },
        } as T);
      } else if (/^\/v1\/super-admin\/payments\/\d+/.test(path)) {
        const id = parseInt(path.replace(/^\/v1\/super-admin\/payments\//, ""));
        const found = DEMO_SA_PAYMENTS.find(p => p.id === id);
        resolve(found ? ({ data: found } as T) : (undefined as T));
      } else if (path.startsWith("/v1/super-admin/payments")) {
        const qsIdx = path.indexOf("?");
        const params = qsIdx >= 0 ? new URLSearchParams(path.slice(qsIdx + 1)) : new URLSearchParams();
        const search  = (params.get("search") ?? "").toLowerCase();
        const status  = params.get("status") ?? "";
        const method  = params.get("payment_method") ?? "";
        const page    = Math.max(1, parseInt(params.get("page") ?? "1"));
        const perPage = parseInt(params.get("per_page") ?? "20");
        let payList = [...DEMO_SA_PAYMENTS];
        if (search) payList = payList.filter(p => (p.organization?.name ?? "").toLowerCase().includes(search));
        if (status) payList = payList.filter(p => p.status === status);
        if (method) payList = payList.filter(p => p.payment_method === method);
        const payTotal = payList.length;
        resolve({
          data: payList.slice((page - 1) * perPage, page * perPage),
          meta: { current_page: page, last_page: Math.max(1, Math.ceil(payTotal / perPage)), per_page: perPage, total: payTotal },
          summary: DEMO_SA_PAYMENT_SUMMARY,
        } as T);
      } else if (/^\/v1\/super-admin\/invoices\/\d+/.test(path)) {
        const id = parseInt(path.replace(/^\/v1\/super-admin\/invoices\//, ""));
        const found = DEMO_SA_INVOICES.find(inv => inv.id === id);
        resolve(found ? ({ data: found } as T) : (undefined as T));
      } else if (path.startsWith("/v1/super-admin/invoices")) {
        const qsIdx = path.indexOf("?");
        const params = qsIdx >= 0 ? new URLSearchParams(path.slice(qsIdx + 1)) : new URLSearchParams();
        const search  = (params.get("search") ?? "").toLowerCase();
        const status  = params.get("status") ?? "";
        const page    = Math.max(1, parseInt(params.get("page") ?? "1"));
        const perPage = parseInt(params.get("per_page") ?? "20");
        let invList = [...DEMO_SA_INVOICES];
        if (search) invList = invList.filter(inv => (inv.organization?.name ?? "").toLowerCase().includes(search));
        if (status) invList = invList.filter(inv => inv.status === status);
        const invTotal = invList.length;
        resolve({
          data: invList.slice((page - 1) * perPage, page * perPage),
          meta: { current_page: page, last_page: Math.max(1, Math.ceil(invTotal / perPage)), per_page: perPage, total: invTotal },
          summary: DEMO_SA_INVOICE_SUMMARY,
        } as T);
      } else if (path.startsWith("/v1/super-admin/activity-logs")) {
        const qsIdx = path.indexOf("?");
        const params  = qsIdx >= 0 ? new URLSearchParams(path.slice(qsIdx + 1)) : new URLSearchParams();
        const orgId   = params.get("organization_id") ?? "";
        const page    = Math.max(1, parseInt(params.get("page") ?? "1"));
        const perPage = parseInt(params.get("per_page") ?? "30");
        let logList = [...DEMO_SA_ACTIVITY_LOGS];
        if (orgId) logList = logList.filter(l => String(l.organization?.id) === orgId);
        const logTotal = logList.length;
        resolve({
          data: logList.slice((page - 1) * perPage, page * perPage),
          meta: { current_page: page, last_page: Math.max(1, Math.ceil(logTotal / perPage)), per_page: perPage, total: logTotal },
        } as T);
      } else if (/^\/v1\/super-admin\/notifications\/\d+\/read/.test(path)) {
        resolve(undefined as T);
      } else if (path.startsWith("/v1/super-admin/notifications/read-all")) {
        resolve(undefined as T);
      } else if (path.startsWith("/v1/super-admin/notifications")) {
        const unread = DEMO_SA_NOTIFICATIONS.filter(n => !n.is_read).length;
        resolve({ data: DEMO_SA_NOTIFICATIONS, unread_count: unread } as T);
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
