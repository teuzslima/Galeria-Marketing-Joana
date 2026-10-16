const MAX_SLUG_LENGTH = 80;

/** Remove acentos/diacríticos: "Aniversário" -> "Aniversario" */
function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Gera um slug limpo e definitivo a partir de um texto.
 *
 * @example slugify('Casamento Camila')          // "casamento-camila"
 * @example slugify('Aniversário 1 ano — Arthur') // "aniversario-1-ano-arthur"
 * @example slugify('Mariana & Pedro')            // "mariana-e-pedro"
 */
export function slugify(input: string): string {
  return stripAccents(input)
    .toLowerCase()
    .replace(/&/g, ' e ')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/^-+|-+$/g, '');
}

/**
 * Sanitiza o slug enquanto o usuário digita manualmente.
 * Diferente de `slugify`, preserva o hífen final para permitir continuar digitando.
 */
export function sanitizeSlugInput(input: string): string {
  return stripAccents(input)
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+/, '')
    .slice(0, MAX_SLUG_LENGTH);
}

/** Valida o formato aceito pelo banco: letras minúsculas, números e hífens simples */
export function isValidSlug(slug: string): boolean {
  return slug.length > 0 && slug.length <= 100 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

