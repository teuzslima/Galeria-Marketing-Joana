/**
 * Formata a data do evento por extenso em pt-BR.
 * @example formatEventDate('2026-10-15') // "15 de outubro de 2026"
 */
export function formatEventDate(date: string | null | undefined): string {
  if (!date) return '';
  // Colunas `date` chegam como "YYYY-MM-DD". Fixamos meio-dia UTC para evitar
  // que o fuso horário desloque o dia ao formatar.
  const parsed = new Date(`${date.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return '';

  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
}

/** Formata a data no padrão curto: 15/10/2026 */
export function formatShortDate(date: string | null | undefined): string {
  if (!date) return '—';
  const parsed = new Date(`${date.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return '—';

  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(parsed);
}

/** Formata bytes de forma legível: 1536 -> "1,5 KB" */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${units[exponent]}`;
}

/** Monta a URL pública absoluta de uma galeria */
export function getGalleryPublicUrl(slug: string): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/+$/, '');
  return `${base}/galeria/${slug}`;
}

