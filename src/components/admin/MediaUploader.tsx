'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { BUCKETS, getThumbnailUrl } from '@/lib/storage';
import { formatBytes } from '@/lib/utils/format';
import type {
  Gallery,
  GeneratedThumbnail,
  MediaItem,
  MediaItemInsert,
  MediaType,
  UploadTask,
} from '@/lib/types';

const MAX_CONCURRENT_UPLOADS = 3;
const THUMB_MAX_SIZE = 1600;
const THUMB_QUALITY = 0.8;
const VIDEO_FRAME_TIMEOUT_MS = 20000;
const ACCEPTED_TYPES = 'image/*,video/*';

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

async function renderThumbnail(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
): Promise<GeneratedThumbnail> {
  if (!sourceWidth || !sourceHeight) throw new Error('Dimensões inválidas.');

  const scale = Math.min(1, THUMB_MAX_SIZE / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponível neste navegador.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, width, height);

  const webp = await canvasToBlob(canvas, 'image/webp', THUMB_QUALITY);
  if (webp && webp.type === 'image/webp') {
    return { blob: webp, contentType: 'image/webp', extension: 'webp', width: sourceWidth, height: sourceHeight };
  }

  const jpeg = await canvasToBlob(canvas, 'image/jpeg', THUMB_QUALITY);
  if (!jpeg) throw new Error('Falha ao gerar a miniatura.');
  return { blob: jpeg, contentType: 'image/jpeg', extension: 'jpg', width: sourceWidth, height: sourceHeight };
}

async function createImageThumbnail(file: File): Promise<GeneratedThumbnail> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Formato de imagem não suportado pelo navegador.'));
      image.src = url;
    });
    return await renderThumbnail(img, img.naturalWidth, img.naturalHeight);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function createVideoThumbnail(file: File): Promise<GeneratedThumbnail> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;
  video.src = url;

  try {
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('Tempo esgotado ao ler o vídeo.')), VIDEO_FRAME_TIMEOUT_MS);
      video.onloadeddata = () => {
        window.clearTimeout(timer);
        resolve();
      };
      video.onerror = () => {
        window.clearTimeout(timer);
        reject(new Error('Formato de vídeo não suportado pelo navegador.'));
      };
    });

    const target = Math.min(1, (Number.isFinite(video.duration) ? video.duration : 0) / 2);
    if (target > 0) {
      await new Promise<void>((resolve) => {
        const timer = window.setTimeout(resolve, 5000);
        video.onseeked = () => {
          window.clearTimeout(timer);
          resolve();
        };
        video.currentTime = target;
      });
    }

    return await renderThumbnail(video, video.videoWidth, video.videoHeight);
  } finally {
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
  }
}

interface UploadOptions {
  bucket: string;
  path: string;
  body: Blob;
  contentType: string;
  accessToken: string;
  onProgress: (loadedBytes: number) => void;
}

function uploadWithProgress({ bucket, path, body, contentType, accessToken, onProgress }: UploadOptions) {
  return new Promise<void>((resolve, reject) => {
    const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
    const encodedPath = path.split('/').map(encodeURIComponent).join('/');
    const xhr = new XMLHttpRequest();

    xhr.open('POST', `${baseUrl}/storage/v1/object/${bucket}/${encodedPath}`);
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    xhr.setRequestHeader('apikey', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '');
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.setRequestHeader('cache-control', 'max-age=31536000');

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded);
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(body.size);
        resolve();
        return;
      }
      let message = `Erro ${xhr.status} no envio.`;
      try {
        const parsed = JSON.parse(xhr.responseText) as { message?: string; error?: string };
        message = parsed.message || parsed.error || message;
      } catch {
        // Resposta sem corpo JSON
      }
      reject(new Error(message));
    };

    xhr.onerror = () => reject(new Error('Falha de conexão durante o envio.'));
    xhr.onabort = () => reject(new Error('Envio cancelado.'));
    xhr.send(body);
  });
}

