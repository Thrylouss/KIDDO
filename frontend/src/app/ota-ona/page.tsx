"use client";

import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { landingFor } from "@/lib/roles";
import uz from "@/i18n/uz";

const t = uz.mobil_ilova;

/**
 * Do'kon havolalari faqat env orqali berilgan va rasmiy domendagi https manzil bo'lsa ko'rsatiladi
 * (NEXT_PUBLIC_APP_STORE_URL, NEXT_PUBLIC_GOOGLE_PLAY_URL). Hozircha ilova chiqmagan — havola yo'q.
 */
function storeLinks(): { label: string; href: string }[] {
  const candidates = [
    { label: "App Store",   href: process.env.NEXT_PUBLIC_APP_STORE_URL,   host: "apps.apple.com" },
    { label: "Google Play", href: process.env.NEXT_PUBLIC_GOOGLE_PLAY_URL, host: "play.google.com" },
  ];
  return candidates.flatMap(({ label, href, host }) => {
    try {
      const url = new URL(href ?? "");
      return url.protocol === "https:" && url.hostname === host ? [{ label, href: url.toString() }] : [];
    } catch {
      return [];
    }
  });
}

const FEATURES: { title: string; text: string; icon: string }[] = [
  { title: t.imk_davomat,  text: t.imk_davomat_t,  icon: "M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { title: t.imk_kundalik, text: t.imk_kundalik_t, icon: "M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" },
  { title: t.imk_suratlar, text: t.imk_suratlar_t, icon: "M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A1.5 1.5 0 0021.75 19.5v-15A1.5 1.5 0 0020.25 3H3.75A1.5 1.5 0 002.25 4.5v15A1.5 1.5 0 003.75 21zM15 8.25h.008v.008H15V8.25z" },
  { title: t.imk_xabarlar, text: t.imk_xabarlar_t, icon: "M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" },
  { title: t.imk_tolovlar, text: t.imk_tolovlar_t, icon: "M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" },
];

function Icon({ d, className }: { d: string; className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

/** Telefon ko'rinishidagi bezak (faqat katta ekranlarda) — haqiqiy ilova skrinshoti emas. */
function PhonePreview() {
  return (
    <div aria-hidden="true" className="relative mx-auto w-[220px] h-[440px] rounded-[2.5rem] bg-[#29232A] p-3 shadow-2xl shadow-[#8E315D]/25">
      <div className="h-full w-full rounded-[2rem] bg-[#FFF9F5] overflow-hidden flex flex-col">
        <div className="bg-[#8E315D] px-4 pt-6 pb-5 text-white">
          <div className="mx-auto mb-4 h-1.5 w-16 rounded-full bg-white/30" />
          <p className="text-[11px] text-white/70">KIDDO</p>
          <div className="mt-1 h-3 w-28 rounded bg-white/80" />
          <div className="mt-2 h-2 w-20 rounded bg-white/40" />
        </div>
        <div className="flex-1 space-y-2.5 p-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="flex items-center gap-2.5 rounded-xl bg-white border border-[#EDE3E8] p-2.5">
              <span className="h-7 w-7 rounded-lg bg-[#FDF2F6] text-[#8E315D] flex items-center justify-center flex-shrink-0">
                <Icon d={f.icon} className="h-4 w-4" />
              </span>
              <span className="text-[11px] font-medium text-[#3D3240] truncate">{f.title}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** /ota-ona — KIDDO mobil ilovasi haqida axborot sahifasi. Farzand ma'lumotlari web'da yuklanmaydi. */
export default function OtaOnaPage() {
  const { user, logout } = useAuth();
  const stores = storeLinks();

  // Boshqa rol (rahbar, tarbiyachi, Super Admin) bu manzilni ochsa — o'z paneliga qaytadi
  const otherRole = !!user && user.role !== "parent";
  useEffect(() => {
    if (user && user.role !== "parent") window.location.replace(landingFor(user));
  }, [user]);

  async function leave() {
    await logout().catch(() => {});
    window.location.href = "/login";
  }

  if (otherRole) return null;

  return (
    <div className="min-h-screen bg-[#FFF9F5] text-[#29232A]">
      <header className="mx-auto max-w-6xl px-4 sm:px-6 py-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="h-9 w-9 rounded-xl bg-[#8E315D] flex items-center justify-center text-white">
            <Icon d="M12 3v1m0 16v1m8.66-9h-1M4.34 12h-1m14.95 5.66l-.707-.707M6.757 6.757l-.707-.707m12.02 0l-.707.707M6.757 17.243l-.707.707" className="h-5 w-5" />
          </span>
          <span className="text-xl font-bold tracking-tight">KIDDO</span>
        </div>
        <button
          type="button"
          onClick={user ? leave : () => { window.location.href = "/login"; }}
          className="text-sm font-medium text-[#8E315D] hover:text-[#742548] px-3 py-2 rounded-lg hover:bg-[#FDF2F6] transition-colors"
        >
          {user ? uz.auth.chiqish : t.kirishga}
        </button>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 pb-16">
        <section className="relative overflow-hidden rounded-3xl bg-white border border-[#EDE3E8] px-5 py-10 sm:px-10 sm:py-14 lg:py-16">
          <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-[#FDF2F6] blur-3xl pointer-events-none" aria-hidden="true" />
          <div className="relative grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_260px] gap-10 items-center">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-2 rounded-full bg-[#FDF2F6] px-3 py-1 text-xs font-semibold text-[#8E315D]">
                <Icon d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" className="h-3.5 w-3.5" />
                {t.belgi}
              </span>
              <h1 className="mt-4 text-2xl sm:text-4xl font-bold leading-tight tracking-tight">{t.sahifa_sarlavha}</h1>
              <p className="mt-4 text-base sm:text-lg text-[#766B73] leading-relaxed max-w-2xl">{t.sahifa_izoh}</p>

              {stores.length > 0 && (
                <div data-testid="store-links" className="mt-7">
                  <p className="text-sm font-semibold mb-3">{t.yuklab_olish}</p>
                  <div className="flex flex-wrap gap-3">
                    {stores.map((s) => (
                      <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
                        className="inline-flex h-11 items-center rounded-xl bg-[#29232A] px-5 text-sm font-semibold text-white hover:bg-black transition-colors">
                        {s.label}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="hidden lg:block"><PhonePreview /></div>
          </div>
        </section>

        <section aria-labelledby="imkoniyatlar" className="mt-10">
          <h2 id="imkoniyatlar" className="text-lg font-semibold mb-4">{t.imkoniyatlar}</h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {FEATURES.map((f) => (
              <li key={f.title} className="min-w-0 rounded-2xl bg-white border border-[#EDE3E8] p-4 flex lg:flex-col gap-3">
                <span className="h-10 w-10 rounded-xl bg-[#FDF2F6] text-[#8E315D] flex items-center justify-center flex-shrink-0">
                  <Icon d={f.icon} className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{f.title}</p>
                  <p className="text-xs text-[#766B73] mt-0.5 leading-relaxed">{f.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <aside role="note" className="mt-10 rounded-2xl bg-[#8E315D] text-white p-5 sm:p-6 flex gap-4">
          <span className="h-10 w-10 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
            <Icon d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" className="h-5 w-5" />
          </span>
          <div className="min-w-0 space-y-2 text-sm leading-relaxed">
            <p>{t.sahifa_qoshimcha}</p>
            <p className="text-white/75">{t.login_izoh}</p>
          </div>
        </aside>

        <p className="mt-6 text-center text-xs text-[#B8AAB2]">{t.web_yoq}</p>
      </main>
    </div>
  );
}
