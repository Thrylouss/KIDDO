import type { Metadata } from "next";
import Link from "next/link";
import LandingAuthRedirect from "@/components/landing/LandingAuthRedirect";
import Reveal from "@/components/landing/Reveal";
import BrowserFrame from "@/components/landing/BrowserFrame";
import DemoRequestForm from "@/components/landing/DemoRequestForm";
import { PhoneMockup } from "@/components/landing/PhoneMockup";
import { Icon } from "@/components/landing/icons";
import { SITE_CONTACT, hasContact, telegramUrl } from "@/lib/site";
import uz from "@/i18n/uz";

const t = uz.landing;

export const metadata: Metadata = {
  title: "KIDDO — Bog'cha boshqaruv platformasi",
  description: t.hero_tavsif,
  openGraph: { title: "KIDDO — Bog'cha boshqaruv platformasi", description: t.hero_tavsif, locale: "uz_UZ", type: "website" },
};

const NAV = [
  { href: "#imkoniyatlar", label: t.nav_imkoniyatlar },
  { href: "#rahbar", label: t.nav_rahbar },
  { href: "#tarbiyachi", label: t.nav_tarbiyachi },
  { href: "#ota-onalar", label: t.nav_ota_onalar },
  { href: "#qanday-ishlaydi", label: t.nav_qanday },
];

/** public/landing — dev muhitida namoyish ma'lumotlari bilan olingan haqiqiy skrinshotlar */
const SHOTS = {
  dashboard:  { src: "/landing/rahbar-dashboard.jpg",     width: 1456, height: 835, path: "kiddo.uz/bogcha/dashboard" },
  bolalar:    { src: "/landing/rahbar-bolalar.jpg",       width: 1531, height: 784, path: "kiddo.uz/bogcha/bolalar" },
  tolovlar:   { src: "/landing/rahbar-tolovlar.jpg",      width: 1531, height: 784, path: "kiddo.uz/bogcha/tolovlar" },
  davomat:    { src: "/landing/rahbar-davomat.jpg",       width: 1531, height: 784, path: "kiddo.uz/bogcha/davomat" },
  tarbiyachi: { src: "/landing/tarbiyachi-dashboard.jpg", width: 1531, height: 784, path: "kiddo.uz/tarbiyachi" },
};

const WHY_ICONS = ["sliders", "eye", "sparkle", "shield"];

function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className={`h-9 w-9 rounded-xl flex items-center justify-center ${light ? "bg-white/15" : "bg-[#8F3158]"}`}>
        <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m8.66-9h-1M4.34 12h-1m14.95 5.66l-.707-.707M6.757 6.757l-.707-.707m12.02 0l-.707.707M6.757 17.243l-.707.707" />
        </svg>
      </span>
      <span className={`text-xl font-bold tracking-tight ${light ? "text-white" : "text-[#29232A]"}`}>KIDDO</span>
    </span>
  );
}

