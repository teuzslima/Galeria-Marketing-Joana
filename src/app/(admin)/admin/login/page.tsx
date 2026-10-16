'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function LoginForm() {
  const searchParams = useSearchParams();

  const unauthorized = searchParams.get('error') === 'unauthorized';
  const nextParam = searchParams.get('next');
  const nextPath =
    nextParam && nextParam.startsWith('/admin') && !nextParam.startsWith('/admin/login')
      ? nextParam
      : '/admin/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    unauthorized ? 'Esta conta não tem permissão de acesso ao painel.' : null,
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setLoading(false);
        setError(
          signInError.message === 'Invalid login credentials'
            ? 'E-mail ou palavra-passe incorretos.'
            : signInError.message,
        );
        return;
      }

      if (data?.session || data?.user) {
        // Redirecionamento completo para sincronizar os cookies de sessão com o Next.js
        window.location.href = nextPath;
      } else {
        setLoading(false);
        setError('Não foi possível iniciar sessão. Tente novamente.');
      }
    } catch (err: unknown) {
      console.error('Erro de autenticação:', err);
      setLoading(false);
      setError('Falha ao contactar o servidor de autenticação.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="email" className="admin-label">
          E-mail
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="admin-input"
          placeholder="joanamirelly@gmail.com"
        />
      </div>

      <div>
        <label htmlFor="password" className="admin-label">
          Palavra-passe
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="admin-input"
          placeholder="••••••••"
        />
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? 'A entrar…' : 'Entrar'}
      </button>
    </form>
  );
}

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ivory px-4">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <p className="signature">J O A N A • M I R E L L Y • F O T O G R A F I A</p>
          <h1 className="mt-6 font-serif text-4xl font-light text-ink">Área restrita</h1>
          <p className="mt-2 text-sm text-ink-soft">Aceda ao painel de galerias.</p>
        </div>

        <div className="admin-card p-6 sm:p-8">
          <Suspense fallback={<div className="h-64" />}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}