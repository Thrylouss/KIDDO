import { Icon } from "./icons";
import uz from "@/i18n/uz";

const t = uz.landing;

/**
 * Ota-onalar mobil ilovasi uchun interfeys namunasi (haqiqiy skrinshot emas — ilova hali chiqarilmagan).
 * Faqat mobil API'da mavjud ma'lumotlar ko'rsatiladi: davomat, kundalik, xabarlar, rasmlar, to'lov holati.
 */
export function PhoneMockup({ variant = "kun", className = "" }: { variant?: "kun" | "galereya"; className?: string }) {
  return (
    <div className={`relative w-[15.5rem] sm:w-64 shrink-0 ${className}`} role="img" aria-label={`${t.namuna}: ${t.ota_sarlavha}`}>
      <div className="rounded-[2.6rem] bg-[#29232A] p-2.5 shadow-[0_40px_90px_-30px_rgba(41,35,42,0.6)]">
        <div className="relative h-[31rem] overflow-hidden rounded-[2.1rem] bg-gradient-to-b from-[#FDF2F6] to-white px-4 pt-3 pb-4">
          <div className="mx-auto mb-4 h-5 w-20 rounded-full bg-[#29232A]" aria-hidden="true" />
          {variant === "kun" ? <DayScreen /> : <GalleryScreen />}
        </div>
      </div>
    </div>
  );
}

function Row({ icon, title, value, tone = "pink" }: { icon: string; title: string; value: string; tone?: "pink" | "green" }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white border border-[#F2ECF0] px-3 py-2.5">
      <span className={`h-8 w-8 flex-shrink-0 rounded-xl flex items-center justify-center ${tone === "green" ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#FDF2F6] text-[#8F3158]"}`}>
        <Icon name={icon} className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-[10px] text-[#9A8C96]">{title}</span>
        <span className="block truncate text-xs font-semibold text-[#29232A]">{value}</span>
      </span>
    </div>
  );
}

function DayScreen() {
  return (
    <div className="space-y-2.5">
      <div className="rounded-2xl bg-[#8F3158] p-4 text-white">
        <p className="text-[10px] uppercase tracking-wider text-white/70">{t.tel_salom}</p>
        <p className="mt-1 text-sm font-semibold">{t.tel_bola}</p>
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold">
          <Icon name="check" className="h-3 w-3" />{t.tel_bugun}: {t.tel_keldi}
        </p>
      </div>
      <Row icon="kundalik" title={t.tel_nonushta} value={t.tel_nonushta_m} tone="green" />
      <Row icon="sparkle" title={t.tel_uyqu} value={t.tel_uyqu_m} />
      <Row icon="foto" title={t.tel_mashgulot} value={t.tel_mashgulot_m} />
      <div className="rounded-2xl bg-white border border-[#F2ECF0] p-3">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold text-[#8F3158]"><Icon name="xabarlar" className="h-3.5 w-3.5" />{t.tel_xabar}</p>
        <p className="mt-1.5 text-[11px] leading-snug text-[#3D3240]">{t.tel_xabar_m}</p>
      </div>
    </div>
  );
}

function GalleryScreen() {
  const tiles = ["from-[#FBCFE8] to-[#F9A8D4]", "from-[#FDE68A] to-[#FCD34D]", "from-[#BBF7D0] to-[#86EFAC]", "from-[#BFDBFE] to-[#93C5FD]", "from-[#DDD6FE] to-[#C4B5FD]", "from-[#FED7AA] to-[#FDBA74]"];
  return (
    <div className="space-y-2.5">
      <p className="text-sm font-semibold text-[#29232A]">{t.tel_foto}</p>
      <div className="grid grid-cols-3 gap-1.5" aria-hidden="true">
        {tiles.map((g, i) => (
          <div key={i} className={`aspect-square rounded-xl bg-gradient-to-br ${g} flex items-end justify-end p-1.5`}>
            <Icon name="foto" className="h-3.5 w-3.5 text-white/80" />
          </div>
        ))}
      </div>
      <Row icon="davomat" title={t.tel_bugun} value={t.tel_keldi} tone="green" />
      <Row icon="tolovlar" title={t.tel_tolov} value={t.tel_tolov_m} tone="green" />
      <Row icon="xabarlar" title={t.tel_xabar} value={t.tel_xabar_m} />
    </div>
  );
}
