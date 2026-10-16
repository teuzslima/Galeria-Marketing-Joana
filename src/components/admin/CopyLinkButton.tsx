'use client';

import { useState } from 'react';

export default function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const input = document.createElement('textarea');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="shrink-0 rounded border border-stone-200 px-2 py-0.5 text-[11px] text-ink-soft transition hover:border-stone-400 hover:text-ink"
    >
      {copied ? 'Copiado ✓' : 'Copiar'}
    </button>
  );
}

