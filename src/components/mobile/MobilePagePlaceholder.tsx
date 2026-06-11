import type { LucideIcon } from 'lucide-react'

interface Props {
  title: string
  subtitle?: string
  icon: LucideIcon
  hint?: string
}

export function MobilePagePlaceholder({ title, subtitle, icon: Icon, hint }: Props) {
  return (
    <div className="flex flex-col h-full">
      <header className="bg-[#0E0E11] text-white px-5 pt-6 pb-5">
        <p className="text-[11px] uppercase tracking-widest text-[#FFC400] font-bold">Mobile</p>
        <h1 className="text-2xl font-black mt-1">{title}</h1>
        {subtitle && <p className="text-sm text-slate-300 mt-1">{subtitle}</p>}
      </header>

      <div className="flex-1 grid place-items-center p-8">
        <div className="text-center max-w-xs">
          <div className="h-16 w-16 rounded-2xl bg-[#FFC400]/15 grid place-items-center mx-auto mb-4">
            <Icon className="h-8 w-8 text-[#FFC400]" />
          </div>
          <p className="text-slate-600 text-sm">
            {hint ?? 'Esta tela ainda está em construção.'}
          </p>
        </div>
      </div>
    </div>
  )
}
