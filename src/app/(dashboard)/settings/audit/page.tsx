import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Shield, User, Clock, Tag } from 'lucide-react'
import Link from 'next/link'

const ACTION_LABEL: Record<string, { label: string; color: string }> = {
 create: { label: 'Создание', color: 'text-emerald-600 bg-emerald-50' },
 update: { label: 'Изменение', color: 'text-blue-600 bg-blue-50' },
 delete: { label: 'Удаление', color: 'text-red-600 bg-red-50' },
}

const ENTITY_LABEL: Record<string, string> = {
 contact: 'Контакт',
 lead: 'Лид',
 deal: 'Сделка',
 property: 'Объект',
 contract: 'Договор',
 payment: 'Платёж',
 task: 'Задача',
}

export default async function AuditLogPage() {
 const supabase = await createClient()
 const { data: { user } } = await supabase.auth.getUser()
 if (!user) redirect('/login')

 // Only admins
 const { data: profile } = await supabase
 .from('users').select('role').eq('id', user.id).single()

 if (profile?.role !== 'admin') {
 redirect('/settings')
 }

 const { data: logs } = await supabase
 .from('audit_logs')
 .select(`id, action, entity_type, entity_id, entity_label, changes, created_at,
 author:users!audit_logs_user_id_fkey(full_name, email)`)
 .order('created_at', { ascending: false })
 .limit(200)

 return (
 <div className="max-w-5xl mx-auto space-y-6">
 {/* Header */}
 <div className="flex items-center gap-3">
 <Link href="/settings" className="text-muted-foreground hover:text-foreground text-sm">
 Настройки
 </Link>
 <span className="text-muted-foreground">/</span>
 <span className="text-sm font-medium">Журнал аудита</span>
 </div>

 <div className="flex items-center gap-3">
 <div className="w-10 h-10 bg-primary/10 flex items-center justify-center">
 <Shield className="w-5 h-5 text-primary" />
 </div>
 <div>
 <h1 className="text-xl font-bold">Журнал аудита</h1>
 <p className="text-sm text-muted-foreground">История всех изменений в системе</p>
 </div>
 </div>

 {/* Table */}
 <div className="hp-card overflow-hidden">
 {!logs || logs.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
 <Shield className="w-10 h-10 mb-3 opacity-30" />
 <p className="text-sm">Записей пока нет</p>
 </div>
 ) : (
 <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <thead>
 <tr className="border-b bg-[var(--hp-neutral-tint)] text-xs text-muted-foreground uppercase tracking-wide">
 <th className="text-left px-4 py-3 font-medium">Время</th>
 <th className="text-left px-4 py-3 font-medium">Действие</th>
 <th className="text-left px-4 py-3 font-medium">Объект</th>
 <th className="text-left px-4 py-3 font-medium">Сущность</th>
 <th className="text-left px-4 py-3 font-medium">Пользователь</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-[var(--hp-border-soft)]">
 {(logs as unknown as Array<{
 id: string
 action: string
 entity_type: string
 entity_id: string | null
 entity_label: string | null
 changes: Record<string, unknown> | null
 created_at: string
 author: { full_name: string; email: string } | null
 }>).map((log) => {
 const actionMeta = ACTION_LABEL[log.action] ?? { label: log.action, color: 'text-gray-600 bg-gray-50' }
 return (
 <tr key={log.id} className="hover:bg-[var(--hp-neutral-tint)]/50 transition-colors">
 <td className="px-4 py-3 whitespace-nowrap">
 <div className="flex items-center gap-1.5 text-muted-foreground">
 <Clock className="w-3.5 h-3.5" />
 {new Date(log.created_at).toLocaleString('ru-RU', {
 day: '2-digit', month: '2-digit', year: '2-digit',
 hour: '2-digit', minute: '2-digit',
 })}
 </div>
 </td>
 <td className="px-4 py-3">
 <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-[var(--hp-radius-badge)] ${actionMeta.color}`}>
 {actionMeta.label}
 </span>
 </td>
 <td className="px-4 py-3">
 <div className="flex items-center gap-1.5">
 <Tag className="w-3.5 h-3.5 text-muted-foreground" />
 <span className="text-muted-foreground text-xs">
 {ENTITY_LABEL[log.entity_type] ?? log.entity_type}
 </span>
 </div>
 </td>
 <td className="px-4 py-3 font-medium max-w-[200px] truncate">
 {log.entity_label ?? '—'}
 </td>
 <td className="px-4 py-3">
 <div className="flex items-center gap-1.5 text-muted-foreground">
 <User className="w-3.5 h-3.5" />
 <span className="text-xs">{log.author?.full_name ?? log.author?.email ?? '—'}</span>
 </div>
 </td>
 </tr>
 )
 })}
 </tbody>
 </table>
 </div>
 )}
 </div>

 <p className="text-xs text-muted-foreground text-center">
 Показаны последние 200 записей
 </p>
 </div>
 )
}
