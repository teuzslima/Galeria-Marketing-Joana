import { NextResponse, type NextRequest } from 'next/server';
import JSZip from 'jszip';
import { createAdminClient } from '@/lib/supabase/server';
import { BUCKETS, UUID_REGEX, fetchAllMedia } from '@/lib/storage';
import type { MediaItem } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** Galerias grandes podem levar alguns minutos (ajuste conforme seu plano de hospedagem) */
export const maxDuration = 300;

/** Downloads simultâneos do Storage durante a montagem do ZIP */
const DOWNLOAD_CONCURRENCY = 4;

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

/** Remove caracteres inválidos em nomes de arquivo */
function sanitizeFilename(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim();
  return cleaned || 'arquivo';
}

/** Garante nomes únicos dentro do ZIP: foto.jpg, foto (2).jpg, foto (3).jpg… */
function buildUniqueNames(items: MediaItem[]): string[] {
  const used = new Set<string>();

  return items.map((item) => {
    const base = sanitizeFilename(item.filename);
    const dot = base.lastIndexOf('.');
    const stem = dot > 0 ? base.slice(0, dot) : base;
    const ext = dot > 0 ? base.slice(dot) : '';

    let candidate = base;
    let counter = 2;
    while (used.has(candidate.toLowerCase())) {
      candidate = `${stem} (${counter})${ext}`;
      counter++;
    }
    used.add(candidate.toLowerCase());
    return candidate;
  });
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
) {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      await worker(items[index], index);
    }
  });
  await Promise.all(runners);
}

function contentDisposition(filename: string): string {
  const ascii = filename.normalize('NFD').replace(/[^\x20-\x7e]/g, '').replace(/"/g, '');
  return `attachment; filename="${ascii || 'galeria.zip'}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

async function buildZipResponse(galleryId: string | null): Promise<Response> {
  if (!galleryId || !UUID_REGEX.test(galleryId)) {
    return jsonError('Parâmetro galleryId inválido.', 400);
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (error) {
    console.error('[zip] configuração ausente:', error);
    return jsonError('Serviço indisponível.', 500);
  }

  const { data: gallery, error: galleryError } = await admin
    .from('galleries')
    .select('id, title, slug, status, allow_download')
    .eq('id', galleryId)
    .maybeSingle();

  if (galleryError) {
    console.error('[zip] erro ao buscar galeria:', galleryError.message);
    return jsonError('Erro ao localizar a galeria.', 500);
  }
  if (!gallery || gallery.status !== 'published') {
    return jsonError('Galeria não encontrada.', 404);
  }
  if (!gallery.allow_download) {
    return jsonError('O download não está habilitado para esta galeria.', 403);
  }

  let media: MediaItem[];
  try {
    media = await fetchAllMedia(admin, gallery.id);
  } catch (error) {
    console.error('[zip] erro ao listar mídias:', error);
    return jsonError('Erro ao listar os arquivos da galeria.', 500);
  }

  if (media.length === 0) return jsonError('Esta galeria ainda não possui arquivos.', 404);

  const zip = new JSZip();
  const names = buildUniqueNames(media);
  const failures: string[] = [];

  await runWithConcurrency(media, DOWNLOAD_CONCURRENCY, async (item, index) => {
    const { data, error } = await admin.storage
      .from(BUCKETS.originals)
      .download(item.original_storage_path);

    if (error || !data) {
      console.error(`[zip] falha ao baixar ${item.original_storage_path}:`, error?.message);
      failures.push(item.filename);
      return;
    }

    const buffer = new Uint8Array(await data.arrayBuffer());
    zip.file(names[index], buffer, {
      binary: true,
      date: new Date(item.created_at),
    });
  });

  if (failures.length === media.length) {
    return jsonError('Não foi possível obter os arquivos originais.', 502);
  }

  if (failures.length > 0) {
    zip.file(
      'LEIA-ME.txt',
      `Alguns arquivos não puderam ser incluídos neste pacote:\n\n${failures
        .map((name) => `- ${name}`)
        .join('\n')}\n\nVocê pode baixá-los individualmente pela galeria online.\n`,
    );
  }

  // Fotos/vídeos já são comprimidos: STORE evita CPU desnecessária.
  // O ZIP é transmitido em streaming para o cliente enquanto é gerado.
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const helper = zip.generateInternalStream({
        type: 'uint8array',
        compression: 'STORE',
        streamFiles: true,
      });

      helper
        .on('data', (chunk) => controller.enqueue(chunk))
        .on('error', (error) => {
          console.error('[zip] erro ao gerar arquivo:', error);
          controller.error(error);
        })
        .on('end', () => controller.close());

      helper.resume();
    },
  });

  const zipName = `${gallery.slug || 'galeria'}.zip`;

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': contentDisposition(zipName),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

/** GET /api/download/zip?galleryId=<uuid> */
export async function GET(request: NextRequest) {
  return buildZipResponse(request.nextUrl.searchParams.get('galleryId'));
}

/** POST /api/download/zip  — body JSON { galleryId } ou form-data galleryId */
export async function POST(request: NextRequest) {
  let galleryId: string | null = null;
  const contentType = request.headers.get('content-type') ?? '';

  try {
    if (contentType.includes('application/json')) {
      const body = (await request.json()) as { galleryId?: unknown };
      galleryId = typeof body.galleryId === 'string' ? body.galleryId : null;
    } else {
      const form = await request.formData();
      const value = form.get('galleryId');
      galleryId = typeof value === 'string' ? value : null;
    }
  } catch {
    return jsonError('Corpo da requisição inválido.', 400);
  }

  return buildZipResponse(galleryId);
}

