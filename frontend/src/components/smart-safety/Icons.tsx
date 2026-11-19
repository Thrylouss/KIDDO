import type { IconName } from "@/lib/smart-safety/nav";

/** Smart xavfsizlik uchun yagona chiziqli ikonalar to'plami (24×24, currentColor). */
const PATHS: Record<IconName | "chevron" | "check" | "alert" | "battery" | "wifi_off" | "search" | "plus" | "minus" | "expand" | "shrink" | "close" | "play" | "pause" | "reset" | "next" | "prev" | "sound" | "lock" | "door" | "people" | "info" | "user", string> = {
  home: "M3 11.5 12 4l9 7.5M5.5 9.5V20h5v-5.5h3V20h5V9.5",
  map: "M9 4 3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5L9 4Zm0 0v13.5m6-11v13.5",
  children: "M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 1a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM2.5 20c.6-3.4 2.8-5.5 5.5-5.5s4.9 2.1 5.5 5.5M14 15.2c.6-.4 1.3-.7 2-.7 2.3 0 4.1 1.8 4.6 5.5",
  attendance: "M8 3v3m8-3v3M4.5 8.5h15M5.5 5h13a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm3.5 9 2 2 4-4.5",
  count: "M4 6h3m-3 6h3m-3 6h3m4-12h9m-9 6h9m-9 6h9",
  handover: "M3 13.5h3.5l3 2.5h4a1.5 1.5 0 0 0 0-3h-3M3 13.5V20h3.5M15 15l4.2-2.6a1.6 1.6 0 0 1 1.8 2.6L15 20H9M16 4.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z",
  bell: "M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2H4.5l1.5-2Zm4 4h4",
  activity: "M3 12h4l2.5-6 5 12 2.5-6h4",
  device: "M8 3h8l1 4v10l-1 4H8l-1-4V7l1-4Zm-1 4h10M7 17h10M12 10.5v3",
  report: "M5 20V10m5 10V4m5 16v-7m5 7V8",
  settings: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm7.4 3a7.4 7.4 0 0 0-.1-1.3l2-1.6-2-3.4-2.4 1a7.4 7.4 0 0 0-2.2-1.3L14.3 3h-4l-.4 2.4a7.4 7.4 0 0 0-2.2 1.3l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.6l-2 1.6 2 3.4 2.4-1a7.4 7.4 0 0 0 2.2 1.3l.4 2.4h4l.4-2.4a7.4 7.4 0 0 0 2.2-1.3l2.4 1 2-3.4-2-1.6c.1-.4.1-.9.1-1.3Z",
  building: "M4 20V5.5L12 3l8 2.5V20M2.5 20h19M9 20v-4h6v4M8 8.5h1m3 0h1m3 0h1M8 12.5h1m3 0h1m3 0h1",
  shield: "M12 3.5 19 6v6c0 4.4-3 7.4-7 8.5-4-1.1-7-4.1-7-8.5V6l7-2.5Zm-3 8.5 2 2 4-4",
  chevron: "m9 6 6 6-6 6",
  check: "m5 12.5 4.5 4.5L19 7.5",
  alert: "M12 4 2.8 19.5h18.4L12 4Zm0 6v4.5m0 2.5v.5",
  battery: "M4 8h13a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Zm16 3v2M6 11v2",
  wifi_off: "m3 3 18 18M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 4-2.4m6 0A10 10 0 0 1 19 13M2 9.5a15 15 0 0 1 4.5-2.8m4-.7A15 15 0 0 1 22 9.5M12 20h.01",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm9 2-4-4",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  expand: "M4 9V4h5M20 9V4h-5M4 15v5h5m11-5v5h-5",
  shrink: "M9 4v5H4m11-5v5h5M9 20v-5H4m11 5v-5h5",
  close: "M6 6l12 12M18 6 6 18",
  play: "M7 5v14l12-7L7 5Z",
  pause: "M8 5v14m8-14v14",
  reset: "M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4",
  next: "m9 6 6 6-6 6",
  prev: "m15 6-6 6 6 6",
  sound: "M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4Zm12-1a5 5 0 0 1 0 7m2.5-9.5a8.5 8.5 0 0 1 0 12",
  lock: "M6.5 11h11v9h-11v-9Zm2.5 0V8a3 3 0 1 1 6 0v3",
  door: "M6 20V4h9v16M3.5 20h17M12 12h.01M15 6.5l3.5-1.5v15",
  people: "M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-6 10c.5-3.5 3-5.5 6-5.5s5.5 2 6 5.5m1-10a2.5 2.5 0 1 0 0-5m2 15c-.3-2.3-1.3-4-3-4.8",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-10v5.5M12 8v.01",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8.5c.8-3.6 3.6-6 7-6s6.2 2.4 7 6",
};

export type AnyIcon = keyof typeof PATHS;

export default function Icon({ name, className = "h-5 w-5", strokeWidth = 1.75 }: { name: AnyIcon; className?: string; strokeWidth?: number }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

/** Demo avatar: ismning bosh harflari, guruh bo'yicha rang (rasm emas — sintetik bola). */
export function Avatar({ name, tone = "primary", size = "md", alert = false }: { name: string; tone?: "primary" | "accent"; size?: "sm" | "md" | "lg"; alert?: boolean }) {
  const initials = name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  const sz = { sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm", lg: "h-14 w-14 text-lg" }[size];
  const bg = alert ? "bg-[var(--error-text)] text-white" : tone === "primary" ? "bg-[var(--primary-lt)] text-[var(--primary)]" : "bg-[var(--surface-soft)] text-[var(--secondary)]";
  return <span aria-hidden="true" className={`inline-flex flex-shrink-0 items-center justify-center rounded-full font-semibold ${sz} ${bg}`}>{initials}</span>;
}
