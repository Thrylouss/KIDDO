import type { ThemePreference } from "@/lib/theme";

const base = { className: "h-4 w-4", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 1.8, "aria-hidden": true } as const;

export function SunIcon() {
  return (
    <svg {...base}><circle cx="12" cy="12" r="4" /><path strokeLinecap="round" d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></svg>
  );
}

export function MoonIcon() {
  return (
    <svg {...base}><path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" /></svg>
  );
}

export function SystemIcon() {
  return (
    <svg {...base}><rect x="3" y="4" width="18" height="12" rx="2" /><path strokeLinecap="round" d="M8 20h8m-4-4v4" /></svg>
  );
}

export function GlobeIcon() {
  return (
    <svg {...base}><circle cx="12" cy="12" r="9" /><path strokeLinecap="round" d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z" /></svg>
  );
}

export function CheckIcon() {
  return (
    <svg {...base} strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="m5 12 4.5 4.5L19 7" /></svg>
  );
}

export function ThemeIcon({ pref }: { pref: ThemePreference }) {
  return pref === "dark" ? <MoonIcon /> : pref === "light" ? <SunIcon /> : <SystemIcon />;
}
