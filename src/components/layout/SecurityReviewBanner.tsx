import React, { useState } from 'react';
import { ShieldAlert, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

export const SecurityReviewBanner = () => {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) {
    return (
      <button
        onClick={() => setDismissed(false)}
        className="fixed top-4 right-4 z-[100] bg-amber-500 hover:bg-amber-400 text-black rounded-full p-2 shadow-lg transition-all"
        title="Modo Security Review ativo"
      >
        <ShieldAlert className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-black shadow-lg shrink-0">
      <div className="flex items-center justify-between px-6 py-3 max-w-[1600px] mx-auto">
        <div className="flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <div className="flex items-center gap-2">
            <span className="font-black text-sm uppercase tracking-wider">
              Modo Security Review Ativo
            </span>
            <span className="text-sm font-semibold opacity-90">
              — Não expira automaticamente
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              toast('Para sair do modo Security Review, troque o seletor no topo do chat para Default/Build.', {
                duration: 10000,
                icon: <ArrowRight className="w-4 h-4" />,
              });
            }}
            className="bg-black/20 hover:bg-black/30 text-black font-black text-xs uppercase tracking-wider px-4 py-2 rounded-lg transition-all flex items-center gap-2"
          >
            Sair do Modo Security Review
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="bg-black/20 hover:bg-black/30 text-black font-black text-xs uppercase tracking-wider px-3 py-2 rounded-lg transition-all"
            title="Minimizar"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
};
