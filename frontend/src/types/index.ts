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

export interface OrganizationSummary {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  is_active: boolean;
  created_at: string;
  admin: { id: number; name: string; phone: string | null } | null;
  subscription: Subscription | null;
}

export interface OrganizationDetail extends OrganizationSummary {
  admins: Pick<User, "id" | "name" | "phone" | "email" | "is_active">[];
  groups_count: number;
  children_count: number;
  teacher_profiles_count: number;
  parent_profiles_count: number;
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

export interface TeacherProfile {
  id: number;
  user_id: number;
  organization_id: number;
  first_name: string;
  last_name: string;
  phone: string;
  position: string;
  is_active: boolean;
  groups?: Pick<Group, "id" | "name">[];
}

export interface ParentProfile {
  id: number;
  user_id: number | null;
  organization_id: number;
  first_name: string;
  last_name: string;
  phone: string;
  children?: Pick<Child, "id" | "first_name" | "last_name">[];
}

export interface DashboardSummary {
  bolalar_soni: number;
  guruhlar_soni: number;
  tarbiyachilar_soni: number;
  ota_onalar_soni: number;
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
  jami_bogchalar: number;
  faol_bogchalar: number;
  nofaol_bogchalar: number;
  yangi_bogchalar: number;
  muddati_yaqin: number;
  tolov_kutilmoqda: number;
  jami_foydalanuvchilar: number;
  oxirgi_bogchalar: {
    id: number;
    name: string;
    phone: string | null;
    is_active: boolean;
    created_at: string;
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
