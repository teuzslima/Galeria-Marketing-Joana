'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { GalleryStatus } from '@/lib/types';

export interface GalleryStatusToggleProps {
  galleryId: string;
  status?: GalleryStatus;
  initialStatus?: GalleryStatus;
}

export default function GalleryStatusToggle({
  galleryId,
  status: statusProp,
  initialStatus,
}: GalleryStatusToggleProps) {
  const [status, setStatus] = useState<GalleryStatus>(statusProp || initialStatus || 'draft');
  const [loading, setLoading] = useState(false);

  const toggleStatus = async () => {
    if (loading) return;
    setLoading(true);

    const nextStatus: GalleryStatus = status === 'published' ? 'draft' : 'published';
    const supabase = createClient();

    const { error } = await supabase
      .from('galleries')
      .update({ status: nextStatus })
      .eq('id', galleryId);

    if (error) {
      alert(`Erro ao atualizar status: ${error.message}`);
    } else {
      setStatus(nextStatus);
    }

    setLoading(false);
  };

  return (
    <button
      type="button"
      onClick={toggleStatus}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium tracking-wide transition ${
        status === 'published'
          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
          : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          status === 'published' ? 'bg-emerald-500' : 'bg-amber-500'
        }`}
      />
      {loading ? 'Salvando…' : status === 'published' ? 'Publicada' : 'Rascunho'}
    </button>
  );
}