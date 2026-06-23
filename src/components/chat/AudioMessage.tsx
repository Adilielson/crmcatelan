import { useEffect, useRef, useState } from 'react';

/**
 * Player de áudio para mensagens do WhatsApp.
 *
 * Áudios de PTT do WhatsApp são OGG/Opus. Quando o <audio> nativo carrega
 * via HTTP usando Range Requests (comportamento padrão de streaming), o
 * decoder do navegador frequentemente "estala" porque os blocos retornados
 * pelo Supabase Storage não se alinham com os frames Opus.
 *
 * Solução: baixar o arquivo inteiro uma única vez via fetch e tocar a partir
 * de um Blob URL local. Sem Range Requests = sem estalos.
 */
export function AudioMessage({ src, mime }: { src: string; mime?: string | null }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const currentSrcRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;

    // Se o src não mudou desde a última carga bem-sucedida, mantém o blob atual
    // (evita refazer o download em cada re-render do chat).
    if (currentSrcRef.current === src && blobUrl) return;

    setError(false);
    fetch(src)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = await res.arrayBuffer();
        if (cancelled) return;
        const type = mime || res.headers.get('content-type') || 'audio/ogg';
        const blob = new Blob([buf], { type });
        createdUrl = URL.createObjectURL(blob);
        currentSrcRef.current = src;
        setBlobUrl(createdUrl);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, mime]);

  if (error) {
    // Fallback para o player nativo (com risco de estalo) se o fetch falhou.
    return <audio controls src={src} preload="metadata" className="w-64 max-w-full" />;
  }

  if (!blobUrl) {
    return (
      <div className="w-64 h-10 max-w-full flex items-center justify-center text-xs text-gray-500 bg-gray-50 rounded-full">
        Carregando áudio...
      </div>
    );
  }

  return <audio controls src={blobUrl} preload="auto" className="w-64 max-w-full" />;
}
