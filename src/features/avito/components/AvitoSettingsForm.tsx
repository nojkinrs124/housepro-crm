'use client'

import { useActionState, useEffect } from 'react'
import { toast } from 'sonner'
import { saveAvitoSettingsAction } from '@/features/avito/actions/avito.actions'

type State = { error?: string; success?: boolean } | null

interface Props {
 clientId: string
 maskedSecret: string
 avitoUserId: string
 contactPhone: string
 isEnabled: boolean
}

export function AvitoSettingsForm({ clientId, maskedSecret, avitoUserId, contactPhone, isEnabled }: Props) {
 const [state, formAction, isPending] = useActionState(saveAvitoSettingsAction, null as State)

 useEffect(() => {
 if (state?.error) toast.error(state.error)
 else if (state?.success) toast.success('Настройки сохранены')
 }, [state])

 return (
 <form action={formAction} className="bg-white border border-slate-100 p-5 space-y-4" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)' }}>
 <h2 className="font-bold text-[#111827] text-[15px]">Учётные данные API Авито</h2>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <div className="space-y-1.5">
 <label className="block text-sm font-semibold text-[#111827]">Client ID</label>
 <input
 type="text" name="client_id" defaultValue={clientId}
 placeholder="Из личного кабинета: Профессионалам → API"
 className="w-full h-10 px-4 border border-input bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
 />
 </div>
 <div className="space-y-1.5">
 <label className="block text-sm font-semibold text-[#111827]">Client Secret</label>
 <input
 type="text" name="client_secret" defaultValue={maskedSecret}
 placeholder="Client Secret"
 className="w-full h-10 px-4 border border-input bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all font-mono"
 />
 <p className="text-xs text-muted-foreground">Оставьте маску без изменений, чтобы не менять сохранённый секрет</p>
 </div>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <div className="space-y-1.5">
 <label className="block text-sm font-semibold text-[#111827]">ID аккаунта Авито</label>
 <input
 type="text" name="avito_user_id" defaultValue={avitoUserId}
 placeholder="313789110"
 className="w-full h-10 px-4 border border-input bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
 />
 </div>
 <div className="space-y-1.5">
 <label className="block text-sm font-semibold text-[#111827]">Контактный телефон в объявлениях</label>
 <input
 type="tel" name="contact_phone" defaultValue={contactPhone}
 placeholder="+7 900 000-00-00"
 className="w-full h-10 px-4 border border-input bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
 />
 </div>
 </div>

 <label className="flex items-center gap-2.5 cursor-pointer w-fit">
 <input type="checkbox" name="is_enabled" defaultChecked={isEnabled} className="w-4 h-4 border-input accent-[#16A34A]" />
 <span className="text-sm font-medium text-[#374151]">Интеграция включена (фид активен)</span>
 </label>

 <div className="flex items-center gap-3 pt-1">
 <button
 type="submit"
 disabled={isPending}
 className="flex items-center gap-2 px-5 py-2.5 text-white text-sm font-bold hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:hover:translate-y-0"
 style={{ background: 'linear-gradient(135deg, #16A34A, #22C55E)', boxShadow: '0 4px 16px rgba(22,163,74,0.35)' }}
 >
 {isPending ? 'Сохранение…' : 'Сохранить'}
 </button>
 </div>
 </form>
 )
}
