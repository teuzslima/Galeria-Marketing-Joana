'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import AdminHeader from '@/components/admin/AdminHeader';
import { createClient } from '@/lib/supabase/client';
import { isValidSlug, sanitizeSlugInput, slugify } from '@/lib/utils/slugify';
import type { GalleryInsert, GalleryStatus } from '@/lib/types';

export default function NewGalleryPage() {
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [eventDate, setEventDate] = useState('');
  const [clientName, setClientName] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [allowDownload, setAllowDownload] = useState(true);
  const [status, setStatus] = useState<GalleryStatus>('draft');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/+$/, '');
  const finalSlug = slugify(slug);

  const handleTitleChange = (value: string) => {
    setTitle(value);
    // Slug gerado em tempo real enquanto não for editado manualmente
    if (!slugEdited) setSlug(slugify(value));
  };

  const handleSlugChange = (value: string) => {
    setSlugEdited(true);
    setSlug(sanitizeSlugInput(value));
  };

  const resetSlug = () => {
    setSlugEdited(false);
    setSlug(slugify(title));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!title.trim()) return setError('Informe o nome do evento.');
    if (!eventDate) return setError('Informe a data do evento.');
    if (!isValidSlug(finalSlug)) return setError('O endereço (slug) é inválido.');

    setSubmitting(true);

    const payload: GalleryInsert = {
      title: title.trim(),
      slug: finalSlug,
      event_date: eventDate,
      client_name: clientName.trim() || null,
      welcome_message: welcomeMessage.trim() || null,
      allow_download: allowDownload,
      status,
    };

    const { data, error: insertError } = await createClient()
      .from('galleries')
      .insert(payload)
      .select('id')
      .single();

    if (insertError) {
      setSubmitting(false);
      setError(
        insertError.code === '23505'
          ? `Já existe uma galeria com o endereço "/galeria/${finalSlug}". Escolha outro.`
          : `Não foi possível criar a galeria: ${insertError.message}`,
      );
      return;
    }

    router.push(`/admin/galerias/${(data as { id: string }).id}/fotos`);
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <AdminHeader />

      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <Link href="/admin/dashboard" className="text-sm text-ink-soft hover:text-ink">
          ← Voltar às galerias
        </Link>
        <h1 className="mt-3 font-serif text-4xl font-light text-ink">Nova galeria</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Preencha os dados do evento. Em seguida você poderá enviar as fotos.
        </p>

        <form onSubmit={handleSubmit} className="admin-card mt-8 space-y-6 p-6 sm:p-8">
          <div>
            <label htmlFor="title" className="admin-label">
              Nome do evento *
            </label>
            <input
              id="title"
              required
              maxLength={160}
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="admin-input font-serif text-lg"
              placeholder="Ex.: Casamento Mariana e Pedro"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="slug" className="admin-label">
                Endereço da galeria
              </label>
              {slugEdited && (
                <button
                  type="button"
                  onClick={resetSlug}
                  className="mb-1.5 text-xs text-[#1B64DA] hover:underline"
                >
                  Gerar a partir do título
                </button>
              )}
            </div>
            <div className="flex overflow-hidden rounded-md border border-stone-300 bg-white shadow-sm focus-within:border-[#1B64DA] focus-within:ring-2 focus-within:ring-[#1B64DA]/20">
              <span className="flex items-center whitespace-nowrap border-r border-stone-200 bg-stone-50 px-3 text-sm text-ink-muted">
                /galeria/
              </span>
              <input
                id="slug"
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                className="w-full px-3 py-2.5 font-mono text-sm text-ink outline-none"
                placeholder="casamento-mariana-e-pedro"
              />
            </div>
            <p className="mt-1.5 truncate text-xs text-ink-muted">
              Link público:{' '}
              <span className="font-mono text-ink-soft">
                {siteUrl}/galeria/{finalSlug || '…'}
              </span>
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="eventDate" className="admin-label">
                Data do evento *
              </label>
              <input
                id="eventDate"
                type="date"
                required
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="admin-input"
              />
            </div>
            <div>
              <label htmlFor="clientName" className="admin-label">
                Nome do cliente <span className="normal-case text-ink-muted">(opcional)</span>
              </label>
              <input
                id="clientName"
                maxLength={160}
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="admin-input"
                placeholder="Ex.: Família Souza"
              />
            </div>
          </div>

          <div>
            <label htmlFor="welcomeMessage" className="admin-label">
              Mensagem de apresentação <span className="normal-case text-ink-muted">(opcional)</span>
            </label>
            <textarea
              id="welcomeMessage"
              rows={4}
              maxLength={1000}
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              className="admin-input resize-y"
              placeholder="Foi uma alegria registrar este dia tão especial…"
            />
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-stone-200 p-4 transition hover:bg-stone-50">
            <input
              type="checkbox"
              checked={allowDownload}
              onChange={(e) => setAllowDownload(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#1B64DA]"
            />
            <span>
              <span className="block text-sm font-medium text-ink">Permitir download</span>
              <span className="block text-xs text-ink-soft">
                Os clientes poderão baixar os arquivos originais e o ZIP completo.
              </span>
            </span>
          </label>

          <fieldset>
            <legend className="admin-label">Status</legend>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  { value: 'draft', label: 'Rascunho', hint: 'Visível apenas para você' },
                  { value: 'published', label: 'Publicada', hint: 'Acessível pelo link' },
                ] as const
              ).map((option) => (
                <label
                  key={option.value}
                  className={`cursor-pointer rounded-lg border p-4 transition ${
                    status === option.value
                      ? 'border-[#1B64DA] bg-[#1B64DA]/5 ring-1 ring-[#1B64DA]'
                      : 'border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="status"
                    value={option.value}
                    checked={status === option.value}
                    onChange={() => setStatus(option.value)}
                    className="sr-only"
                  />
                  <span className="block text-sm font-medium text-ink">{option.label}</span>
                  <span className="block text-xs text-ink-soft">{option.hint}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {error && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse gap-3 border-t border-stone-100 pt-6 sm:flex-row sm:justify-end">
            <Link
              href="/admin/dashboard"
              className="rounded-md px-5 py-3 text-center text-sm text-ink-soft hover:text-ink"
            >
              Cancelar
            </Link>
            <button type="submit" disabled={submitting} className="btn-primary rounded-md px-6 py-3">
              {submitting ? 'Criando…' : 'Criar galeria e enviar fotos'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

