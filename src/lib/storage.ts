import type { SupabaseClient } from '@supabase/supabase-js';
import type { MediaItem, MediaType } from '@/lib/types';

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const BUCKETS = {
  originals: 'gallery-originals',
  thumbnails: 'gallery-thumbnails',
} as const;

export interface PublicMedia {
  id: string;
  url: string;
  thumbnailUrl: string;
  type: MediaType;
  filename: string;
  width?: number | null;
  height?: number | null;
  category?: string;
}

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
const R2_PUBLIC_URL = (
  process.env.NEXT_PUBLIC_R2_PUBLIC_URL ||
  'https://pub-7b9d1a95fda24253b509ad89cc85aa51.r2.dev'
).replace(/\/+$/, '');

export function getStoragePublicUrl(bucket: string, path: string | null | undefined): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;

  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${cleanPath}`;
}

export function getThumbnailUrl(path: string | null | undefined): string {
  return getStoragePublicUrl(BUCKETS.thumbnails, path);
}

export function getOriginalUrl(path: string | null | undefined, type?: MediaType): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;

  const cleanPath = path.startsWith('/') ? path.slice(1) : path;

  // Se for vídeo, a URL vem diretamente da CDN do Cloudflare R2
  if (type === 'video') {
    return `${R2_PUBLIC_URL}/${cleanPath}`;
  }

  // Se for foto, continua no Supabase Storage
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKETS.originals}/${cleanPath}`;
}

export function toPublicMedia(item: MediaItem & { category?: string }): PublicMedia {
  const originalUrl = getOriginalUrl(item.original_storage_path, item.media_type);
  const thumbnailUrl = item.thumbnail_storage_path
    ? getThumbnailUrl(item.thumbnail_storage_path)
    : '';

  return {
    id: item.id,
    url: originalUrl,
    // Garante que se houver thumbnail no Supabase, ela é usada (evita o ecrã cinzento no vídeo)
    thumbnailUrl: thumbnailUrl || originalUrl,
    type: item.media_type,
    filename: item.filename,
    width: item.width,
    height: item.height,
    category: (item as any).category || (item.media_type === 'video' ? 'takes' : 'editados'),
  };
}

export async function fetchAllMedia(
  supabase: SupabaseClient,
  galleryId: string,
): Promise<(MediaItem & { category?: string })[]> {
  const { data, error } = await supabase
    .from('media_items')
    .select('*')
    .eq('gallery_id', galleryId)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('[storage] Erro ao buscar media_items:', error.message);
    return [];
  }

  return (data as (MediaItem & { category?: string })[]) ?? [];
}