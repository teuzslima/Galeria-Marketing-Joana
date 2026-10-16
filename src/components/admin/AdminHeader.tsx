'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const NAV = [
  { href: '/admin/dashboard', label: 'Galerias' },
  { href: '/admin/galerias/nova', label: 'Nova galeria' },
];

export default function AdminHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const signOut = async () => {
    setSigningOut(true);
    await createClient().auth.signOut();
    router.replace('/admin/login');
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/admin/dashboard" className="flex flex-col leading-none">
          <span className="font-serif text-xl text-ink">Joana Mirelly</span>
          <span className="mt-1 text-[9px] uppercase tracking-signature text-ink-muted">
            Painel
          </span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-2 text-sm transition ${
                  active ? 'bg-stone-100 text-ink' : 'text-ink-soft hover:text-ink'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={signOut}
            disabled={signingOut}
            className="ml-1 rounded-md px-3 py-2 text-sm text-ink-muted transition hover:text-red-600 disabled:opacity-50"
          >
            {signingOut ? 'Saindo…' : 'Sair'}
          </button>
        </nav>
      </div>
    </header>
  );
}

