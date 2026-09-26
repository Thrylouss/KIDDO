type Size = "xs" | "sm" | "md" | "lg";

const palette: [string, string][] = [
  ["#DBEAFE", "#1D4ED8"], ["#DCFCE7", "#15803D"], ["#EDE9FE", "#6D28D9"],
  ["#FEF3C7", "#92400E"], ["#FCE7F3", "#9D174D"], ["#E0F2FE", "#0369A1"],
];

function getColor(name: string): [string, string] {
  const idx = name.charCodeAt(0) % palette.length;
  return palette[idx];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const sizeCls: Record<Size, string> = {
  xs: "h-6  w-6  text-[10px]",
  sm: "h-8  w-8  text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
};

interface AvatarProps {
  name: string;
  size?: Size;
}

export default function Avatar({ name, size = "md" }: AvatarProps) {
  const [bg, color] = getColor(name);
  return (
    <div
      className={`${sizeCls[size]} flex-shrink-0 inline-flex items-center justify-center rounded-full font-semibold select-none`}
      style={{ backgroundColor: bg, color }}
      aria-label={name}
    >
      {initials(name)}
    </div>
  );
}