// Upload direto para o Cloudflare R2 usando Presigned URL (Sem limite de 50MB)
function uploadDirectToR2({
  uploadUrl,
  body,
  contentType,
  onProgress,
}: {
  uploadUrl: string;
  body: Blob;
  contentType: string;
  onProgress: (loadedBytes: number) => void;
}) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', contentType);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded);
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(body.size);
        resolve();
      } else {
        reject(new Error(`Falha no upload para o Cloudflare R2 (Código: ${xhr.status})`));
      }
    };

    xhr.onerror = () => reject(new Error('Falha de rede ao transferir para o Cloudflare R2.'));
    xhr.onabort = () => reject(new Error('Upload cancelado.'));
    xhr.send(body);
  });
}

function getExtension(filename: string): string {
  const match = /\.([a-z0-9]{1,8})$/i.exec(filename);
  return match ? match[1].toLowerCase() : '';
}

function detectMediaType(file: File): MediaType | null {
  if (file.type.startsWith('image/')) return 'photo';
  if (file.type.startsWith('video/')) return 'video';
  const ext = getExtension(file.name);
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif', 'avif', 'tif', 'tiff'].includes(ext)) return 'photo';
  if (['mp4', 'mov', 'm4v', 'webm', 'avi', 'mkv'].includes(ext)) return 'video';
  return null;
}

interface MediaUploaderProps {
  gallery: Pick<Gallery, 'id' | 'title' | 'slug'>;
  initialMedia: MediaItem[];
}

