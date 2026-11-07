"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { errorMessage, fieldErrors, RELATION_LABELS } from "@/lib/apiErrors";
import { IS_DEMO } from "@/lib/demo-data";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import Modal from "@/components/ui/Modal";
import type { ApiResponse, Child, ParentChildLink, ParentProfile, ParentRelation } from "@/types";
import uz from "@/i18n/uz";
import { useReadOnly } from "@/lib/readOnly";

interface ChildParentsModalProps {
  child: Child | null;
  onClose: () => void;
}

interface LinkedParent {
  parent: ParentProfile;
  link?: ParentChildLink;
}

const fullName = (p: { first_name: string; last_name: string }) => `${p.last_name} ${p.first_name}`;

export default function ChildParentsModal({ child, onClose }: ChildParentsModalProps) {
  const readOnly = useReadOnly();
  const [parents,   setParents]   = useState<ParentProfile[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [loadError, setLoadError] = useState("");

  const [parentId,   setParentId]   = useState("");
  const [relation,   setRelation]   = useState<ParentRelation | "">("");
  const [isPrimary,  setIsPrimary]  = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [unlinkId,   setUnlinkId]   = useState<number | null>(null);

  const [busy,        setBusy]        = useState(false);
  const [actionError, setActionError] = useState("");
  const [formErrors,  setFormErrors]  = useState<Record<string, string[]>>({});
  const [success,     setSuccess]     = useState("");

  const load = useCallback(async () => {
    setLoadError("");
    setLoading(true);
    try {
      const res = await api.get<ApiResponse<ParentProfile[]>>("/v1/admin/parents");
      setParents(res?.data ?? []);
    } catch (err: unknown) {
      setLoadError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!child) return;
    setParentId("");
    setRelation("");
    setIsPrimary(false);
    setConfirming(false);
    setUnlinkId(null);
    setActionError("");
    setFormErrors({});
    setSuccess("");
    load();
  }, [child, load]);

  if (!child) return null;

  // Bog'lanishlar GET /v1/admin/parents javobidagi children[].pivot dan olinadi
  const linked: LinkedParent[] = parents.flatMap((p) =>
    (p.children ?? []).filter((c) => c.id === child.id).map((c) => ({ parent: p, link: c.pivot })),
  );
  const available = parents.filter((p) => !linked.some((l) => l.parent.id === p.id));
  const selected  = available.find((p) => String(p.id) === parentId);

  function startLink(e: React.FormEvent) {
    e.preventDefault();
    setActionError("");
    setSuccess("");
    setConfirming(true);
  }

  async function confirmLink() {
    if (busy || IS_DEMO || !selected || !child) return;
    setBusy(true);
    setActionError("");
    setFormErrors({});
    try {
      await api.post(`/v1/admin/children/${child.id}/parents`, {
        parent_profile_id: selected.id,
        relation_type:     relation,
        is_primary:        isPrimary,
      });
      setParentId("");
      setRelation("");
      setIsPrimary(false);
      setConfirming(false);
      setSuccess(uz.bolalar.boglandi);
      await load();
    } catch (err: unknown) {
      setFormErrors(fieldErrors(err));
      setActionError(errorMessage(err));
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  async function confirmUnlink(id: number) {
    if (busy || IS_DEMO || !child) return;
    setBusy(true);
    setActionError("");
    setSuccess("");
    try {
      await api.delete(`/v1/admin/children/${child.id}/parents/${id}`);
      setUnlinkId(null);
      setSuccess(uz.bolalar.olib_tashlandi);
      await load();
    } catch (err: unknown) {
      setActionError(errorMessage(err));
      setUnlinkId(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`${uz.bolalar.ota_onalar_btn}: ${fullName(child)}`} size="lg">
      <div className="space-y-5">
        {IS_DEMO && (
          <p role="note" className="rounded-lg bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] text-sm px-3 py-2">{uz.common.demo_saqlanmaydi}</p>
        )}
        {success && (
          <p role="status" className="rounded-lg bg-[var(--success-bg)] text-[var(--success)] text-sm px-3 py-2">{success}</p>
        )}
        {actionError && (
          <p role="alert" className="text-sm text-[#B91C1C]">{actionError}</p>
        )}

        {loading ? (
          <p className="text-sm text-[#766B73]">{uz.common.yuklanmoqda}</p>
        ) : loadError ? (
          <div className="text-sm">
            <p role="alert" className="text-[#B91C1C] mb-2">{loadError}</p>
            <Button variant="secondary" size="sm" onClick={load}>{uz.common.qayta_urinish}</Button>
          </div>
        ) : (
          <>
            <section>
              <h3 className="text-sm font-semibold text-[var(--text)] mb-2">{uz.bolalar.boglangan_ota_onalar}</h3>
              {linked.length === 0 ? (
                <p className="text-sm text-[#766B73]">{uz.bolalar.ota_ona_boglanmagan}</p>
              ) : (
                <ul className="divide-y divide-[#F2ECF0] border border-[#EDE3E8] rounded-lg">
                  {linked.map(({ parent, link }) => (
                    <li key={parent.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-sm">
                      <span className="font-medium text-[#29232A]">{fullName(parent)}</span>
                      <span className="text-[#766B73]">{link ? RELATION_LABELS[link.relation_type] ?? link.relation_type : "—"}</span>
                      {link?.is_primary && <Badge variant="info">{uz.bolalar.asosiy_vakil}</Badge>}
                      <span className="flex-1" />
                      {unlinkId === parent.id ? (
                        <span className="flex items-center gap-2">
                          <span className="text-xs text-[#766B73]">{uz.bolalar.olib_tashlash_tasdiq}</span>
                          <Button size="sm" variant="danger" loading={busy} onClick={() => confirmUnlink(parent.id)}>{uz.common.tasdiqlash}</Button>
                          <Button size="sm" variant="secondary" disabled={busy} onClick={() => setUnlinkId(null)}>{uz.common.bekor_qilish}</Button>
                        </span>
                      ) : !readOnly && (
                        <Button size="sm" variant="ghost" disabled={IS_DEMO || busy} onClick={() => { setSuccess(""); setUnlinkId(parent.id); }}>
                          {uz.bolalar.olib_tashlash}
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Faqat ko'rish rejimida bog'lash bo'limi ko'rsatilmaydi */}
            {!readOnly && <section>
              <h3 className="text-sm font-semibold text-[var(--text)] mb-2">{uz.bolalar.ota_ona_boglash}</h3>
              {available.length === 0 ? (
                <p className="text-sm text-[#766B73]">{parents.length === 0 ? uz.bolalar.ota_ona_yoq : uz.bolalar.hammasi_boglangan}</p>
              ) : confirming && selected ? (
                <div className="rounded-lg border border-[#EDE3E8] bg-[#FAF5F8] p-3 space-y-3 text-sm">
                  <p className="text-[#3D3240]">{uz.bolalar.boglash_tasdiq}</p>
                  <p className="font-medium text-[#29232A]">
                    {fullName(selected)} → {fullName(child)} · {relation ? RELATION_LABELS[relation] : ""}
                    {isPrimary ? ` · ${uz.bolalar.asosiy_vakil}` : ""}
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" loading={busy} disabled={IS_DEMO} onClick={confirmLink}>{uz.common.tasdiqlash}</Button>
                    <Button size="sm" variant="secondary" disabled={busy} onClick={() => setConfirming(false)}>{uz.common.bekor_qilish}</Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={startLink} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Select
                      label={uz.bolalar.ota_ona}
                      value={parentId}
                      onChange={(e) => setParentId(e.target.value)}
                      error={formErrors.parent_profile_id?.[0]}
                      required
                    >
                      <option value="">{uz.common.tanlang}</option>
                      {available.map((p) => (
                        <option key={p.id} value={p.id}>{fullName(p)} · {p.phone}</option>
                      ))}
                    </Select>
                    <Select
                      label={uz.ota_onalar.qarindoshlik}
                      value={relation}
                      onChange={(e) => setRelation(e.target.value as ParentRelation | "")}
                      error={formErrors.relation_type?.[0]}
                      required
                    >
                      <option value="">{uz.common.tanlang}</option>
                      {(Object.keys(RELATION_LABELS) as ParentRelation[]).map((r) => (
                        <option key={r} value={r}>{RELATION_LABELS[r]}</option>
                      ))}
                    </Select>
                  </div>
                  <label className="flex items-start gap-2 text-sm text-[#3D3240]">
                    <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} className="mt-0.5" />
                    <span>
                      {uz.bolalar.asosiy_vakil}
                      <span className="block text-xs text-[#766B73]">{uz.bolalar.asosiy_vakil_izoh}</span>
                    </span>
                  </label>
                  <Button type="submit" size="sm" disabled={IS_DEMO || busy}>{uz.bolalar.boglash}</Button>
                </form>
              )}
            </section>}
          </>
        )}
      </div>
    </Modal>
  );
}
