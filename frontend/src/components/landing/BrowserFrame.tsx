import Image from "next/image";

interface BrowserFrameProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  /** Manzil satridagi yo'l (faqat bezak) */
  path?: string;
  caption?: string;
  priority?: boolean;
  sizes?: string;
  className?: string;
}

/** Haqiqiy KIDDO skrinshoti — brauzer oynasi ramkasida. */
export default function BrowserFrame({ src, alt, width, height, path = "kiddo.uz", caption, priority, sizes = "(min-width: 1024px) 640px, 100vw", className = "" }: BrowserFrameProps) {
  return (
    <figure className={className}>
      <div className="overflow-hidden rounded-2xl sm:rounded-[20px] border border-[#EDE3E8] bg-white shadow-[0_30px_80px_-30px_rgba(143,49,88,0.45)]">
        <div className="flex items-center gap-3 border-b border-[#F2ECF0] bg-[#FBF7F9] px-3 sm:px-4 h-8 sm:h-10" aria-hidden="true">
          <span className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#F87171]/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#FBBF24]/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#34D399]/70" />
          </span>
          <span className="mx-auto hidden sm:block w-full max-w-xs truncate rounded-md bg-white border border-[#F2ECF0] px-3 py-0.5 text-center text-[11px] text-[#9A8C96]">{path}</span>
        </div>
        <Image src={src} alt={alt} width={width} height={height} priority={priority} sizes={sizes} className="block h-auto w-full" />
      </div>
      {caption && <figcaption className="mt-3 text-center text-xs text-[#9A8C96]">{caption}</figcaption>}
    </figure>
  );
}