export default function MediaUploader({ gallery, initialMedia }: MediaUploaderProps) {
  const supabase = useMemo(() => createClient(), []);

  const [selectedCategory, setSelectedCategory] = useState<'takes' | 'editados'>('takes');
  const [media, setMedia] = useState<MediaItem[]>(initialMedia);
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [rejectedMessage, setRejectedMessage] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const queueRef = useRef<(UploadTask & { category: 'takes' | 'editados' })[]>([]);
  const activeCount = useRef(0);
  const nextOrder = useRef(
    initialMedia.reduce((max, item) => Math.max(max, item.display_order), -1) + 1,
  );

  const isUploading = tasks.some((t) => ['queued', 'processing', 'uploading', 'saving'].includes(t.status));

  useEffect(() => {
    if (!isUploading) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isUploading]);

  const updateTask = (id: string, patch: Partial<UploadTask>) => {
    setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, ...patch } : task)));
  };

  const processTask = async (task: UploadTask & { category: 'takes' | 'editados' }) => {
    const { file, category } = task;
    const mediaType = detectMediaType(file) ?? 'photo';
    const uploadedSupabasePaths: { bucket: string; path: string }[] = [];

    try {
      updateTask(task.id, { status: 'processing', progress: 2, error: undefined });

      let thumbnail: GeneratedThumbnail | null = null;
      try {
        thumbnail = mediaType === 'photo' ? await createImageThumbnail(file) : await createVideoThumbnail(file);
      } catch (error) {
        if (mediaType === 'photo') {
          throw new Error(
            error instanceof Error
              ? `${error.message} Converta para JPEG/PNG antes de enviar.`
              : 'Não foi possível processar a imagem.',
          );
        }
        thumbnail = null;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada. Faça login novamente.');

      const uid = crypto.randomUUID();
      const ext = getExtension(file.name);
      const thumbnailPath = thumbnail ? `${gallery.id}/${uid}.${thumbnail.extension}` : null;

      const originalSize = file.size;
      const totalBytes = originalSize + (thumbnail?.blob.size ?? 0) || 1;
      const toPercent = (bytes: number) => 5 + Math.min(1, bytes / totalBytes) * 90;

      updateTask(task.id, { status: 'uploading', progress: 5 });

      let originalPath = '';

      if (mediaType === 'video') {
        // ENVIAR VÍDEO PARA CLOUDFLARE R2
        const presignedRes = await fetch('/api/upload/presigned', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            galleryId: gallery.id,
            filename: file.name,
            contentType: file.type || 'video/mp4',
          }),
        });

        if (!presignedRes.ok) {
          const errData = await presignedRes.json().catch(() => ({}));
          throw new Error(errData.error || 'Falha ao obter URL de envio Cloudflare R2.');
        }

        const { uploadUrl, storageKey } = await presignedRes.json();

        await uploadDirectToR2({
          uploadUrl,
          body: file,
          contentType: file.type || 'video/mp4',
          onProgress: (loaded) => updateTask(task.id, { progress: toPercent(loaded) }),
        });

        originalPath = storageKey;
      } else {
        // ENVIAR FOTO PARA SUPABASE STORAGE
        originalPath = `${gallery.id}/${uid}${ext ? `.${ext}` : ''}`;
        await uploadWithProgress({
          bucket: BUCKETS.originals,
          path: originalPath,
          body: file,
          contentType: file.type || 'application/octet-stream',
          accessToken: session.access_token,
          onProgress: (loaded) => updateTask(task.id, { progress: toPercent(loaded) }),
        });
        uploadedSupabasePaths.push({ bucket: BUCKETS.originals, path: originalPath });
      }

      // ENVIAR MINIATURA PARA SUPABASE
      if (thumbnail && thumbnailPath) {
        await uploadWithProgress({
          bucket: BUCKETS.thumbnails,
          path: thumbnailPath,
          body: thumbnail.blob,
          contentType: thumbnail.contentType,
          accessToken: session.access_token,
          onProgress: (loaded) => updateTask(task.id, { progress: toPercent(originalSize + loaded) }),
        });
        uploadedSupabasePaths.push({ bucket: BUCKETS.thumbnails, path: thumbnailPath });
      }

      updateTask(task.id, { status: 'saving', progress: 97 });

      const payload: MediaItemInsert & { category: string } = {
        gallery_id: gallery.id,
        media_type: mediaType,
        filename: file.name,
        original_storage_path: originalPath,
        thumbnail_storage_path: thumbnailPath,
        width: thumbnail?.width ?? null,
        height: thumbnail?.height ?? null,
        display_order: nextOrder.current++,
        category: category,
      };

      const { data, error } = await supabase.from('media_items').insert(payload as any).select('*').single();
      if (error) throw new Error(`Erro ao salvar no banco: ${error.message}`);

      setMedia((prev) => [...prev, data as MediaItem]);
      updateTask(task.id, { status: 'done', progress: 100 });
    } catch (error) {
      if (uploadedSupabasePaths.length > 0) {
        await Promise.all(
          uploadedSupabasePaths.map(({ bucket, path }) => supabase.storage.from(bucket).remove([path])),
        ).catch(() => undefined);
      }

      updateTask(task.id, {
        status: 'error',
        error: error instanceof Error ? error.message : 'Erro desconhecido.',
      });
    }
  };

  const pumpQueue = () => {
    while (activeCount.current < MAX_CONCURRENT_UPLOADS && queueRef.current.length > 0) {
      const task = queueRef.current.shift()!;
      activeCount.current++;
      processTask(task).finally(() => {
        activeCount.current--;
        pumpQueue();
      });
    }
  };

  const enqueueFiles = (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    const accepted = files.filter((file) => detectMediaType(file) !== null);
    const rejected = files.length - accepted.length;

    setRejectedMessage(
      rejected > 0 ? `${rejected} arquivo(s) ignorado(s): apenas fotos e vídeos são aceitos.` : null,
    );
    if (accepted.length === 0) return;

    const newTasks = accepted.map((file) => ({
      id: crypto.randomUUID(),
      file,
      status: 'queued' as const,
      progress: 0,
      category: selectedCategory,
    }));

    setTasks((prev) => [...prev, ...newTasks]);
    queueRef.current.push(...newTasks);
    pumpQueue();
  };

  const retryFailed = () => {
    const failed = tasks.filter((t) => t.status === 'error');
    if (failed.length === 0) return;
    const ids = new Set(failed.map((t) => t.id));
    setTasks((prev) =>
      prev.map((t) => (ids.has(t.id) ? { ...t, status: 'queued', progress: 0, error: undefined } : t)),
    );
    queueRef.current.push(
      ...failed.map((t) => ({ ...t, status: 'queued' as const, progress: 0, category: selectedCategory })),
    );
    pumpQueue();
  };

  const clearFinished = () => {
    setTasks((prev) => prev.filter((t) => t.status !== 'done' && t.status !== 'error'));
  };

  const deleteMedia = async (item: MediaItem) => {
    if (!window.confirm(`Excluir "${item.filename}"? Esta ação não pode ser desfeita.`)) return;

    setDeletingIds((prev) => new Set(prev).add(item.id));

    const { error } = await supabase.from('media_items').delete().eq('id', item.id);
    if (error) {
      window.alert(`Não foi possível excluir: ${error.message}`);
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
      return;
    }

    if (!item.original_storage_path.startsWith('http')) {
      await supabase.storage.from(BUCKETS.originals).remove([item.original_storage_path]).catch(() => undefined);
    }

    if (item.thumbnail_storage_path) {
      await supabase.storage.from(BUCKETS.thumbnails).remove([item.thumbnail_storage_path]).catch(() => undefined);
    }

    setMedia((prev) => prev.filter((m) => m.id !== item.id));
    setDeletingIds((prev) => {
      const next = new Set(prev);
      next.delete(item.id);
      return next;
    });
  };

  const onDragEnter = (event: React.DragEvent) => {
    event.preventDefault();
    dragDepth.current++;
    setIsDragging(true);
  };
  const onDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setIsDragging(false);
  };
  const onDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };
  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
    if (event.dataTransfer.files?.length) enqueueFiles(event.dataTransfer.files);
  };

  const summary = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === 'done').length;
    const failed = tasks.filter((t) => t.status === 'error').length;
    const totalBytes = tasks.reduce((sum, t) => sum + t.file.size, 0) || 1;
    const weighted = tasks.reduce((sum, t) => sum + (t.progress / 100) * t.file.size, 0);
    return { total, done, failed, percent: Math.round((weighted / totalBytes) * 100) };
  }, [tasks]);

  const visibleTasks = useMemo(
    () => [...tasks].sort((a, b) => statusWeight(a.status) - statusWeight(b.status)),
    [tasks],
  );

  return (
    <div className="space-y-8">
      {/* Seletor de Categoria */}
      <div className="flex flex-col items-center justify-center gap-2">
        <label className="text-xs uppercase tracking-wider text-ink-muted font-medium">
          Escolha para onde deseja enviar os arquivos:
        </label>
        <div className="inline-flex rounded-xl border border-stone-200 bg-stone-100 p-1.5 shadow-inner">
          <button
            type="button"
            onClick={() => setSelectedCategory('takes')}
            className={`rounded-lg px-8 py-2.5 text-xs font-semibold uppercase tracking-wider transition ${
              selectedCategory === 'takes'
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-500 hover:text-stone-900'
            }`}
          >
            Aba Takes
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory('editados')}
            className={`rounded-lg px-8 py-2.5 text-xs font-semibold uppercase tracking-wider transition ${
              selectedCategory === 'editados'
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-500 hover:text-stone-900'
            }`}
          >
            Aba Editados
          </button>
        </div>
      </div>

      {/* Área de Dropzone */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-14 text-center transition ${
          isDragging
            ? 'border-[#1B64DA] bg-[#1B64DA]/5'
            : 'border-stone-300 bg-white hover:border-stone-400 hover:bg-stone-50'
        }`}
      >
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="text-ink-muted" aria-hidden>
          <path
            d="M12 16V4m0 0-4 4m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <p className="mt-4 font-serif text-2xl text-ink">
          {isDragging
            ? `Solte aqui para enviar em "${selectedCategory.toUpperCase()}"`
            : `Arraste fotos e vídeos para cá (${selectedCategory.toUpperCase()})`}
        </p>
        <p className="mt-2 text-sm text-ink-soft">
          ou <span className="font-medium text-[#1B64DA] underline-offset-2 hover:underline">clique para selecionar</span>{' '}
          — envio múltiplo com miniaturas WebP geradas automaticamente
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) enqueueFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {rejectedMessage && (
        <p className="rounded-md bg-amber-50 px-4 py-2 text-sm text-amber-800">{rejectedMessage}</p>
      )}

      {/* Painel da fila de envio */}
      {tasks.length > 0 && (
        <section className="admin-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-ink">
                {isUploading ? 'Enviando arquivos…' : 'Envio concluído'}
              </h2>
              <p className="mt-0.5 text-xs text-ink-soft">
                {summary.done} de {summary.total} concluído(s)
                {summary.failed > 0 && <span className="text-red-600"> · {summary.failed} com erro</span>}
              </p>
            </div>
            <div className="flex gap-2">
              {summary.failed > 0 && !isUploading && (
                <button
                  type="button"
                  onClick={retryFailed}
                  className="rounded-md border border-stone-300 px-3 py-1.5 text-xs text-ink hover:border-stone-500"
                >
                  Tentar novamente
                </button>
              )}
              {!isUploading && (
                <button
                  type="button"
                  onClick={clearFinished}
                  className="rounded-md px-3 py-1.5 text-xs text-ink-soft hover:text-ink"
                >
                  Limpar lista
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-stone-100">
            <div
              className="h-full rounded-full bg-[#1B64DA] transition-[width] duration-300"
              style={{ width: `${summary.percent}%` }}
            />
          </div>
          <p className="mt-1.5 text-right text-xs tabular-nums text-ink-soft">{summary.percent}%</p>

          <ul className="mt-3 max-h-72 divide-y divide-stone-100 overflow-y-auto pr-1">
            {visibleTasks.map((task) => (
              <li key={task.id} className="py-2.5">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="min-w-0 truncate text-ink" title={task.file.name}>
                    {task.file.name}
                  </span>
                  <span className="shrink-0 tabular-nums text-ink-soft">
                    {formatBytes(task.file.size)} · <StatusLabel task={task} />
                  </span>
                </div>
                {task.status !== 'done' && task.status !== 'error' && (
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-stone-100">
                    <div
                      className="h-full rounded-full bg-[#1B64DA]/70 transition-[width] duration-200"
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                )}
                {task.error && <p className="mt-1 text-xs text-red-600">{task.error}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Mídias carregadas */}
      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="font-serif text-2xl text-ink">Mídias da galeria</h2>
          <span className="text-sm text-ink-soft">{media.length} arquivo(s)</span>
        </div>

        {media.length === 0 ? (
          <p className="admin-card px-6 py-12 text-center text-sm text-ink-soft">
            Nenhuma mídia enviada ainda.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {media.map((item) => {
              const thumb = getThumbnailUrl(item.thumbnail_storage_path);
              const deleting = deletingIds.has(item.id);
              const itemCategory = (item as any).category || (item.media_type === 'video' ? 'takes' : 'editados');

              return (
                <li
                  key={item.id}
                  className={`group relative overflow-hidden rounded-lg border border-stone-200 bg-stone-100 transition ${
                    deleting ? 'opacity-40' : ''
                  }`}
                >
                  <div className="aspect-square">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt={item.filename}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center p-2 text-center text-[11px] text-ink-muted">
                        {item.media_type === 'video' ? 'Vídeo sem miniatura' : 'Sem miniatura'}
                      </div>
                    )}
                  </div>

                  <div className="absolute left-2 top-2 flex flex-col gap-1">
                    <span className="rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white">
                      {itemCategory}
                    </span>
                    {item.media_type === 'video' && (
                      <span className="rounded bg-blue-600/80 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white">
                        Vídeo
                      </span>
                    )}
                  </div>

                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent px-2 pb-2 pt-6 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                    <span className="min-w-0 truncate text-[11px] text-white" title={item.filename}>
                      {item.filename}
                    </span>
                    <button
                      type="button"
                      onClick={() => deleteMedia(item)}
                      disabled={deleting}
                      aria-label={`Excluir ${item.filename}`}
                      className="shrink-0 rounded bg-white/90 p-1.5 text-red-600 transition hover:bg-red-600 hover:text-white"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path
                          d="M4 7h16M10 11v6m4-6v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function statusWeight(status: UploadTask['status']): number {
  switch (status) {
    case 'uploading':
    case 'processing':
    case 'saving':
      return 0;
    case 'queued':
      return 1;
    case 'error':
      return 2;
    default:
      return 3;
  }
}

function StatusLabel({ task }: { task: UploadTask }) {
  switch (task.status) {
    case 'queued':
      return <span>na fila</span>;
    case 'processing':
      return <span>gerando miniatura…</span>;
    case 'uploading':
      return <span>{Math.round(task.progress)}%</span>;
    case 'saving':
      return <span>salvando…</span>;
    case 'done':
      return <span className="text-emerald-600">concluído ✓</span>;
    case 'error':
      return <span className="text-red-600">erro</span>;
  }
}