function SectionHead({ eyebrow, title, text, center = true }: { eyebrow: string; title: string; text?: string; center?: boolean }) {
  return (
    <Reveal className={`max-w-2xl ${center ? "mx-auto text-center" : ""}`}>
      <p className="text-sm font-semibold tracking-wide text-[#D95F87] uppercase">{eyebrow}</p>
      <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-[#29232A] text-balance">{title}</h2>
      {text && <p className="mt-4 text-base sm:text-lg text-[#746873] leading-relaxed text-pretty">{text}</p>}
    </Reveal>
  );
}

function Check({ light = false }: { light?: boolean }) {
  return (
    <span className={`mt-0.5 h-5 w-5 flex-shrink-0 rounded-full flex items-center justify-center ${light ? "bg-white/15 text-white" : "bg-[#FDF2F6] text-[#8F3158]"}`}>
      <Icon name="check" className="h-3 w-3" />
    </span>
  );
}

function DemoCta({ className = "", light = false }: { className?: string; light?: boolean }) {
  return (
    <a href="#demo" data-cta="demo"
      className={`group inline-flex h-12 items-center justify-center gap-2 rounded-full px-7 text-base font-semibold active:scale-[0.98] transition
        ${light ? "bg-white text-[#8F3158] hover:bg-[#FDF2F6]" : "bg-[#8F3158] text-white shadow-lg shadow-[#8F3158]/25 hover:bg-[#742544]"} ${className}`}>
      {t.hero_cta}<Icon name="arrow" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
    </a>
  );
}

export default function LandingPage() {
  const year = new Date().getFullYear();

  return (
    <div className="kiddo-landing min-h-screen bg-[#FFF7F2] text-[#29232A] overflow-x-clip">
      <LandingAuthRedirect />
      {/* JS o'chiq bo'lsa animatsiya kutilmaydi — kontent darhol ko'rinadi */}
      <noscript><style>{`.kiddo-reveal{opacity:1!important;transform:none!important}`}</style></noscript>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-[#EDE3E8]/70 bg-[#FFF7F2]/75 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/" aria-label="KIDDO"><Logo /></Link>
          <nav aria-label={t.menyu} className="hidden lg:flex items-center gap-6">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className="text-sm font-medium text-[#746873] hover:text-[#8F3158] transition-colors">{n.label}</a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" data-cta="login"
              className="hidden sm:inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold text-[#29232A] hover:bg-[#F4DCE5]/60 transition">
              {t.kirish}
            </Link>
            <a href="#demo" data-cta="demo"
              className="inline-flex h-10 items-center rounded-full bg-[#8F3158] px-4 sm:px-5 text-sm font-semibold text-white shadow-sm shadow-[#8F3158]/30 hover:bg-[#742544] active:scale-[0.98] transition">
              {t.nav_demo}
            </a>
            {/* Mobil menyu — JS'siz (details) */}
            <details className="lg:hidden relative group">
              <summary aria-label={t.menyu} className="list-none cursor-pointer h-10 w-10 rounded-full flex items-center justify-center text-[#29232A] hover:bg-[#F4DCE5]/60 [&::-webkit-details-marker]:hidden">
                <Icon name="menu" />
              </summary>
              <nav aria-label={t.menyu} className="absolute right-0 mt-2 w-60 rounded-2xl bg-white border border-[#EDE3E8] shadow-xl p-2">
                {NAV.map((n) => (
                  <a key={n.href} href={n.href} className="block rounded-xl px-3 py-2.5 text-sm font-medium text-[#3D3240] hover:bg-[#FDF2F6]">{n.label}</a>
                ))}
                <a href="#demo" className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-[#8F3158] hover:bg-[#FDF2F6]">{t.nav_demo}</a>
                <Link href="/login" data-cta="login" className="block rounded-xl px-3 py-2.5 text-sm font-medium text-[#3D3240] hover:bg-[#FDF2F6]">{t.kirish}</Link>
              </nav>
            </details>
          </div>
        </div>
      </header>

      <main>
        {/* ── Hero ───────────────────────────────────────────────── */}
        <section className="relative isolate">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="landing-drift absolute -top-32 -right-24 h-[28rem] w-[28rem] rounded-full bg-[#F4DCE5] blur-3xl opacity-80" />
            <div className="landing-drift absolute top-48 -left-32 h-[22rem] w-[22rem] rounded-full bg-[#FCE8F0] blur-3xl" style={{ animationDelay: "-6s" }} />
          </div>
          <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-14 sm:pt-20 pb-16 sm:pb-24">
            <div className="max-w-3xl mx-auto text-center">
              <p className="landing-rise inline-flex items-center gap-2 rounded-full border border-[#F4DCE5] bg-white/70 px-3.5 py-1.5 text-xs font-semibold text-[#8F3158]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#D95F87]" aria-hidden="true" />{t.hero_eyebrow}
              </p>
              <h1 className="landing-rise mt-6 text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05] text-balance" style={{ animationDelay: "80ms" }}>
                {t.hero_sarlavha_1} <span className="landing-text-gradient">{t.hero_sarlavha_2}</span>
              </h1>
              <p className="landing-rise mt-6 text-lg text-[#746873] leading-relaxed max-w-2xl mx-auto text-pretty" style={{ animationDelay: "160ms" }}>{t.hero_tavsif}</p>
              <div className="landing-rise mt-8 flex flex-col sm:flex-row justify-center gap-3" style={{ animationDelay: "240ms" }}>
                <DemoCta />
                <Link href="/login" data-cta="login"
                  className="inline-flex h-12 items-center justify-center rounded-full border border-[#EDE3E8] bg-white/80 px-7 text-base font-semibold text-[#29232A] hover:border-[#D95F87]/50 hover:bg-white transition">
                  {t.kirish}
                </Link>
              </div>
              <ul className="landing-rise mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2" style={{ animationDelay: "320ms" }}>
                {[t.hero_belgi_1, t.hero_belgi_2, t.hero_belgi_3].map((b) => (
                  <li key={b} className="flex items-center gap-2 text-sm text-[#746873]">
                    <span className="h-5 w-5 rounded-full bg-[#DCFCE7] text-[#166534] flex items-center justify-center"><Icon name="check" className="h-3 w-3" /></span>{b}
                  </li>
                ))}
              </ul>
            </div>
            <div className="landing-rise relative mt-14 sm:mt-16" style={{ animationDelay: "300ms" }}>
              <BrowserFrame {...SHOTS.dashboard} alt={t.shot_dashboard} caption={t.skrinshot_izoh} priority sizes="(min-width: 1152px) 1104px, 100vw" />
              <div className="hidden lg:block absolute -right-6 -bottom-16 landing-float">
                <PhoneMockup className="scale-[0.82] origin-bottom-right" />
              </div>
            </div>
          </div>
        </section>

        {/* ── Imkoniyatlar ───────────────────────────────────────── */}
        <section id="imkoniyatlar" className="scroll-mt-20 py-20 sm:py-28 bg-white">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHead eyebrow={t.imk_eyebrow} title={t.imk_sarlavha} text={t.imk_tavsif} />
            <ul className="mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {t.imk.map((f, i) => (
                <Reveal as="li" key={f.nom} delay={(i % 3) * 80}
                  className="group flex flex-col rounded-3xl border border-[#F2ECF0] bg-[#FFFBF9] p-6 hover:bg-white hover:border-[#F4DCE5] hover:shadow-[0_20px_50px_-25px_rgba(143,49,88,0.35)] hover:-translate-y-0.5">
                  <div className="flex items-start justify-between gap-3">
                    <span className="h-11 w-11 rounded-2xl bg-[#FDF2F6] text-[#8F3158] flex items-center justify-center group-hover:bg-[#8F3158] group-hover:text-white transition-colors">
                      <Icon name={f.kalit} />
                    </span>
                    <span data-holat="mavjud" className="rounded-full bg-[#DCFCE7] px-2.5 py-0.5 text-[11px] font-semibold text-[#166534]">{t.mavjud}</span>
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-[#29232A]">{f.nom}</h3>
                  <p className="mt-2 text-sm text-[#3D3240] leading-relaxed">{f.vazifa}</p>
                  <dl className="mt-4 space-y-2 text-sm leading-relaxed border-t border-[#F2ECF0] pt-4">
                    <div><dt className="inline font-semibold text-[#9A8C96]">{t.muammo}: </dt><dd className="inline text-[#746873]">{f.muammo}</dd></div>
                    <div><dt className="inline font-semibold text-[#8F3158]">{t.foyda}: </dt><dd className="inline text-[#3D3240]">{f.foyda}</dd></div>
                  </dl>
                </Reveal>
              ))}
              <Reveal as="li" delay={160} className="rounded-3xl border border-dashed border-[#D95F87]/40 bg-[#FDF2F6]/50 p-6">
                <span data-holat="rejada" className="inline-flex rounded-full bg-[#FEF9C3] px-2.5 py-0.5 text-[11px] font-semibold text-[#854D0E]">{t.rejada}</span>
                <h3 className="mt-4 text-lg font-semibold text-[#29232A]">{t.rejada_sarlavha}</h3>
                <ul className="mt-3 space-y-2">
                  {t.rejada_list.map((r) => (
                    <li key={r} className="flex gap-2 text-sm text-[#746873]"><span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#D95F87]/60" aria-hidden="true" />{r}</li>
                  ))}
                </ul>
              </Reveal>
            </ul>
          </div>
        </section>

        {/* ── Bog'cha egasi ──────────────────────────────────────── */}
        <section id="egasi" className="scroll-mt-20 py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 grid lg:grid-cols-[1fr_1.25fr] gap-12 lg:gap-14 items-center">
            <div>
              <SectionHead eyebrow={t.egasi_eyebrow} title={t.egasi_sarlavha} text={t.egasi_tavsif} center={false} />
              <Reveal delay={100}>
                <ul className="mt-8 grid sm:grid-cols-2 gap-x-6 gap-y-3">
                  {t.egasi_bandlar.map((b) => (
                    <li key={b} className="flex gap-3 text-sm text-[#3D3240] leading-relaxed"><Check />{b}</li>
                  ))}
                </ul>
                <p className="mt-6 text-sm text-[#9A8C96]">{t.egasi_izoh}</p>
              </Reveal>
            </div>
            <Reveal delay={120} className="relative">
              <BrowserFrame {...SHOTS.tolovlar} alt={t.shot_tolovlar} caption={`${t.shot_tolovlar} · ${t.skrinshot_izoh}`} />
            </Reveal>
          </div>
        </section>

        {/* ── Bog'cha rahbari ────────────────────────────────────── */}
        <section id="rahbar" className="scroll-mt-20 py-20 sm:py-28 bg-white">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHead eyebrow={t.rahbar_eyebrow} title={t.rahbar_sarlavha} text={t.rahbar_tavsif} />
            <ul className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {t.rahbar_bandlar.map((b, i) => (
                <Reveal as="li" key={b.nom} delay={(i % 4) * 70} className="rounded-2xl border border-[#F2ECF0] bg-[#FFFBF9] p-5">
                  <span className="text-xs font-bold text-[#D95F87]">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="mt-2 font-semibold text-[#29232A]">{b.nom}</h3>
                  <p className="mt-1 text-sm text-[#746873] leading-relaxed">{b.foyda}</p>
                </Reveal>
              ))}
            </ul>
            <div className="mt-14 grid lg:grid-cols-2 gap-8">
              <Reveal><BrowserFrame {...SHOTS.bolalar} alt={t.shot_bolalar} caption={t.shot_bolalar} /></Reveal>
              <Reveal delay={120}><BrowserFrame {...SHOTS.davomat} alt={t.shot_davomat} caption={t.shot_davomat} /></Reveal>
            </div>
          </div>
        </section>

        {/* ── Tarbiyachi ─────────────────────────────────────────── */}
        <section id="tarbiyachi" className="scroll-mt-20 py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 grid lg:grid-cols-[1.25fr_1fr] gap-12 lg:gap-14 items-center">
            <Reveal className="order-2 lg:order-1">
              <BrowserFrame {...SHOTS.tarbiyachi} alt={t.shot_tarbiyachi} caption={`${t.shot_tarbiyachi} · ${t.skrinshot_izoh}`} />
            </Reveal>
            <div className="order-1 lg:order-2">
              <SectionHead eyebrow={t.tarb_eyebrow} title={t.tarb_sarlavha} text={t.tarb_tavsif} center={false} />
              <Reveal delay={100}>
                <ul className="mt-8 space-y-3">
                  {t.tarb_bandlar.map((b) => (
                    <li key={b} className="flex gap-3 text-[#3D3240] leading-relaxed"><Check />{b}</li>
                  ))}
                </ul>
                <p data-testid="tarbiyachi-ruxsat" className="mt-6 flex gap-3 rounded-2xl bg-[#FDF2F6] border border-[#F4DCE5] p-4 text-sm text-[#5A4E58] leading-relaxed">
                  <Icon name="shield" className="h-5 w-5 flex-shrink-0 text-[#8F3158]" />{t.tarb_ruxsat}
                </p>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ── Ota-onalar: mobil ilova ────────────────────────────── */}
        <section id="ota-onalar" className="scroll-mt-20 py-20 sm:py-28 bg-white">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 grid lg:grid-cols-2 gap-14 items-center">
            <div>
              <SectionHead eyebrow={t.ota_eyebrow} title={t.ota_sarlavha} text={t.ota_tavsif} center={false} />
              <Reveal delay={100}>
                <p className="mt-5 inline-flex items-start gap-2 rounded-2xl bg-[#FEF9C3] px-3.5 py-2 text-xs font-semibold text-[#854D0E]">
                  <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#CA8A04]" aria-hidden="true" />{t.ota_holat}
                </p>
                <ul className="mt-6 space-y-3">
                  {t.ota_bandlar.map((b) => (
                    <li key={b.matn} className="flex items-start gap-3 text-[#3D3240]">
                      <Check />
                      <span className="flex-1">{b.matn}</span>
                      {b.holat === "rejada" && (
                        <span data-holat="rejada" className="rounded-full bg-[#FEF9C3] px-2 py-0.5 text-[11px] font-semibold text-[#854D0E]">{t.rejada}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </Reveal>
            </div>
            <Reveal delay={120} className="flex flex-col items-center">
              <div className="flex justify-center gap-4 sm:gap-6">
                <PhoneMockup />
                <PhoneMockup variant="galereya" className="hidden sm:block mt-10" />
              </div>
              <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-[#EDE3E8] bg-[#FFFBF9] px-3 py-1 text-xs font-semibold text-[#746873]">{t.namuna}</p>
            </Reveal>
          </div>
        </section>

        {/* ── Qanday ishlaydi ────────────────────────────────────── */}
        <section id="qanday-ishlaydi" className="scroll-mt-20 py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHead eyebrow={t.qadam_eyebrow} title={t.qadam_sarlavha} />
            <ol className="mt-14 grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {t.qadamlar.map((q, i) => (
                <Reveal as="li" key={q.nom} delay={i * 90} className="relative rounded-3xl bg-white border border-[#EDE3E8] p-6">
                  <span className="text-4xl font-bold tracking-tight landing-text-gradient">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="mt-4 text-base font-semibold">{q.nom}</h3>
                  <p className="mt-2 text-sm text-[#746873] leading-relaxed">{q.matn}</p>
                  {i < t.qadamlar.length - 1 && (
                    <span aria-hidden="true" className="hidden lg:flex absolute top-1/2 -right-3.5 z-10 h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-[#FFF7F2] text-[#D95F87]">
                      <Icon name="arrow" className="h-4 w-4" />
                    </span>
                  )}
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* ── 14 kunlik bepul DEMO ───────────────────────────────── */}
        <section id="demo" className="scroll-mt-20 py-20 sm:py-28 bg-gradient-to-b from-[#FDF2F6] to-[#FFF7F2]">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 grid lg:grid-cols-[0.9fr_1.1fr] gap-12 items-start">
            <div className="lg:sticky lg:top-28">
              <SectionHead eyebrow={t.demo_eyebrow} title={t.demo_form_sarlavha} text={t.demo_form_tavsif} center={false} />
              <Reveal delay={100}>
                <ul className="mt-8 space-y-3">
                  {t.demo_bandlar.map((b) => (
                    <li key={b} className="flex gap-3 text-[#3D3240] leading-relaxed"><Check />{b}</li>
                  ))}
                </ul>
              </Reveal>
            </div>
            <Reveal delay={80}>
              <DemoRequestForm />
            </Reveal>
          </div>
        </section>

        {/* ── Nima uchun KIDDO ───────────────────────────────────── */}
        <section id="nima-uchun" className="scroll-mt-20 py-20 sm:py-28 bg-white">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHead eyebrow={t.nega_eyebrow} title={t.nega_sarlavha} />
            <div className="mt-14 grid sm:grid-cols-2 gap-5">
              {t.nega.map((n, i) => (
                <Reveal key={n.nom} delay={(i % 2) * 100} className="flex gap-5 rounded-3xl border border-[#F2ECF0] bg-[#FFFBF9] p-7">
                  <span className="h-12 w-12 flex-shrink-0 rounded-2xl bg-gradient-to-br from-[#8F3158] to-[#D95F87] text-white flex items-center justify-center shadow-lg shadow-[#8F3158]/20">
                    <Icon name={WHY_ICONS[i]} />
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold">{n.nom}</h3>
                    <p className="mt-1.5 text-sm text-[#746873] leading-relaxed">{n.matn}</p>
                  </div>
                </Reveal>
              ))}
            </div>

            {/* Demo muhit — faqat namoyish ma'lumotlari, mijozlar soni emas */}
            <Reveal className="mt-10 rounded-3xl border border-dashed border-[#D95F87]/40 bg-[#FDF2F6]/60 p-6 sm:p-7">
              <div data-testid="demo-note" className="flex flex-col sm:flex-row sm:items-center gap-4">
                <span className="inline-flex w-fit items-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#8F3158] border border-[#F4DCE5]">{t.demo_sarlavha}</span>
                <div>
                  <p className="font-medium text-[#29232A]">{t.demo_matn}</p>
                  <p className="mt-1 text-sm text-[#746873]">{t.demo_izoh}</p>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── CTA ────────────────────────────────────────────────── */}
        <section className="py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Reveal className="relative overflow-hidden rounded-[2.5rem] bg-[#8F3158] px-6 py-14 sm:px-14 sm:py-20 text-center text-white">
              <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                <div className="landing-drift absolute -top-24 -right-16 h-72 w-72 rounded-full bg-[#D95F87]/50 blur-3xl" />
                <div className="landing-drift absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-white/10 blur-3xl" style={{ animationDelay: "-8s" }} />
              </div>
              <div className="relative">
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-balance">{t.cta_sarlavha}</h2>
                <p className="mt-4 text-white/80 max-w-xl mx-auto">{t.cta_tavsif}</p>
                <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
                  <DemoCta light />
                  <Link href="/login" data-cta="login"
                    className="inline-flex h-12 items-center justify-center rounded-full border border-white/30 px-7 text-base font-semibold text-white hover:bg-white/10 transition">
                    {t.kirish}
                  </Link>
                  {SITE_CONTACT.email && (
                    <a href={`mailto:${SITE_CONTACT.email}`}
                      className="inline-flex h-12 items-center justify-center rounded-full border border-white/30 px-7 text-base font-semibold text-white hover:bg-white/10 transition">
                      {t.cta_boglanish}
                    </a>
                  )}
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className="border-t border-[#EDE3E8] bg-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Logo />
            <p className="mt-4 text-sm text-[#746873] max-w-xs leading-relaxed">{t.footer_tavsif}</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-[#29232A]">{t.footer_sahifalar}</p>
            <ul className="mt-4 space-y-2.5">
              {NAV.map((n) => <li key={n.href}><a href={n.href} className="text-sm text-[#746873] hover:text-[#8F3158]">{n.label}</a></li>)}
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold text-[#29232A]">{t.footer_boshlash}</p>
            <ul className="mt-4 space-y-2.5">
              <li><a href="#demo" data-cta="demo" className="text-sm font-semibold text-[#8F3158] hover:underline">{t.hero_cta}</a></li>
              <li><Link href="/login" data-cta="login" className="text-sm text-[#746873] hover:text-[#8F3158]">{t.kirish}</Link></li>
            </ul>
          </div>
          {hasContact && (
            <div data-testid="footer-contact">
              <p className="text-sm font-semibold text-[#29232A]">{t.footer_aloqa}</p>
              <ul className="mt-4 space-y-2.5 text-sm text-[#746873]">
                {SITE_CONTACT.phone && (
                  <li><a href={`tel:${SITE_CONTACT.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-2 hover:text-[#8F3158]"><Icon name="phone" className="h-4 w-4" />{SITE_CONTACT.phone}</a></li>
                )}
                {SITE_CONTACT.email && (
                  <li><a href={`mailto:${SITE_CONTACT.email}`} className="inline-flex items-center gap-2 hover:text-[#8F3158]"><Icon name="mail" className="h-4 w-4" />{SITE_CONTACT.email}</a></li>
                )}
                {SITE_CONTACT.telegram && (
                  <li><a href={telegramUrl(SITE_CONTACT.telegram)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 hover:text-[#8F3158]"><Icon name="send" className="h-4 w-4" />{t.telegram}</a></li>
                )}
                {SITE_CONTACT.address && (
                  <li className="inline-flex items-start gap-2"><Icon name="pin" className="h-4 w-4 mt-0.5" />{SITE_CONTACT.address}</li>
                )}
              </ul>
            </div>
          )}
        </div>
        <div className="border-t border-[#F2ECF0]">
          <p className="mx-auto max-w-6xl px-4 sm:px-6 py-6 text-xs text-[#B8AAB2]">© {year} KIDDO. {t.footer_huquq}</p>
        </div>
      </footer>
    </div>
  );
}
