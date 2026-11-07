"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { errorMessage, fieldErrors } from "@/lib/apiErrors";
import { IS_DEMO } from "@/lib/demo-data";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import PageHeader from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import type { SentMessage } from "@/types";
import uz from "@/i18n/uz";
import { useReadOnly } from "@/lib/readOnly";

type Audience = "child" | "group";

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Xabar yuborishda tanlanadigan bola (tarbiyachi va admin API'lari uchun umumiy maydonlar). */
interface MessageChild {
  id: number;
  first_name: string;
  last_name: string;
  is_active: boolean;
  group?: { id: number } | null;
}

interface MessagesManagerProps {
  /** GET (tarix + guruhlar) va POST (yuborish) uchun, masalan "/v1/teacher/messages". */
  messagesPath: string;
  /** Bolalar ro'yxati, masalan "/v1/teacher/children". */
  childrenPath: string;
  description: string;
  noGroupsText: string;
}

/** Ota-onalarga xabar: bitta bola yoki butun guruh; yuborilganlar tarixi va o'qilgan holati. Real-time yo'q. */
export default function MessagesManager({ messagesPath, childrenPath, description, noGroupsText }: MessagesManagerProps) {
  const readOnly = useReadOnly();
  const [groups,   setGroups]   = useState<{ id: number; name: string }[]>([]);
  const [children, setChildren] = useState<MessageChild[]>([]);
  const [messages, setMessages] = useState<SentMessage[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [loadErr,  setLoadErr]  = useState("");

  const [audience, setAudience] = useState<Audience>("child");
  const [groupId,  setGroupId]  = useState("");
  const [childId,  setChildId]  = useState("");
  const [subject,  setSubject]  = useState("");
  const [body,     setBody]     = useState("");
  const [sending,  setSending]  = useState(false);
  const [errors,   setErrors]   = useState<Record<string, string[]>>({});
  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState("");
  const [search,   setSearch]   = useState("");
  const [openId,   setOpenId]   = useState<number | null>(null);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadErr("");
    try {
      const [msg, kids] = await Promise.all([
        api.get<{ groups: { id: number; name: string }[]; data: SentMessage[] }>(messagesPath),
        api.get<{ data: MessageChild[] }>(childrenPath),
      ]);
      setGroups(msg.groups);
      setMessages(msg.data);
      setChildren(kids.data.filter((c) => c.is_active));
    } catch (err: unknown) {
      const e = err as { status?: number; data?: { message?: string } };
      setLoadErr(e?.status === 403 && e.data?.message ? e.data.message : errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [messagesPath, childrenPath]);

  useEffect(() => { if (!IS_DEMO) load(); }, [load]);

  const activeGroup = groupId || String(groups[0]?.id ?? "");
  const groupChildren = children.filter((c) => String(c.group?.id) === activeGroup);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter((m) => [m.subject ?? "", m.body, m.child ? `${m.child.last_name} ${m.child.first_name}` : ""].join(" ").toLowerCase().includes(q));
  }, [messages, search]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (inFlight.current) return;
    const local: Record<string, string[]> = {};
    if (!body.trim()) local.body = [uz.xabarlar.matn_majburiy];
    if (audience === "child" && !childId) local.child_id = [uz.xabarlar.bola_majburiy];
    setErrors(local);
    setError("");
    setSuccess("");
    if (Object.keys(local).length) return;

    inFlight.current = true;
    setSending(true);
    try {
      const res = await api.post<{ data: SentMessage }>(messagesPath, {
        audience,
        group_id: Number(activeGroup),
        child_id: audience === "child" ? Number(childId) : null,
        subject:  subject.trim() || null,
        body:     body.trim(),
      });
      setMessages((cur) => [res.data, ...cur]);
      setSubject("");
      setBody("");
      setSuccess(uz.xabarlar.yuborildi);
    } catch (err: unknown) {
      setErrors(fieldErrors(err));
      setError(fieldErrors(err).audience?.[0] ?? errorMessage(err));
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  }

  if (IS_DEMO) {
    return (
      <div className="max-w-5xl mx-auto">
        <PageHeader title={uz.xabarlar.sarlavha} description={description} />
        <p role="note" className="rounded-lg bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] text-sm px-4 py-3">{uz.kundalik.demo}</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <PageHeader title={uz.xabarlar.sarlavha} description={description} />
      <p role="note" className="rounded-lg bg-[#FAF5F8] border border-[#EDE3E8] text-[#766B73] text-xs px-4 py-2.5">{uz.xabarlar.izoh}</p>

      {loading ? (
        <div className="space-y-3" aria-busy="true"><Skeleton className="h-48" /><Skeleton className="h-32" /></div>
      ) : loadErr ? (
        <div className="bg-white rounded-xl border border-[#EDE3E8] p-8 text-center">
          <p role="alert" className="text-sm text-[#766B73] mb-3">{loadErr}</p>
          <Button size="sm" variant="secondary" onClick={load}>{uz.common.qayta_urinish}</Button>
        </div>
      ) : groups.length === 0 ? (
        <p className="bg-white rounded-xl border border-[#EDE3E8] p-8 text-center text-sm text-[#766B73]">{noGroupsText}</p>
      ) : (
        <>
          {/* Ko'rish rejimida yangi xabar yozilmaydi — faqat yuborilganlar tarixi */}
          {!readOnly && <form onSubmit={send} className="bg-white rounded-2xl border border-[#EDE3E8] p-5 space-y-4" aria-label={uz.xabarlar.yangi} noValidate>
            <h2 className="text-sm font-semibold text-[#29232A]">{uz.xabarlar.yangi}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Select id="msg-audience" label={uz.xabarlar.kimga} value={audience} onChange={(e) => { setAudience(e.target.value as Audience); setErrors({}); }}>
                <option value="child">{uz.xabarlar.bitta_bola}</option>
                <option value="group">{uz.xabarlar.butun_guruh}</option>
              </Select>
              {groups.length > 1 && (
                <Select id="msg-group" label={uz.xabarlar.guruh} value={activeGroup} onChange={(e) => { setGroupId(e.target.value); setChildId(""); }}>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </Select>
              )}
              {audience === "child" && (
                <Select id="msg-child" label={uz.xabarlar.bola} value={childId} onChange={(e) => setChildId(e.target.value)} error={errors.child_id?.[0]}>
                  <option value="">{uz.common.tanlang}</option>
                  {groupChildren.map((c) => <option key={c.id} value={c.id}>{c.last_name} {c.first_name}</option>)}
                </Select>
              )}
            </div>
            <Input id="msg-subject" label={uz.xabarlar.mavzu} value={subject} maxLength={150} onChange={(e) => setSubject(e.target.value)} error={errors.subject?.[0]} />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="msg-body" className="text-sm font-medium text-[var(--text)]">{uz.xabarlar.matn} <span className="text-[#EF4444]">*</span></label>
              <textarea id="msg-body" rows={4} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)}
                className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-[#29232A] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 ${errors.body ? "border-[#EF4444]" : "border-[#EDE3E8]"}`} />
              <div className="flex justify-between text-xs">
                <span className="text-[#B91C1C]">{errors.body?.[0]}</span>
                <span className="text-[#B8AAB2]">{body.length}/2000</span>
              </div>
            </div>
            {error && <p role="alert" className="text-sm text-[#B91C1C]">{error}</p>}
            {success && <p role="status" className="text-sm text-[var(--success)]">{success}</p>}
            <div className="flex justify-end">
              <Button type="submit" loading={sending}>{uz.xabarlar.yuborish}</Button>
            </div>
          </form>}

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-[#29232A]">{uz.xabarlar.tarix}</h2>
              <div className="w-full sm:w-72">
                <Input id="msg-search" aria-label={uz.xabarlar.qidirish} placeholder={uz.xabarlar.qidirish} value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
            {filtered.length === 0 ? (
              <p className="bg-white rounded-xl border border-[#EDE3E8] p-8 text-center text-sm text-[#766B73]">{uz.xabarlar.tarix_yoq}</p>
            ) : (
              <ul className="space-y-2" data-testid="message-history">
                {filtered.map((m) => (
                  <li key={m.id} className="bg-white rounded-xl border border-[#EDE3E8] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#29232A]">
                          {m.audience === "group" ? `${uz.xabarlar.guruhga}: ${m.group?.name ?? ""}` : `${m.child?.last_name} ${m.child?.first_name}`}
                        </p>
                        <p className="text-xs text-[#B8AAB2]">{formatDateTime(m.created_at)}{m.sender ? ` · ${m.sender}` : ""}</p>
                      </div>
                      <Badge variant={m.read_count === m.recipients_count ? "success" : "neutral"}>
                        {m.read_count}/{m.recipients_count} {uz.xabarlar.oqildi}
                      </Badge>
                    </div>
                    {m.subject && <p className="mt-2 text-sm font-medium text-[#3D3240]">{m.subject}</p>}
                    <p className="mt-1 text-sm text-[#3D3240] whitespace-pre-line break-words">{m.body}</p>
                    <button type="button" className="mt-2 text-xs text-[var(--primary)] hover:underline"
                      aria-expanded={openId === m.id} onClick={() => setOpenId(openId === m.id ? null : m.id)}>
                      {uz.xabarlar.qabul_qiluvchilar} ({m.recipients_count})
                    </button>
                    {openId === m.id && (
                      <ul className="mt-2 space-y-1 text-xs text-[#766B73]">
                        {m.recipients.map((r, i) => (
                          <li key={i} className="flex flex-wrap justify-between gap-2">
                            <span>{r.name}{r.child ? ` (${r.child})` : ""}</span>
                            <span>{r.read_at ? `${uz.xabarlar.oqildi}: ${formatDateTime(r.read_at)}` : uz.xabarlar.oqilmagan}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
