'use client';

import { useMemo } from 'react';
import type { Gallery } from '@/lib/types';
import { formatEventDate } from '@/lib/utils/format';
import { getOriginalUrl } from '@/lib/storage';

interface HeroSectionProps {
  gallery: Pick<Gallery, 'id' | 'title' | 'client_name' | 'event_date' | 'welcome_message'>;
  mediaCount: number;
  canDownload: boolean;
  coverUrl?: string | null;
  isPreview?: boolean;
  galleryAnchorId?: string;
}

export default function HeroSection({
  gallery,
  coverUrl,
  isPreview = false,
  galleryAnchorId = 'galeria',
}: HeroSectionProps) {
  const formattedDate = formatEventDate(gallery.event_date);

  // Garante a URL pública absoluta, seja caminho do storage ou URL externa
  const resolvedCoverUrl = useMemo(() => {
    if (!coverUrl) return null;
    return getOriginalUrl(coverUrl);
  }, [coverUrl]);

  const scrollToGallery = () => {
    document.getElementById(galleryAnchorId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <header className="relative w-full h-[92vh] sm:h-screen overflow-hidden bg-neutral-900 select-none">
      {isPreview && (
        <div className="absolute top-0 inset-x-0 z-30 bg-amber-500/90 text-white px-4 py-1.5 text-center text-xs tracking-wider font-medium">
          Pré-visualização — Rascunho
        </div>
      )}

      {/* Foto do Casal em ecrã inteiro */}
      {resolvedCoverUrl ? (
        <img
          src={resolvedCoverUrl}
          alt={gallery.title}
          className="absolute inset-0 h-full w-full object-cover object-center"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-neutral-950" />
      )}

      {/* Degradê cinematográfico escuro na parte inferior */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/20" />

      {/* Conteúdo textual */}
      <div className="relative z-10 flex h-full flex-col justify-end px-6 pb-14 sm:px-12 sm:pb-16 max-w-5xl mx-auto">
        {formattedDate && (
          <p className="text-xs tracking-[0.25em] text-white/80 font-mono mb-2 uppercase">
            {formattedDate}
          </p>
        )}

        <h1 className="font-serif text-4xl sm:text-6xl md:text-7xl font-normal tracking-wide text-white drop-shadow-md">
          {gallery.title}
        </h1>

        <div className="mt-4 text-xs tracking-widest text-white/80 uppercase">
          STORYMAKER <span className="font-medium text-white">JOANA MIRELLY</span>
        </div>

        {gallery.welcome_message && (
          <p className="mt-3 max-w-xl text-xs sm:text-sm text-white/90 italic font-serif leading-relaxed line-clamp-3">
            {gallery.welcome_message}
          </p>
        )}

        {/* Seta para descer até às abas */}
        <button
          type="button"
          onClick={scrollToGallery}
          aria-label="Ver fotos"
          className="mt-8 flex items-center gap-2 text-white/90 hover:text-white transition group w-fit cursor-pointer"
        >
          <span className="text-[11px] tracking-widest uppercase font-sans group-hover:underline">
            Explorar galeria
          </span>
          <svg className="w-4 h-4 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
    </header>
  );
}