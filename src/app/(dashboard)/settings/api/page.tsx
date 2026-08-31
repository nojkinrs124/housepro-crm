import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Key, Code } from 'lucide-react'
import { CreateApiKeyForm } from '@/features/api-keys/components/CreateApiKeyForm'
import { ApiKeyRow } from '@/features/api-keys/components/ApiKeyRow'

export default async function ApiSettingsPage() {
 const supabase = await createClient()
 const { data: { user } } = await supabase.auth.getUser()
 if (!user) redirect('/login')

 const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
 if (profile?.role !== 'admin') redirect('/settings')

 const { data: keys } = await supabase
 .from('api_keys')
 .select('id, name, key_prefix, scopes, is_active, last_used_at, created_at')
 .order('created_at', { ascending: false })

 return (
 <div className="max-w-3xl mx-auto space-y-6">
 <div className="flex items-center gap-3">
 <Link href="/settings" className="text-muted-foreground hover:text-foreground text-sm">Настройки</Link>
 <span className="text-muted-foreground">/</span>
 <span className="text-sm font-medium">API ключи</span>
 </div>

 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-xl font-bold flex items-center gap-2">
 <Key className="w-5 h-5 text-primary" />
 API ключи
 </h1>
 <p className="text-sm text-muted-foreground mt-1">
 Используйте для интеграций с внешними системами
 </p>
 </div>
 <CreateApiKeyForm />
 </div>

 {/* Docs hint */}
 <div className="flex items-start gap-3 p-4 bg-[var(--hp-neutral-tint)] border border-[var(--hp-border-soft)] text-sm">
 <Code className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
 <div className="text-muted-foreground">
 <p className="font-medium text-foreground mb-1">Использование</p>
 <code className="block hp-card p-2 text-xs mt-2">
 curl -H &quot;Authorization: Bearer hp_...&quot; {process.env.NEXT_PUBLIC_SITE_URL ?? ''}/api/v1/contacts
 </code>
 <p className="mt-2">Доступные эндпоинты: /api/v1/contacts, /api/v1/leads, /api/v1/properties, /api/v1/deals</p>
 </div>
 </div>

 {/* Keys list */}
 <div className="space-y-2">
 {(!keys || keys.length === 0) ? (
 <div className="py-12 text-center text-muted-foreground bg-white border border-dashed border-[var(--hp-border)]">
 <Key className="w-8 h-8 mx-auto mb-2 opacity-30" />
 <p className="text-sm">Ключей пока нет</p>
 </div>
 ) : (
 keys.map(k => (
 <ApiKeyRow
 key={k.id}
 id={k.id}
 name={k.name}
 keyPrefix={k.key_prefix}
 scopes={k.scopes ?? []}
 isActive={k.is_active}
 lastUsedAt={k.last_used_at}
 createdAt={k.created_at}
 />
 ))
 )}
 </div>
 </div>
 )
}
