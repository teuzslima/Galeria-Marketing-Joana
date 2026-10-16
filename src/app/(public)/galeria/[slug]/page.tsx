import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import HeroSection from '@/components/public/HeroSection';
import GalleryGrid from '@/components/public/GalleryGrid';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { fetchAllMedia, toPublicMedia, getThumbnailUrl } from '@/lib/storage';
import { isValidSlug } from '@/lib/utils/slugify';
import { formatEventDate } from '@/lib/utils/format';
import type { Gallery } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { slug: string };
}

/**
 * O RLS garante que visitantes só enxerguem galerias publicadas.
 * A administradora logada também consegue pré-visualizar rascunhos.
 */
const getGallery = cache(async (slug: string): Promise<Gallery | null> => {
  if (!isValidSlug(slug)) return null;

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('galleries')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (error) {
    console.error('[galeria] erro ao buscar galeria:', error.message);
    return null;
  }

  return (data as Gallery | null) ?? null;
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const gallery = await getGallery(params.slug);
  if (!gallery) return { title: 'Galeria não encontrada' };

  const date = formatEventDate(gallery.event_date);
  const description = gallery.welcome_message?.slice(0, 160) || date || undefined;

  return {
    title: gallery.title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title: gallery.title,
      description,
      type: 'website',
    },
  };
}

export default async function GalleryPage({ params }: PageProps) {
  const gallery = await getGallery(params.slug);
  if (!gallery) notFound();

  const supabase = createServerSupabaseClient();
  const media = await fetchAllMedia(supabase, gallery.id);
  const items = media.map(toPublicMedia);

  const isPublished = gallery.status === 'published';
  const canDownload = isPublished && gallery.allow_download;

  // Garante a extração da URL válida da foto do casal:
  const firstMedia = media[0];
  const firstItem = items[0];
  const coverUrl =
    (firstMedia?.thumbnail_storage_path && getThumbnailUrl(firstMedia.thumbnail_storage_path)) ||
    (firstMedia?.original_storage_path && getThumbnailUrl(firstMedia.original_storage_path)) ||
    firstItem?.thumbnailUrl ||
    firstItem?.url ||
    null;

  return (
    <main className="min-h-screen bg-ivory">
      {coverUrl && <link rel="preload" as="image" href={coverUrl} />}

      <HeroSection
        gallery={gallery}
        coverUrl={coverUrl}
        mediaCount={items.length}
        canDownload={canDownload}
        isPreview={!isPublished}
        galleryAnchorId="galeria"
      />

      <GalleryGrid id="galeria" items={items} allowDownload={canDownload} />

      <footer className="border-t border-ink/10 px-6 py-12 text-center">
        <p className="signature">J O A N A • M I R E L L Y • M A R K E T I N G</p>
        <p className="mt-4 text-[11px] text-ink-muted">
          © {new Date().getFullYear()} Joana Mirelly Marketing. Todas as imagens são protegidas
          por direitos autorais.
        </p>
      </footer>
    </main>
  );
}