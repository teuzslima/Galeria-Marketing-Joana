import Link from 'next/link';
import type { Metadata } from 'next';
import AdminHeader from '@/components/admin/AdminHeader';
import CopyLinkButton from '@/components/admin/CopyLinkButton';
import GalleryStatusToggle from '@/components/admin/GalleryStatusToggle';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getThumbnailUrl } from '@/lib/storage';
import { formatShortDate, getGalleryPublicUrl } from '@/lib/utils/format';
import type { Gallery, GalleryWithStats } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Dashboard' };

type GalleryRow = Gallery & { media_items: { count: number }[] };

async function loadGalleries(): Promise<{ galleries: GalleryWithStats[]; error: string | null }> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('galleries')
    .select('*, media_items(count)')
    .order('event_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) return { galleries: [], error: error.message };

  const rows = (data ?? []) as GalleryRow[];

  // Capa = primeira mídia (por ordem de exibição) de cada galeria
  const covers = await Promise.all(
    rows.map(async (row) => {
      const { data: cover } = await supabase
        .from('media_items')
        .select('thumbnail_storage_path')
        .eq('gallery_id', row.id)
        .not('thumbnail_storage_path', 'is', null)
        .order('display_order', { ascending: true })
        .limit(1)
        .maybeSingle();
      return getThumbnailUrl((cover as { thumbnail_storage_path: string | null } | null)?.thumbnail_storage_path);
    }),
  );

  const galleries = rows.map(({ media_items, ...gallery }, index) => ({
    ...gallery,
    media_count: media_items?.[0]?.count ?? 0,
    cover_url: covers[index],
  }));

  return { galleries, error: null };
}

export default async function DashboardPage() {
  const { galleries, error } = await loadGalleries();

  const total = galleries.length;
  const published = galleries.filter((g) => g.status === 'published').length;
  const drafts = total - published;
  const totalMedia = galleries.reduce((sum, g) => sum + g.media_count, 0);

  const metrics = [
    { label: 'Total de galerias', value: total },
    { label: 'Publicadas', value: published, accent: true },
    { label: 'Rascunhos', value: drafts },
    { label: 'Mídias enviadas', value: totalMedia },
  ];

  return (
    <div className="min-h-screen bg-stone-50">
      <AdminHeader />

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-4xl font-light text-ink">Galerias</h1>
            <p className="mt-1 text-sm text-ink-soft">Gerencie as entregas dos seus eventos.</p>
          </div>
          <Link href="/admin/galerias/nova" className="btn-primary rounded-md px-5 py-3">
            + Nova galeria
          </Link>
        </div>

        {/* Métricas */}
        <section className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {metrics.map((metric) => (
            <div key={metric.label} className="admin-card p-5">
              <p className="text-xs uppercase tracking-wider text-ink-muted">{metric.label}</p>
              <p
                className={`mt-2 font-serif text-4xl ${metric.accent ? 'text-[#1B64DA]' : 'text-ink'}`}
              >
                {metric.value.toLocaleString('pt-BR')}
              </p>
            </div>
          ))}
        </section>

        {error && (
          <p className="mt-8 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
            Erro ao carregar galerias: {error}
          </p>
        )}

        {/* Listagem */}
        <section className="mt-10">
          {galleries.length === 0 && !error ? (
            <div className="admin-card px-6 py-16 text-center">
              <p className="font-serif text-2xl text-ink">Nenhuma galeria ainda</p>
              <p className="mt-2 text-sm text-ink-soft">Crie a primeira galeria para começar.</p>
              <Link href="/admin/galerias/nova" className="btn-primary mt-6 rounded-md px-5 py-3">
                Criar galeria
              </Link>
            </div>
          ) : (
            <ul className="space-y-3">
              {galleries.map((gallery) => {
                const publicUrl = getGalleryPublicUrl(gallery.slug);
                const isPublished = gallery.status === 'published';
                return (
                  <li
                    key={gallery.id}
                    className="admin-card flex flex-col gap-4 p-4 sm:flex-row sm:items-center"
                  >
                    <div className="h-40 w-full shrink-0 overflow-hidden rounded-lg bg-stone-100 sm:h-24 sm:w-32">
                      {gallery.cover_url ? (
                        <img
                          src={gallery.cover_url}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center font-serif text-3xl text-stone-300">
                          {gallery.title.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate font-serif text-2xl text-ink">{gallery.title}</h2>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                            isPublished
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-stone-100 text-ink-soft'
                          }`}
                        >
                          {isPublished ? 'Publicada' : 'Rascunho'}
                        </span>
                        {!gallery.allow_download && (
                          <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-700">
                            Download desativado
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-ink-soft">
                        {formatShortDate(gallery.event_date)}
                        {gallery.client_name && <> · {gallery.client_name}</>}
                        {' · '}
                        {gallery.media_count} mídia(s)
                      </p>
                      <div className="mt-2 flex min-w-0 items-center gap-2">
                        <span className="truncate font-mono text-xs text-ink-muted">{publicUrl}</span>
                        <CopyLinkButton url={publicUrl} />
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col sm:items-stretch lg:flex-row lg:items-center">
                      <Link
                        href={`/admin/galerias/${gallery.id}/fotos`}
                        className="rounded-md bg-[#1B64DA] px-3 py-2 text-center text-xs font-medium text-white transition hover:bg-[#1550B0]"
                      >
                        Enviar fotos
                      </Link>
                      <a
                        href={`/galeria/${gallery.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md border border-stone-300 px-3 py-2 text-center text-xs font-medium text-ink transition hover:border-stone-500"
                      >
                        Ver galeria
                      </a>
                      <GalleryStatusToggle galleryId={gallery.id} status={gallery.status} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

