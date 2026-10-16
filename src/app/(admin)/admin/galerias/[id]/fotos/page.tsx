import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import AdminHeader from '@/components/admin/AdminHeader';
import CopyLinkButton from '@/components/admin/CopyLinkButton';
import GalleryStatusToggle from '@/components/admin/GalleryStatusToggle';
import MediaUploader from '@/components/admin/MediaUploader';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { UUID_REGEX, fetchAllMedia } from '@/lib/storage';
import { formatEventDate, getGalleryPublicUrl } from '@/lib/utils/format';
import type { Gallery } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Gerenciar fotos' };

interface PageProps {
  params: { id: string };
}

export default async function GalleryPhotosPage({ params }: PageProps) {
  if (!UUID_REGEX.test(params.id)) notFound();

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('galleries')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();

  if (error || !data) notFound();
  const gallery = data as Gallery;

  const media = await fetchAllMedia(supabase, gallery.id);
  const publicUrl = getGalleryPublicUrl(gallery.slug);
  const isPublished = gallery.status === 'published';

  return (
    <div className="min-h-screen bg-stone-50">
      <AdminHeader />

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <Link href="/admin/dashboard" className="text-sm text-ink-soft hover:text-ink">
          ← Voltar às galerias
        </Link>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-serif text-4xl font-light text-ink">{gallery.title}</h1>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                  isPublished ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-ink-soft'
                }`}
              >
                {isPublished ? 'Publicada' : 'Rascunho'}
              </span>
            </div>
            <p className="mt-1 text-sm text-ink-soft">
              {formatEventDate(gallery.event_date) || 'Sem data'}
              {gallery.client_name && <> · {gallery.client_name}</>}
              {' · '}
              {gallery.allow_download ? 'Download permitido' : 'Download desativado'}
            </p>
            <div className="mt-2 flex min-w-0 items-center gap-2">
              <span className="truncate font-mono text-xs text-ink-muted">{publicUrl}</span>
              <CopyLinkButton url={publicUrl} />
            </div>
          </div>

          <div className="flex gap-2">
            <GalleryStatusToggle galleryId={gallery.id} status={gallery.status} />
            <a
              href={`/galeria/${gallery.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-ink transition hover:border-stone-500"
            >
              Ver galeria ↗
            </a>
          </div>
        </div>

        <div className="mt-8">
          <MediaUploader
            gallery={{ id: gallery.id, title: gallery.title, slug: gallery.slug }}
            initialMedia={media}
          />
        </div>
      </main>
    </div>
  );
}

