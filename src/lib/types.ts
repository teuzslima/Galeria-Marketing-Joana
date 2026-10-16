// =============================================================================
// Tipos de domínio compartilhados entre front-end, painel e rotas de API
// =============================================================================

export type GalleryStatus = 'draft' | 'published';
export type MediaType = 'photo' | 'video';

/** Linha da tabela `galleries` */
export interface Gallery {
  id: string;
  title: string;
  slug: string;
  client_name: string | null;
  /** Data no formato ISO `YYYY-MM-DD` (coluna `date` do Postgres) */
  event_date: string | null;
  welcome_message: string | null;
  status: GalleryStatus;
  allow_download: boolean;
  created_at: string;
  updated_at: string;
}

/** Payload de criação de galeria */
export interface GalleryInsert {
  title: string;
  slug: string;
  client_name?: string | null;
  event_date?: string | null;
  welcome_message?: string | null;
  status: GalleryStatus;
  allow_download: boolean;
}

/** Linha da tabela `media_items` */
export interface MediaItem {
  id: string;
  gallery_id: string;
  media_type: MediaType;
  /** Nome original do arquivo enviado (usado no download) */
  filename: string;
  /** Caminho no bucket privado `gallery-originals` */
  original_storage_path: string;
  /** Caminho no bucket público `gallery-thumbnails` */
  thumbnail_storage_path: string | null;
  width: number | null;
  height: number | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}

/** Payload de criação de mídia */
export interface MediaItemInsert {
  gallery_id: string;
  media_type: MediaType;
  filename: string;
  original_storage_path: string;
  thumbnail_storage_path: string | null;
  width: number | null;
  height: number | null;
  display_order: number;
}

/** Mídia pronta para exibição pública (com URL pública da miniatura resolvida) */
export interface PublicMediaItem {
  id: string;
  media_type: MediaType;
  filename: string;
  thumbnail_url: string | null;
  width: number | null;
  height: number | null;
}

/** Galeria com estatísticas para o dashboard */
export interface GalleryWithStats extends Gallery {
  media_count: number;
  cover_url: string | null;
}

/** Estados de cada arquivo na fila de upload */
export type UploadStatus = 'queued' | 'processing' | 'uploading' | 'saving' | 'done' | 'error';

export interface UploadTask {
  id: string;
  file: File;
  status: UploadStatus;
  /** 0–100 */
  progress: number;
  error?: string;
}

/** Resultado da geração de miniatura no cliente */
export interface GeneratedThumbnail {
  blob: Blob;
  contentType: string;
  extension: 'webp' | 'jpg';
  /** Dimensões da mídia original (para aspect-ratio no grid) */
  width: number;
  height: number;
}

