'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import type { PublicMedia } from '@/lib/storage';

interface GalleryGridProps {
  id?: string;
  items?: PublicMedia[];
  allowDownload?: boolean;
}

function checkIsVideo(item: PublicMedia): boolean {
  if (item.type === 'video') return true;
  const url = (item.url || '').toLowerCase();
  return (
    url.endsWith('.mp4') ||
    url.endsWith('.mov') ||
    url.endsWith('.webm') ||
    url.endsWith('.m4v') ||
    url.endsWith('.quicktime')
  );
}

function VideoCard({
  item,
  isFav,
  isDownloading,
  allowDownload,
  onToggleFavorite,
  onDownload,
}: {
  item: PublicMedia;
  isFav: boolean;
  isDownloading: boolean;
  allowDownload: boolean;
  onToggleFavorite: () => void;
  onDownload: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [generatedPoster, setGeneratedPoster] = useState<string | null>(null);

  const hasDistinctThumbnail =
    Boolean(item.thumbnailUrl) &&
    item.thumbnailUrl !== item.url &&
    !item.thumbnailUrl.toLowerCase().endsWith('.mov') &&
    !item.thumbnailUrl.toLowerCase().endsWith('.mp4');

  // Gera o poster dinamicamente caso o vídeo não possua miniatura gravada
  useEffect(() => {
    if (hasDistinctThumbnail || !item.url) return;

    let isMounted = true;
    const tempVideo = document.createElement('video');
    tempVideo.crossOrigin = 'anonymous';
    tempVideo.preload = 'metadata';
    tempVideo.muted = true;
    tempVideo.playsInline = true;
    tempVideo.src = item.url;

    const onSeeked = () => {
      if (!isMounted) return;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = tempVideo.videoWidth || 360;
        canvas.height = tempVideo.videoHeight || 640;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          setGeneratedPoster(dataUrl);
        }
      } catch {
        // Se as políticas de CORS bloquearem a leitura do canvas, mantém o fundo escuro
      }
    };

    tempVideo.onloadeddata = () => {
      tempVideo.currentTime = 0.1;
    };

    tempVideo.onseeked = onSeeked;

    return () => {
      isMounted = false;
      tempVideo.removeAttribute('src');
      tempVideo.load();
    };
  }, [item.url, hasDistinctThumbnail]);

  const handleTogglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const currentPoster = hasDistinctThumbnail
    ? item.thumbnailUrl
    : (generatedPoster || undefined);

  return (
    <div
      onClick={handleTogglePlay}
      className="group relative aspect-[3/4] cursor-pointer overflow-hidden rounded-xl bg-stone-900 shadow-sm"
    >
      <video
        ref={videoRef}
        src={item.url}
        poster={currentPoster}
        preload="metadata"
        playsInline
        controls={isPlaying}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        className="h-full w-full object-cover"
      />

      {/* Camada e botão de Play enquanto o vídeo não estiver ativo */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 transition-all group-hover:bg-black/45">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-stone-900 shadow-lg backdrop-blur-md transition-transform group-hover:scale-110">
            <svg className="ml-1 h-5 w-5 fill-current" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      )}

      {/* Ações: Download e Favoritar */}
      <div className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-2 z-20">
        {allowDownload && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDownload();
            }}
            disabled={isDownloading}
            aria-label="Baixar mídia"
            title="Baixar mídia"
            className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md transition hover:bg-black/90 shadow hover:scale-105 disabled:opacity-50"
          >
            {isDownloading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
            )}
          </button>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          aria-label="Favoritar"
          title="Favoritar"
          className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md transition hover:bg-black/90 shadow hover:scale-105"
        >
          <svg
            className={`w-4 h-4 transition-colors ${
              isFav ? 'fill-red-500 text-red-500' : 'text-white fill-transparent'
            }`}
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function GalleryGrid({
  id = 'galeria',
  items = [],
  allowDownload = true,
}: GalleryGridProps) {
  const [activeTab, setActiveTab] = useState<'takes' | 'editados'>('editados');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const toggleFavorite = (itemId: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const handleDownload = async (fileUrl: string, fileName: string, itemId: string) => {
    try {
      setDownloadingId(itemId);
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error('Falha ao descarregar ficheiro');

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName || 'arquivo-galeria';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Erro no download:', error);
      window.open(fileUrl, '_blank');
    } finally {
      setDownloadingId(null);
    }
  };

  const filteredItems = useMemo(() => {
    const safeList = Array.isArray(items) ? items : [];
    return safeList.filter((item) => {
      if (!item) return false;
      const cat = (item.category || '').toLowerCase();
      const isVideo = checkIsVideo(item);

      if (activeTab === 'takes') {
        return cat === 'takes' || (!cat && isVideo);
      } else {
        return cat === 'editados' || (!cat && !isVideo);
      }
    });
  }, [items, activeTab]);

  return (
    <section id={id} className="w-full bg-[#FAF9F6] py-10 px-4 sm:px-8">
      {/* Abas */}
      <div className="sticky top-0 z-20 bg-[#FAF9F6]/95 backdrop-blur-md border-b border-stone-200 mb-8 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-center gap-12 sm:gap-16">
          <button
            type="button"
            onClick={() => setActiveTab('takes')}
            className={`relative py-2 text-xs sm:text-sm font-semibold tracking-widest uppercase transition-all ${
              activeTab === 'takes'
                ? 'text-stone-900 border-b-2 border-stone-900 font-bold'
                : 'text-stone-400 hover:text-stone-600'
            }`}
          >
            Takes
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('editados')}
            className={`relative py-2 text-xs sm:text-sm font-semibold tracking-widest uppercase transition-all ${
              activeTab === 'editados'
                ? 'text-stone-900 border-b-2 border-stone-900 font-bold'
                : 'text-stone-400 hover:text-stone-600'
            }`}
          >
            Editados
          </button>
        </div>
      </div>

      {/* Grade */}
      <div className="max-w-5xl mx-auto">
        {filteredItems.length === 0 ? (
          <div className="text-center py-24">
            <p className="font-serif italic text-stone-400 text-lg">
              Nenhuma mídia em {activeTab === 'takes' ? 'Takes' : 'Editados'}.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            {filteredItems.map((item) => {
              const isFav = favorites.has(item.id);
              const isVideo = checkIsVideo(item);
              const isDownloading = downloadingId === item.id;

              if (isVideo) {
                return (
                  <VideoCard
                    key={item.id}
                    item={item}
                    isFav={isFav}
                    isDownloading={isDownloading}
                    allowDownload={allowDownload}
                    onToggleFavorite={() => toggleFavorite(item.id)}
                    onDownload={() => handleDownload(item.url, item.filename, item.id)}
                  />
                );
              }

              return (
                <div
                  key={item.id}
                  className="group relative aspect-[3/4] overflow-hidden rounded-xl bg-stone-900 shadow-sm"
                >
                  <img
                    src={item.thumbnailUrl || item.url}
                    alt={item.filename || 'Fotografia da Galeria'}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    onError={(e) => {
                      if (item.url && e.currentTarget.src !== item.url) {
                        e.currentTarget.src = item.url;
                      }
                    }}
                  />

                  {/* Ações: Download e Favoritar */}
                  <div className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-2 z-10">
                    {allowDownload && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(item.url, item.filename, item.id);
                        }}
                        disabled={isDownloading}
                        aria-label="Baixar mídia"
                        title="Baixar mídia"
                        className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md transition hover:bg-black/90 shadow hover:scale-105 disabled:opacity-50"
                      >
                        {isDownloading ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                            />
                          </svg>
                        )}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(item.id);
                      }}
                      aria-label="Favoritar"
                      title="Favoritar"
                      className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md transition hover:bg-black/90 shadow hover:scale-105"
                    >
                      <svg
                        className={`w-4 h-4 transition-colors ${
                          isFav ? 'fill-red-500 text-red-500' : 'text-white fill-transparent'
                        }`}
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}