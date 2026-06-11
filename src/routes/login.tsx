import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('[login] 📨 submit', { email })
    setLoading(true)
    try {
      console.log('[login] ⏳ chamando signInWithPassword...')
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      console.log('[login] 📬 resposta signInWithPassword', {
        hasUser: !!data?.user,
        userId: data?.user?.id ?? null,
        hasSession: !!data?.session,
        error: error?.message ?? null,
        errorStatus: (error as { status?: number } | null)?.status ?? null,
      })
      if (error) throw error
      console.log('[login] ✅ login OK → navigate("/")')
      navigate({ to: '/' })
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Erro ao fazer login'
      console.error('[login] ❌ erro', error)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0E0E11] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-[#17171B] border border-[#23232B] rounded-[24px] p-10 shadow-2xl">
          <div className="flex items-center gap-3 mb-10">
            <div className="p-2 bg-[#FFC400]/10 rounded-xl">
              <svg className="w-8 h-4 text-[#FFC400]" viewBox="0 0 60 28">
                <path d="M3 8 Q3 4 8 4 L24 4 Q28 4 28 9 L28 16 Q28 23 19 23 L11 23 Q3 23 3 14 Z M32 8 Q32 4 37 4 L53 4 Q57 4 57 9 L57 14 Q57 23 49 23 L41 23 Q32 23 32 16 Z M28 9 L32 9" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <h1 className="text-white font-black text-lg uppercase tracking-tight">Ótica Catelan</h1>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">CRM Plataforma</p>
            </div>
          </div>

          <h2 className="text-2xl font-black text-white mb-2">Entrar</h2>
          <p className="text-slate-500 text-sm mb-8">Acesse sua conta para continuar.</p>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-400 text-xs font-black uppercase tracking-widest">
                E-mail
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className="bg-[#0E0E11] border-[#23232B] text-white h-12 rounded-[12px] focus:border-[#FFC400] placeholder:text-slate-600"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-400 text-xs font-black uppercase tracking-widest">
                Senha
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="bg-[#0E0E11] border-[#23232B] text-white h-12 rounded-[12px] focus:border-[#FFC400] placeholder:text-slate-600"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-[#FFC400] hover:bg-[#FFD60A] text-[#1a1500] font-black text-sm uppercase tracking-widest rounded-[12px] shadow-lg shadow-[#FFC400]/20 mt-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'ENTRAR'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
