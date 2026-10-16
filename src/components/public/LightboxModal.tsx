'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PublicMediaItem } from '@/lib/types';

interface LightboxModalProps {
  items: PublicMediaItem[];
  index: number;
  allowDownload: boolean;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

const SWIPE_THRESHOLD = 50;

export default function LightboxModal({
  items,
  index,
  allowDownload,
  onClose,
  onNavigate,
}: LightboxModalProps) {
  const item = items[index];
  const total = items.length;
  const hasPrev = index > 0;
  const hasNext = index < total - 1;

  const dialogRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);

  const goPrev = useCallback(() => {
    if (hasPrev) onNavigate(index - 1);
  }, [hasPrev, index, onNavigate]);

  const goNext = useCallback(() => {
    if (hasNext) onNavigate(index + 1);
  }, [hasNext, index, onNavigate]);

  // Teclado: ← → Esc
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      else if (event.key === 'ArrowLeft') goPrev();
      else if (event.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goPrev, goNext, onClose]);

  // Trava a rolagem da página e devolve o foco ao fechar
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  // Pré-carrega as imagens vizinhas para navegação instantânea
  useEffect(() => {
    [items[index - 1], items[index + 1]].forEach((neighbor) => {
      if (neighbor?.thumbnail_url && neighbor.media_type === 'photo') {
        const img = new Image();
        img.src = neighbor.thumbnail_url;
      }
    });
  }, [index, items]);

  if (!item) return null;

  const isLoaded = loadedId === item.id;

  const onTouchStart = (event: React.TouchEvent) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };

  const onTouchEnd = (event: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = (event.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < SWIPE_THRESHOLD) return;
    if (delta > 0) goPrev();
    else goNext();
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Visualizando ${index + 1} de ${total}`}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex animate-fade-in flex-col bg-[#0F0F0E]/[0.97] text-white outline-none"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Barra superior */}
      <div className="relative z-10 flex items-center justify-between gap-4 px-4 py-3 sm:px-6 sm:py-4">
        <span className="font-sans text-xs tabular-nums tracking-wideish text-white/70">
          {index + 1} / {total}
        </span>

        <div className="flex items-center gap-2 sm:gap-4">
          {allowDownload && (
            <a
              href={`/api/download/${item.id}`}
              className="inline-flex items-center gap-2 border border-white/25 px-3 py-2 text-[10px] font-medium uppercase tracking-wideish text-white transition hover:border-white hover:bg-white hover:text-ink sm:px-4 sm:text-[11px]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M12 3v12m0 0 5-5m-5 5-5-5M4 21h16"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Baixar original
            </a>
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-2 text-white/80 transition hover:text-white"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M5 5l14 14M19 5 5 19" stroke="currentColor" strokeWidth="1.3" />
            </svg>
          </button>
        </div>
      </div>

      {/* Área da mídia */}
      <div
        className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-6 sm:px-20"
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        {item.media_type === 'video' ? (
          <video
            key={item.id}
            src={`/api/download/${item.id}?mode=view`}
            poster={item.thumbnail_url ?? undefined}
            controls
            autoPlay
            playsInline
            preload="metadata"
            className="max-h-full max-w-full bg-black shadow-2xl"
          />
        ) : item.thumbnail_url ? (
          <>
            {!isLoaded && (
              <span className="absolute h-6 w-6 animate-spin rounded-full border border-white/40 border-t-transparent" />
            )}
            <img
              key={item.id}
              src={item.thumbnail_url}
              alt={`Foto ${index + 1} de ${total}`}
              draggable={false}
              onLoad={() => setLoadedId(item.id)}
              className={`max-h-full max-w-full select-none object-contain shadow-2xl transition-opacity duration-300 ${
                isLoaded ? 'opacity-100' : 'opacity-0'
              }`}
            />
          </>
        ) : (
          <p className="text-sm text-white/60">Pré-visualização indisponível para {item.filename}</p>
        )}

        {hasPrev && (
          <NavButton direction="prev" onClick={goPrev} />
        )}
        {hasNext && (
          <NavButton direction="next" onClick={goNext} />
        )}
      </div>
    </div>
  );
}

function NavButton({ direction, onClick }: { direction: 'prev' | 'next'; onClick: () => void }) {
  const isPrev = direction === 'prev';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isPrev ? 'Foto anterior' : 'Próxima foto'}
      className={`absolute top-1/2 hidden -translate-y-1/2 p-4 text-white/60 transition hover:text-white sm:block ${
        isPrev ? 'left-2 lg:left-6' : 'right-2 lg:right-6'
      }`}
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d={isPrev ? 'M15 4 7 12l8 8' : 'm9 4 8 8-8 8'}
          stroke="currentColor"
          strokeWidth="1.2"
        />
      </svg>
    </button>
  );
}

