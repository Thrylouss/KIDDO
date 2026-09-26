"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import uz from "@/i18n/uz";
import type { Notification, OrganizationSummary, ApiResponse } from "@/types";

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("uz-UZ", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function typeVariant(type: string): "info" | "warning" | "error" | "neutral" {
  if (type === "info")    return "info";
  if (type === "warning") return "warning";
  if (type === "alert")   return "error";
  return "neutral";
}

function typeLabel(type: string): string {
  return {
    info:    uz.super_admin.turi_info,
    warning: uz.super_admin.turi_warning,
    alert:   uz.super_admin.turi_alert,
    payment: uz.super_admin.turi_payment,
  }[type] ?? type;
}

// ── Send Modal ─────────────────────────────────────────────────────────────

interface SendForm {
  title:           string;
  message:         string;
  type:            "info" | "warning" | "alert" | "payment";
  organization_id: string;
}

const emptyForm: SendForm = { title: "", message: "", type: "info", organization_id: "" };

function SendModal({
  open,
  orgs,
  onClose,
  onSent,
}: {
  open: boolean;
  orgs: OrganizationSummary[];
  onClose: () => void;
  onSent: () => void;
}) {
  const [form,   setForm]   = useState<SendForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  function close() {
    setForm(emptyForm);
    setErrors({});
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setSaving(true);
    try {
      await api.post("/v1/super-admin/notifications", {
        title:           form.title,
        message:         form.message,
        type:            form.type,
        organization_id: form.organization_id ? parseInt(form.organization_id) : null,
      });
      onSent();
      close();
    } catch (err: unknown) {
      const e = err as { data?: { errors?: Record<string, string[]> } };
      if (e?.data?.errors) setErrors(e.data.errors);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={uz.super_admin.xabar_yuborish}
      footer={
        <>
          <Button variant="secondary" onClick={close}>{uz.common.bekor_qilish}</Button>
          <Button form="send-form" type="submit" loading={saving}>{uz.super_admin.xabar_yuborish}</Button>
        </>
      }
    >
      <form id="send-form" onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={uz.super_admin.xabar_sarlavha}
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          error={errors.title?.[0]}
          required
        />
        <div>
          <label className="block text-sm font-medium text-[#374151] mb-1.5">
            {uz.super_admin.xabar_matni} <span className="text-[#EF4444]">*</span>
          </label>
          <textarea
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            required
            rows={4}
            className="w-full rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 text-sm text-[#111827] placeholder:text-[#9CA3AF] outline-none transition-all focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 resize-none"
            placeholder="Xabar matnini kiriting..."
          />
          {errors.message?.[0] && (
            <p className="mt-1 text-xs text-[#EF4444]">{errors.message[0]}</p>
          )}
        </div>
        <Select
          label={uz.super_admin.xabar_turi}
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value as SendForm["type"] })}
          error={errors.type?.[0]}
          required
        >
          <option value="info">{uz.super_admin.turi_info}</option>
          <option value="warning">{uz.super_admin.turi_warning}</option>
          <option value="alert">{uz.super_admin.turi_alert}</option>
          <option value="payment">{uz.super_admin.turi_payment}</option>
        </Select>
        <Select
          label={uz.super_admin.qabul_qiluvchi}
          value={form.organization_id}
          onChange={(e) => setForm({ ...form, organization_id: e.target.value })}
        >
          <option value="">{uz.super_admin.barcha_bogchalar}</option>
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </Select>
      </form>
    </Modal>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function XabarlarPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [orgs,          setOrgs]          = useState<OrganizationSummary[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [showSend,      setShowSend]      = useState(false);
  const [markingAll,    setMarkingAll]    = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nRes, oRes] = await Promise.all([
        api.get<{ data: Notification[]; unread_count: number }>("/v1/super-admin/notifications"),
        api.get<ApiResponse<OrganizationSummary[]>>("/v1/super-admin/organizations"),
      ]);
      setNotifications(nRes.data);
      setUnreadCount(nRes.unread_count);
      setOrgs(oRes.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function markRead(id: number) {
    await api.patch(`/v1/super-admin/notifications/${id}/read`);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  async function markAllRead() {
    setMarkingAll(true);
    try {
      await api.patch("/v1/super-admin/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } finally {
      setMarkingAll(false);
    }
  }

  const bellIcon = (
    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[#111827]">{uz.super_admin.xabarlar}</h1>
          {unreadCount > 0 && (
            <span className="inline-flex items-center justify-center h-6 min-w-[24px] px-1.5 rounded-full bg-[#7C3AED] text-white text-xs font-bold">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button variant="secondary" onClick={markAllRead} loading={markingAll}>
              {uz.super_admin.hammasi_oqildi}
            </Button>
          )}
          <Button onClick={() => setShowSend(true)} icon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          }>
            {uz.super_admin.xabar_yuborish}
          </Button>
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
        {loading ? (
          <div className="animate-pulse divide-y divide-[#F3F4F6]">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-start gap-4 px-5 py-4">
                <div className="h-9 w-9 rounded-lg bg-[#F3F4F6] flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 bg-[#F3F4F6] rounded" />
                  <div className="h-3 w-64 bg-[#F3F4F6] rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-16">
            <EmptyState title={uz.super_admin.xabar_yoq} icon={bellIcon} />
          </div>
        ) : (
          <ul className="divide-y divide-[#F3F4F6]">
            {notifications.map((n) => (
              <li
                key={n.id}
                className={`flex items-start gap-4 px-5 py-4 transition-colors ${
                  n.is_read ? "bg-white" : "bg-[#FAFAFF]"
                }`}
              >
                {/* Type icon */}
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  n.type === "alert"   ? "bg-[#FEF2F2] text-[#EF4444]" :
                  n.type === "warning" ? "bg-[#FFFBEB] text-[#F59E0B]" :
                  n.type === "payment" ? "bg-[#F0FDF4] text-[#22C55E]" :
                                        "bg-[#EFF6FF] text-[#2563EB]"
                }`}>
                  {n.type === "alert" ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
                    </svg>
                  ) : n.type === "payment" ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : n.type === "warning" ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                    </svg>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`text-sm font-semibold ${n.is_read ? "text-[#374151]" : "text-[#111827]"}`}>
                        {n.title}
                      </p>
                      <Badge variant={typeVariant(n.type)}>{typeLabel(n.type)}</Badge>
                      {!n.is_read && (
                        <span className="h-2 w-2 rounded-full bg-[#7C3AED] flex-shrink-0" />
                      )}
                    </div>
                    <span className="text-xs text-[#9CA3AF] flex-shrink-0">{fmtDate(n.created_at)}</span>
                  </div>
                  <p className="text-sm text-[#6B7280] mt-0.5 leading-relaxed">{n.message}</p>
                  {!n.is_read && (
                    <button
                      onClick={() => markRead(n.id)}
                      className="mt-2 text-xs text-[#7C3AED] hover:text-[#6D28D9] font-medium transition-colors"
                    >
                      {uz.super_admin.o_qildi} deb belgilash
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Send modal */}
      <SendModal
        open={showSend}
        orgs={orgs}
        onClose={() => setShowSend(false)}
        onSent={load}
      />
    </div>
  );
}
