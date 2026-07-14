import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/integrations/supabase/types'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

type AiConfig = {
  prompt_system?: string | null
  knowledge_base_faq?: string | null
  sample_scripts?: string | null
  qualification_questions?: string[] | null
  scheduling_link?: string | null
  goal?: string | null
  model_temperature?: number | string | null
  rejection_instructions?: string | null
  response_restrictions?: string[] | null
  ophthalmologist_saturdays?: string[] | null
}

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init)
}

function getSupabaseRuntimeConfig() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error('Configuração do Supabase ausente no servidor.')
  }

  return { url, key }
}

function createAuthedSupabase(token: string) {
  const { url, key } = getSupabaseRuntimeConfig()

  return createClient<Database>(url, key, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

function validateMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) {
    throw new Error('messages obrigatório')
  }

  const messages = value
    .map((item) => {
      const msg = item as Partial<ChatMessage>
      const role = msg.role
      const content = typeof msg.content === 'string' ? msg.content.trim() : ''

      if ((role !== 'user' && role !== 'assistant') || !content) return null

      return {
        role,
        content: content.slice(0, 2000),
      }
    })
    .filter(Boolean) as ChatMessage[]

  if (messages.length === 0) {
    throw new Error('Envie pelo menos uma mensagem.')
  }

  return messages.slice(-20)
}

function formatUpcomingSaturdays(_cfg: AiConfig): string {
  return 'TIPO DE EXAME DISPONÍVEL: apenas Optometrista (segunda a domingo a partir das 14h, conforme grade cadastrada). NÃO ofereça exame de Oftalmologia — foi descontinuado. NUNCA cite valor/preço do exame sem o cliente perguntar primeiro.'
}


function buildStyleBlock(styleProfile: any): string {
  if (!styleProfile?.style_prompt) return ''

  const guide = (styleProfile.style_guide ?? {}) as Record<string, any>
  const lines: string[] = []

  lines.push('=== ESTILO DE ATENDIMENTO DA REFERÊNCIA (siga rigorosamente) ===')
  lines.push(String(styleProfile.style_prompt))
  lines.push('')
  lines.push('Métricas a respeitar:')
  if (guide.avg_msg_length) {
    lines.push(`- Mensagens curtas: alvo ~${guide.avg_msg_length} caracteres (no máx 1.5x isso).`)
  }
  lines.push('- No máximo 1 pergunta por mensagem.')
  lines.push(
    guide.pct_with_emoji && guide.pct_with_emoji >= 30
      ? '- Emoji ocasional (1 no máximo, e só quando combinar com o tom).'
      : '- Sem emojis.',
  )
  if (guide.pct_uses_client_name && guide.pct_uses_client_name >= 30) {
    lines.push('- Use o primeiro nome do cliente quando souber.')
  }
  lines.push('- Não soe como bot: nada de frases prontas, listas numeradas, ou tom corporativo.')

  return lines.join('\n')
}

function buildSystemPrompt(cfg: AiConfig, knowledgeDocs: string[], styleBlock = ''): string {
  const parts: string[] = [cfg.prompt_system || 'Você é um atendente da Ótica Catelan.']

  if (styleBlock) parts.push(styleBlock)
  if (cfg.goal) {
    parts.push(
      `Objetivo principal da conversa: ${
        cfg.goal === 'appointment'
          ? 'agendar uma consulta'
          : cfg.goal === 'qualification'
            ? 'qualificar o lead'
            : 'dar suporte'
      }.`,
    )
  }
  if (cfg.scheduling_link) {
    parts.push(`Link de agendamento (use quando o lead pedir): ${cfg.scheduling_link}`)
  }

  parts.push(formatUpcomingSaturdays(cfg))

  if (cfg.knowledge_base_faq?.trim()) {
    parts.push(`BASE DE CONHECIMENTO (FAQ):\n${cfg.knowledge_base_faq}`)
  }
  if (knowledgeDocs.length) {
    parts.push(`DOCUMENTOS DE REFERÊNCIA:\n${knowledgeDocs.join('\n---\n').slice(0, 8000)}`)
  }
  if (cfg.sample_scripts?.trim()) {
    parts.push(`EXEMPLOS DE ATENDIMENTO (mimetize o estilo):\n${cfg.sample_scripts}`)
  }
  if (Array.isArray(cfg.qualification_questions) && cfg.qualification_questions.length) {
    parts.push(
      `PERGUNTAS DE QUALIFICAÇÃO (faça uma por vez, na ordem):\n${cfg.qualification_questions
        .map((q, i) => `${i + 1}. ${q}`)
        .join('\n')}`,
    )
  }
  if (cfg.rejection_instructions?.trim()) {
    parts.push(`O QUE NÃO FAZER:\n${cfg.rejection_instructions}`)
  }
  if (Array.isArray(cfg.response_restrictions) && cfg.response_restrictions.length) {
    parts.push(`Restrições: ${cfg.response_restrictions.join(', ')}`)
  }

  return parts.join('\n\n')
}

