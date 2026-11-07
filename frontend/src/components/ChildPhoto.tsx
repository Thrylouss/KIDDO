const sizes = {
  md: "h-12 w-12 text-base",
  lg: "h-16 w-16 text-xl",
  xl: "h-24 w-24 text-3xl",
} as const;

const palette: [string, string][] = [
  ["#FDF2F6", "#8E315D"], ["#DCFCE7", "#166534"], ["#FEF3C7", "#92400E"], ["#E0F2FE", "#075985"], ["#F3E8FF", "#6B21A8"],
];

interface ChildPhotoProps {
  firstName: string;
  lastName:  string;
  photoUrl?: string | null;
  size?:     keyof typeof sizes;
}

/**
 * Bola rasmi. Haqiqiy rasm yuklanmagan bo'lsa — bosh harflar (soxta surat ishlatilmaydi).
 * Rasm fon sifatida beriladi: tashqi URL uchun next/image sozlamasi talab qilinmaydi.
 */
export default function ChildPhoto({ firstName, lastName, photoUrl, size = "md" }: ChildPhotoProps) {
  const name = `${lastName} ${firstName}`;
  const [bg, fg] = palette[(firstName.charCodeAt(0) + lastName.charCodeAt(0)) % palette.length];

  if (photoUrl) {
    return (
      <div
        role="img"
        aria-label={name}
        className={`${sizes[size]} flex-shrink-0 rounded-2xl bg-cover bg-center bg-[#F2ECF0]`}
        style={{ backgroundImage: `url("${photoUrl.replace(/"/g, "%22")}")` }}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={name}
      className={`${sizes[size]} flex-shrink-0 inline-flex items-center justify-center rounded-2xl font-semibold select-none`}
      style={{ backgroundColor: bg, color: fg }}
    >
      {(lastName[0] ?? "").toUpperCase()}{(firstName[0] ?? "").toUpperCase()}
    </div>
  );
}
