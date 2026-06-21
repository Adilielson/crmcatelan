import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getInsightsDashboard } from '@/lib/ai-insights.functions';
import { getReferenceStyleProfile, rebuildReferenceStyleProfile } from '@/lib/ai-style.functions';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Brain, TrendingUp, MessageSquare, AlertTriangle, Sparkles, Smile, Meh, Frown, Star, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const Route = createFileRoute('/ai-insights')({
  component: AiInsightsPage,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="p-6">
        <Card className="p-6 bg-red-50 border-red-200">
          <h2 className="text-lg font-semibold text-red-900 mb-2">Erro ao carregar insights</h2>
          <p className="text-sm text-red-700 mb-4">{error.message}</p>
          <button
            onClick={() => { reset(); router.invalidate(); }}
            className="px-4 py-2 bg-red-600 text-white rounded-md text-sm"
          >
            Tentar novamente
          </button>
        </Card>
      </div>
    );
  },
  notFoundComponent: () => <div className="p-6">Página não encontrada.</div>,
});

function AiInsightsPage() {
  const fetchFn = useServerFn(getInsightsDashboard);
  const { data, isLoading } = useQuery({
    queryKey: ['ai-insights-dashboard'],
    queryFn: () => fetchFn(),
    staleTime: 60_000,
  });

  if (isLoading) {
    return <div className="p-6 text-slate-500">Carregando inteligência de atendimento…</div>;
  }
  if (!data) return <div className="p-6 text-slate-500">Sem dados ainda.</div>;

  const sentiment = data.sentimentBreakdown || {};
  const pos = sentiment.positive || 0;
  const neu = sentiment.neutral || 0;
  const neg = sentiment.negative || 0;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <header className="flex items-start gap-3">
        <div className="p-2 bg-violet-100 rounded-lg">
          <Brain className="w-6 h-6 text-violet-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inteligência de Atendimento</h1>
          <p className="text-sm text-slate-500">
            A IA observa as conversas manuais e extrai aprendizado para a equipe.
          </p>
        </div>
      </header>

      <ReferenceStyleCard />


      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-xs text-slate-500">Conversas analisadas</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{data.totalAnalyzed}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-slate-500"><Smile className="w-3.5 h-3.5 text-emerald-600" /> Positivas</div>
          <div className="text-2xl font-bold text-emerald-700 mt-1">{pos}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-slate-500"><Meh className="w-3.5 h-3.5 text-amber-600" /> Neutras</div>
          <div className="text-2xl font-bold text-amber-700 mt-1">{neu}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-slate-500"><Frown className="w-3.5 h-3.5 text-rose-600" /> Negativas</div>
          <div className="text-2xl font-bold text-rose-700 mt-1">{neg}</div>
        </Card>
      </div>

      {/* Top perguntas / objeções */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4">
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-3">
            <MessageSquare className="w-4 h-4 text-blue-600" /> Perguntas mais frequentes
          </h2>
          {data.topQuestions.length === 0 ? (
            <p className="text-sm text-slate-400">Ainda sem dados.</p>
          ) : (
            <ul className="space-y-2">
              {data.topQuestions.map((q: any) => (
                <li key={q.id} className="flex items-start justify-between gap-3 text-sm">
                  <span className="text-slate-700 flex-1">{q.content}</span>
                  <Badge variant="secondary">{q.occurrences}x</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-600" /> Principais objeções
          </h2>
          {data.topObjections.length === 0 ? (
            <p className="text-sm text-slate-400">Ainda sem dados.</p>
          ) : (
            <ul className="space-y-2">
              {data.topObjections.map((q: any) => (
                <li key={q.id} className="flex items-start justify-between gap-3 text-sm">
                  <span className="text-slate-700 flex-1">{q.content}</span>
                  <Badge variant="secondary">{q.occurrences}x</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Frases vencedoras + palavras-chave */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4">
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-emerald-600" /> Frases que converteram
          </h2>
          {data.winningPhrases.length === 0 ? (
            <p className="text-sm text-slate-400">Ainda sem dados.</p>
          ) : (
            <ul className="space-y-2">
              {data.winningPhrases.slice(0, 8).map((q: any) => (
                <li key={q.id} className="text-sm text-slate-700 border-l-2 border-emerald-300 pl-3 italic">
                  "{q.content}"
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-violet-600" /> Palavras-chave em alta
          </h2>
          {data.topKeywords.length === 0 ? (
            <p className="text-sm text-slate-400">Ainda sem dados.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {data.topKeywords.map((k: any) => (
                <Badge key={k.id} variant="outline" className="text-xs">
                  {k.content} <span className="ml-1 text-slate-400">×{k.occurrences}</span>
                </Badge>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Conversas recentes */}
      <Card className="p-4">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">Análises recentes</h2>
        {data.recentInsights.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhuma conversa analisada ainda. Use o botão "Analisar com IA" no chat.</p>
        ) : (
          <div className="divide-y">
            {data.recentInsights.map((r: any) => (
              <div key={r.id} className="py-3 text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <SentimentBadge sentiment={r.sentiment} />
                  <span className="text-xs text-slate-400">{r.intent || '—'}</span>
                  <span className="text-xs text-slate-400 ml-auto">
                    {new Date(r.created_at).toLocaleString('pt-BR')}
                  </span>
                </div>
                <p className="text-slate-700">{r.summary || '(sem resumo)'}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function SentimentBadge({ sentiment }: { sentiment: string | null }) {
  const map: Record<string, { label: string; cls: string }> = {
    positive: { label: 'Positivo', cls: 'bg-emerald-100 text-emerald-700' },
    neutral: { label: 'Neutro', cls: 'bg-amber-100 text-amber-700' },
    negative: { label: 'Negativo', cls: 'bg-rose-100 text-rose-700' },
  };
  const v = map[sentiment || ''] || { label: sentiment || '—', cls: 'bg-slate-100 text-slate-600' };
  return <span className={`text-xs px-2 py-0.5 rounded-full ${v.cls}`}>{v.label}</span>;
}

function ReferenceStyleCard() {
  const qc = useQueryClient();
  const fetchFn = useServerFn(getReferenceStyleProfile);
  const rebuildFn = useServerFn(rebuildReferenceStyleProfile);
  const { data, isLoading } = useQuery({
    queryKey: ['ai-reference-style'],
    queryFn: () => fetchFn(),
    staleTime: 60_000,
  });
  const rebuild = useMutation({
    mutationFn: () => rebuildFn(),
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ['ai-reference-style'] });
      if (r?.ok) toast.success(`Estilo atualizado (${r.sample_count} mensagens analisadas)`);
      else if (r?.reason === 'no_reference_agents') toast.error('Marque ao menos 1 atendente como "Referência IA" na Equipe');
      else if (r?.reason === 'no_successful_leads') toast.error('Ainda não há leads agendados/fechados pela referência');
      else if (r?.reason === 'not_enough_messages') toast.error(`Apenas ${r.sample_count} mensagens — precisa de mais histórico`);
      else toast.message('Sem mudanças');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao reconstruir'),
  });

  if (isLoading) {
    return (
      <Card className="p-4">
        <p className="text-sm text-slate-500">Carregando estilo da referência…</p>
      </Card>
    );
  }

  const profile = data?.profile;
  const refs = data?.reference_agents ?? [];
  const guide = (profile?.style_guide ?? {}) as any;

  return (
    <Card className="p-5 bg-gradient-to-br from-violet-50 to-white border-violet-200">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-violet-200 rounded-lg">
            <Star className="w-5 h-5 text-violet-700 fill-violet-700" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-violet-900">Estilo da atendente referência</h2>
            <p className="text-xs text-violet-700/80">
              A IA SDR vai imitar este estilo em todas as respostas.
              {refs.length > 0 && ` Baseado em: ${refs.map((r: any) => r.full_name).filter(Boolean).join(', ')}.`}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => rebuild.mutate()}
          disabled={rebuild.isPending}
          className="border-violet-300 text-violet-800 hover:bg-violet-100"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${rebuild.isPending ? 'animate-spin' : ''}`} />
          Recalcular
        </Button>
      </div>

      {refs.length === 0 ? (
        <p className="text-sm text-slate-600 bg-amber-50 border border-amber-200 rounded-md p-3">
          Nenhum atendente marcado como referência. Vá em <strong>Equipe</strong> e ative
          "Referência IA" no card da Raiana (ou de outra pessoa).
        </p>
      ) : !profile?.style_prompt ? (
        <p className="text-sm text-slate-600 bg-slate-50 rounded-md p-3">
          Ainda não calculei o estilo. Clique em <strong>Recalcular</strong>.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="text-sm text-slate-700 whitespace-pre-line border-l-2 border-violet-300 pl-3">
            {profile.style_prompt}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <Metric label="Mensagens" value={String(profile.sample_count ?? 0)} />
            <Metric label="Tam. médio" value={`${guide.avg_msg_length ?? 0} car.`} />
            <Metric label="Com pergunta" value={`${guide.pct_with_question ?? 0}%`} />
            <Metric label="Com emoji" value={`${guide.pct_with_emoji ?? 0}%`} />
          </div>
          {profile.last_built_at && (
            <p className="text-[11px] text-slate-400">
              Atualizado {formatDistanceToNow(new Date(profile.last_built_at), { addSuffix: true, locale: ptBR })}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-md border border-violet-100 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-sm font-bold text-violet-900">{value}</div>
    </div>
  );
}