export const Route = createFileRoute('/api/ai-training/simulate-chat')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const authHeader = request.headers.get('authorization') ?? ''
          if (!authHeader.startsWith('Bearer ')) {
            return json({ error: 'Sessão não enviada. Faça login novamente.' }, { status: 401 })
          }

          const token = authHeader.replace('Bearer ', '').trim()
          const supabase = createAuthedSupabase(token)

          const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token)
          const userId = claimsData?.claims?.sub
          if (claimsError || !userId) {
            return json({ error: 'Sessão inválida. Faça login novamente.' }, { status: 401 })
          }

          const body = await request.json().catch(() => null)
          const messages = validateMessages((body as { messages?: unknown } | null)?.messages)

          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('tenant_id')
            .eq('id', userId)
            .maybeSingle()

          if (profileError) throw new Error(profileError.message)
          if (!profile?.tenant_id) {
            return json({ error: 'Tenant não encontrado para o usuário.' }, { status: 403 })
          }

          const tenantId = profile.tenant_id as string

          const { data: cfg, error: cfgError } = await supabase
            .from('ai_configs')
            .select('*')
            .eq('tenant_id', tenantId)
            .maybeSingle()

          if (cfgError) throw new Error(cfgError.message)
          if (!cfg) {
            return json({ error: 'Configuração de IA não encontrada.' }, { status: 404 })
          }

          const { data: docs } = await supabase
            .from('ai_knowledge_documents')
            .select('name, content')
            .eq('tenant_id', tenantId)
            .eq('status', 'ready')

          const knowledgeTexts = (docs ?? [])
            .filter((d: any) => d.content?.trim())
            .map((d: any) => `[${d.name}]\n${String(d.content).slice(0, 3000)}`)

          let styleBlock = ''
          const { data: styleProfile } = await supabase
            .from('ai_reference_style_profiles')
            .select('style_prompt, style_guide, sample_count')
            .eq('tenant_id', tenantId)
            .maybeSingle()
          styleBlock = buildStyleBlock(styleProfile)

          const systemPrompt = buildSystemPrompt(cfg as AiConfig, knowledgeTexts, styleBlock)
          const { getTenantAiKey, logAiUsage } = await import('@/lib/ai-credentials.server')

          // Prioridade: OpenAI (chave do tenant ou master OPENAI_API_KEY).
          // Fallback automático para Lovable AI Gateway se OpenAI retornar 401/403/429.
          const lovableKey = process.env.LOVABLE_API_KEY

          async function callOpenAI() {
            const credentials = await getTenantAiKey(tenantId, 'openai')
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${credentials.apiKey}`,
              },
              body: JSON.stringify({
                model: credentials.model || 'gpt-4o-mini',
                messages: [{ role: 'system', content: systemPrompt }, ...messages],
                temperature: Number((cfg as any).model_temperature) || 0.7,
              }),
            })
            return { res, model: credentials.model || 'gpt-4o-mini', source: credentials.source, provider: 'openai' as const }
          }

          async function callLovableGateway() {
            const model = 'google/gemini-3-flash-preview'
            const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${lovableKey}`,
              },
              body: JSON.stringify({
                model,
                messages: [{ role: 'system', content: systemPrompt }, ...messages],
                temperature: Number((cfg as any).model_temperature) || 0.7,
              }),
            })
            return { res, model, source: 'master' as const, provider: 'lovable-gateway' as const }
          }

          let attempt: { res: Response; model: string; source: 'tenant' | 'master'; provider: 'openai' | 'lovable-gateway' }
          let usedFallback = false

          try {
            attempt = await callOpenAI()
          } catch (openaiErr: any) {
            console.warn('[ai-training/simulate-chat] OpenAI lançou exceção, tentando Lovable Gateway:', openaiErr?.message)
            if (!lovableKey) throw openaiErr
            attempt = await callLovableGateway()
            usedFallback = true
          }

          // Se OpenAI respondeu com qualquer erro e temos Lovable Gateway, cai no fallback silenciosamente
          if (!attempt.res.ok && !usedFallback && lovableKey) {
            const failText = await attempt.res.text().catch(() => '')
            console.warn('[ai-training/simulate-chat] OpenAI falhou, usando Lovable Gateway como fallback:', attempt.res.status, failText.slice(0, 200))
            attempt = await callLovableGateway()
            usedFallback = true
          }

          if (!attempt.res.ok) {
            const text = await attempt.res.text()
            console.error('[ai-training/simulate-chat] AI error', attempt.provider, attempt.res.status, text.slice(0, 400))
            if (attempt.res.status === 429) {
              return json({ error: 'Limite de requisições atingido. Tente novamente em alguns segundos.' }, { status: 429 })
            }
            if (attempt.res.status === 402) {
              return json({ error: 'Créditos de IA esgotados.' }, { status: 402 })
            }
            if (attempt.res.status === 401) {
              return json({ error: 'Chave da IA inválida ou expirada.' }, { status: 502 })
            }
            throw new Error(`AI ${attempt.res.status}: ${text.slice(0, 200)}`)
          }

          const aiJson = await attempt.res.json()
          const reply = aiJson?.choices?.[0]?.message?.content
          if (typeof reply !== 'string' || !reply.trim()) {
            throw new Error('Sem resposta do modelo')
          }

          const usage = aiJson?.usage ?? {}
          await logAiUsage({
            tenantId,
            provider: 'openai',
            model: attempt.model,
            tokensInput: Number(usage.prompt_tokens || 0),
            tokensOutput: Number(usage.completion_tokens || 0),
            usedFallback: usedFallback || attempt.source === 'master',
            source: attempt.source,
            feature: usedFallback ? 'ai-training-simulation:fallback-gateway' : 'ai-training-simulation',
          })



          return json({ reply: reply.trim() })
        } catch (error) {
          console.error('[ai-training/simulate-chat]', error)
          return json(
            { error: error instanceof Error ? error.message : 'Erro interno na simulação.' },
            { status: 500 },
          )
        }
      },
    },
  },
})