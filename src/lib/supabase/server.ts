import 'server-only';

import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

type CookieToSet = { name: string; value: string; options: CookieOptions };

function getPublicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Variáveis NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY não configuradas.',
    );
  }

  return { url, anonKey };
}

/**
 * Cliente Supabase para Server Components, Server Actions e Route Handlers.
 * Lê/escreve a sessão do usuário via cookies — respeita o RLS.
 */
export function createServerSupabaseClient() {
  const { url, anonKey } = getPublicEnv();
  const cookieStore = cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Chamado a partir de um Server Component (cookies somente leitura).
          // Pode ser ignorado: o middleware é responsável por renovar a sessão.
        }
      },
    },
  });
}

/**
 * Cliente com a chave service_role — IGNORA o RLS.
 * Use exclusivamente no backend (rotas de API) para operações privilegiadas,
 * como gerar Signed URLs do bucket privado de originais.
 */
export function createAdminClient() {
  const { url } = getPublicEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error('Variável SUPABASE_SERVICE_ROLE_KEY não configurada.');
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
