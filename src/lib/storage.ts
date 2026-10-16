import type { SupabaseClient } from '@supabase/supabase-js';
import type { MediaItem, MediaType } from '@/lib/types';

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

/**
 * Monta a URL pública direta de um objeto no bucket do Supabase.
 */
export function getStoragePublicUrl(bucket: string, path: string | null | undefined): string {
  if (!path) return '';
  // Se já for uma URL completa, retorna diretamente
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${cleanPath}`;
}

export function getThumbnailUrl(path: string | null | undefined): string {
  return getStoragePublicUrl(BUCKETS.thumbnails, path);
}

export function getOriginalUrl(path: string | null | undefined): string {
  return getStoragePublicUrl(BUCKETS.originals, path);
}

/**
 * Converte o registro bruto do banco no formato padronizado consumido pelos componentes.
 */
export function toPublicMedia(item: MediaItem & { category?: string }): PublicMedia {
  const originalUrl = getOriginalUrl(item.original_storage_path);
  const thumbnailUrl = item.thumbnail_storage_path
    ? getThumbnailUrl(item.thumbnail_storage_path)
    : originalUrl;

  return {
    id: item.id,
    url: originalUrl,
    thumbnailUrl: thumbnailUrl || originalUrl,
    type: item.media_type,
    filename: item.filename,
    width: item.width,
    height: item.height,
    category: (item as any).category || (item.media_type === 'video' ? 'takes' : 'editados'),
  };
}

/**
 * Busca todas as mídias associadas à galeria ordenadas pela ordem de exibição.
 */
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