"use client";

import { useEffect, useRef, useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import uz from "@/i18n";
import { isSafeEmbedUrl, type KidsContent } from "@/lib/kids";

interface Props {
  content: KidsContent;
  onClose: () => void;
  footer?: React.ReactNode;
}

/**
 * Rasmiy YouTube embed (youtube-nocookie), yuklab olish yoki qayta tarqatish funksiyasi yo'q.
 * iframe sandbox va allow ro'yxati minimal; manzil faqat backend qurgan formatda bo'lsa ishlatiladi.
 * Embedding bloklangan bo'lsa (backend belgisi yoki pleyer 101/150 xatosi) — tushunarli xabar va YouTube havolasi.
 */
export default function VideoPlayerModal({ content, onClose, footer }: Props) {
  const t = uz.kids;
  const frameRef = useRef<HTMLIFrameElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [blocked, setBlocked] = useState(content.embeddable === false || !isSafeEmbedUrl(content.embed_url));
  const [fullscreen, setFullscreen] = useState(false);

  // YouTube pleyeridan xato xabarlarini tinglash (enablejsapi=1): 101/150 — egasi embedni taqiqlagan, 100 — video yo'q
  useEffect(() => {
    if (blocked) return;
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== "https://www.youtube-nocookie.com" || e.source !== frameRef.current?.contentWindow) return;
      try {
        const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (data?.event === "onError" && [100, 101, 150].includes(Number(data.info))) setBlocked(true);
      } catch { /* boshqa formatdagi xabarlar e'tiborsiz */ }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [blocked]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === boxRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function onLoad() {
    // Pleyer hodisalariga obuna (rasmiy postMessage protokoli)
    frameRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: content.id }), "https://www.youtube-nocookie.com");
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await boxRef.current?.requestFullscreen();
    } catch { /* brauzer ruxsat bermasa — e'tiborsiz */ }
  }

  return (
    <Modal open onClose={onClose} title={content.title} size="lg"
      footer={<>
        {footer}
        <a href={content.watch_url} target="_blank" rel="noopener noreferrer"
          className="inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium text-[var(--text-2)] hover:bg-[var(--border-2)] hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/30">
          {t.youtube_ochish}
        </a>
        {!blocked && <Button variant="secondary" onClick={toggleFullscreen}>{fullscreen ? t.toliq_ekran_chiqish : t.toliq_ekran}</Button>}
      </>}>
      <div ref={boxRef} className="relative w-full overflow-hidden rounded-xl bg-[var(--ink)] aspect-video [&:fullscreen]:rounded-none [&:fullscreen]:aspect-auto">
        {blocked ? (
          <div role="alert" data-testid="embed-blocked" className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={content.thumbnail_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
            <p className="relative max-w-md text-sm text-white">{t.embed_bloklangan}</p>
            <a href={content.watch_url} target="_blank" rel="noopener noreferrer"
              className="relative inline-flex h-10 items-center rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--primary-h)]">
              {t.youtube_ochish}
            </a>
          </div>
        ) : (
          <iframe
            ref={frameRef}
            data-testid="kids-player"
            src={content.embed_url}
            title={`${t.player_sarlavha}: ${content.title}`}
            className="absolute inset-0 h-full w-full"
            onLoad={onLoad}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"
            loading="lazy"
          />
        )}
      </div>
      {content.description && <p className="mt-4 text-sm text-[var(--text-2)] whitespace-pre-line break-words">{content.description}</p>}
    </Modal>
  );
}
