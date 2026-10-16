import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { BUCKETS, UUID_REGEX } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Validade da URL assinada para download (segundos) */
const DOWNLOAD_URL_TTL = 60;
/** Validade da URL assinada para reprodução de vídeo no lightbox (segundos) */
const VIEW_URL_TTL = 60 * 60 * 2;

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

/**
 * GET /api/download/[mediaId]
 *   -> redireciona para uma Signed URL temporária do bucket privado,
 *      forçando o download com o nome original do arquivo.
 *
 * GET /api/download/[mediaId]?mode=view
 *   -> Signed URL sem forçar download (reprodução de vídeos no lightbox).
 */
export async function GET(request: NextRequest, { params }: { params: { mediaId: string } }) {
  const { mediaId } = params;
  if (!UUID_REGEX.test(mediaId)) return jsonError('Identificador de mídia inválido.', 400);

  const mode = request.nextUrl.searchParams.get('mode') === 'view' ? 'view' : 'download';

  let admin;
  try {
    admin = createAdminClient();
  } catch (error) {
    console.error('[download] configuração ausente:', error);
    return jsonError('Serviço indisponível.', 500);
  }

  const { data: media, error: mediaError } = await admin
    .from('media_items')
    .select('id, gallery_id, media_type, filename, original_storage_path')
    .eq('id', mediaId)
    .maybeSingle();

  if (mediaError) {
    console.error('[download] erro ao buscar mídia:', mediaError.message);
    return jsonError('Erro ao localizar o arquivo.', 500);
  }
  if (!media) return jsonError('Arquivo não encontrado.', 404);

  const { data: gallery, error: galleryError } = await admin
    .from('galleries')
    .select('id, status, allow_download')
    .eq('id', media.gallery_id)
    .maybeSingle();

  if (galleryError) {
    console.error('[download] erro ao buscar galeria:', galleryError.message);
    return jsonError('Erro ao localizar a galeria.', 500);
  }

  // Galerias em rascunho são tratadas como inexistentes para o público
  if (!gallery || gallery.status !== 'published') {
    return jsonError('Arquivo não encontrado.', 404);
  }

  if (mode === 'view') {
    // Visualização inline é liberada apenas para vídeos (fotos usam a miniatura pública)
    if (media.media_type !== 'video') return jsonError('Modo de visualização indisponível.', 400);
  } else if (!gallery.allow_download) {
    return jsonError('O download não está habilitado para esta galeria.', 403);
  }

  const { data: signed, error: signError } = await admin.storage
    .from(BUCKETS.originals)
    .createSignedUrl(
      media.original_storage_path,
      mode === 'view' ? VIEW_URL_TTL : DOWNLOAD_URL_TTL,
      mode === 'download' ? { download: media.filename } : undefined,
    );

  if (signError || !signed?.signedUrl) {
    console.error('[download] erro ao assinar URL:', signError?.message);
    return jsonError('Não foi possível gerar o link de download.', 500);
  }

  const response = NextResponse.redirect(signed.signedUrl, 302);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

