import { createClient } from '@/lib/supabase/server'
import { Search, User, Home, TrendingUp, FileText, CheckSquare } from 'lucide-react'
import Link from 'next/link'
import { CONTRACT_TYPE_LABELS } from '@/features/contracts/config/contract-types'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/layout/EmptyState'
import { formatDate, likeFilterValue } from '@/lib/utils'
import { DEAL_TYPE_LABELS as dealTypeLabels } from '@/features/deals/config/deal-stages'

export default async function SearchPage({
 searchParams,
}: {
 searchParams: Promise<{ q?: string }>
}) {
 const { q } = await searchParams
 const query = q?.trim() ?? ''

 if (!query) {
 return (
 <div className="max-w-3xl mx-auto space-y-6">
 <PageHeader title="Поиск" />
 <EmptyState
 icon={<Search className="w-5 h-5 text-[var(--hp-sub)]" />}
 title="Что ищем?"
 description="Введите имя или телефон контакта, адрес объекта, номер договора, задачу или номер сделки (СД-12) в строку поиска сверху."
 />
 </div>
 )
 }

 const supabase = await createClient()
 const like = likeFilterValue(query)
 const dealNumberMatch = query.match(/^(?:сд|sd)?[-\s]*(\d+)$/i)
 const dealNumber = dealNumberMatch ? Number(dealNumberMatch[1]) : null

 const [
 { data: contacts },
 { data: properties },
 { data: deals },
 { data: contracts },
 { data: tasks },
 ] = await Promise.all([
 supabase.from('contacts').select('id, full_name, phone, role').or(`full_name.ilike.${like},phone.ilike.${like}`).limit(5),
 supabase.from('properties').select('id, title, address').or(`title.ilike.${like},address.ilike.${like}`).limit(5),
 // Сделки ищутся по номеру: «СД-12», «12». Текстового поля у сделки нет,
 // а раньше блок вообще не фильтровался и в любую выдачу попадали три
 // случайные сделки.
 dealNumber !== null
 ? supabase.from('deals').select('id, deal_type, status, amount, created_at, deal_number').eq('deal_number', dealNumber).limit(3)
 : Promise.resolve({ data: [] as { id: string; deal_type: string; status: string; amount: number | null; created_at: string | null; deal_number: number | null }[] }),
 supabase.from('contracts').select('id, contract_number, contract_type, status').or(`contract_number.ilike.${like}`).limit(5),
 supabase.from('tasks').select('id, title, status, priority').ilike('title', `%${query}%`).limit(5),
 ])

 const total = (contacts?.length ?? 0) + (properties?.length ?? 0) + (deals?.length ?? 0) + (contracts?.length ?? 0) + (tasks?.length ?? 0)

 const roleLabels: Record<string, string> = { client: 'Клиент', owner: 'Собственник', both: 'Кл. + Собств.' }

 return (
 <div className="max-w-3xl mx-auto space-y-6">
 <div className="flex items-center gap-3">
 <Search className="w-5 h-5 text-[var(--hp-sub)]" />
 <h1 className="hp-h1">
 Результаты: <span className="text-[var(--hp-accent)]">{query}</span>
 </h1>
 <span className="text-[var(--hp-sub)] text-sm">({total} совпадений)</span>
 </div>

 {total === 0 ? (
 <EmptyState
 title={`Ничего не найдено по запросу «${query}»`}
 description="Поиск ищет по имени и телефону контакта, адресу объекта, номеру договора и названию задачи. Сделки — по номеру СД-…"
 />
 ) : (
 <div className="space-y-4">

 {/* Контакты */}
 {(contacts?.length ?? 0) > 0 && (
 <div className="hp-card overflow-hidden">
 <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-muted/20">
 <User className="w-4 h-4 text-[var(--hp-info)]" />
 <span className="font-semibold text-sm text-foreground">Контакты</span>
 <span className="text-xs text-muted-foreground">({contacts!.length})</span>
 </div>
 <div className="divide-y divide-border">
 {contacts!.map(c => (
 <Link key={c.id} href={`/contacts/${c.id}`}
 className="flex items-center justify-between px-5 py-3 hover:bg-accent/40 transition">
 <div>
 <p className="text-sm font-medium text-foreground">{c.full_name}</p>
 {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
 </div>
 <span className="text-xs text-muted-foreground">{roleLabels[c.role] ?? c.role}</span>
 </Link>
 ))}
 </div>
 </div>
 )}

 {/* Объекты */}
 {(properties?.length ?? 0) > 0 && (
 <div className="hp-card overflow-hidden">
 <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-muted/20">
 <Home className="w-4 h-4 text-[var(--hp-good)]" />
 <span className="font-semibold text-sm text-foreground">Объекты</span>
 <span className="text-xs text-muted-foreground">({properties!.length})</span>
 </div>
 <div className="divide-y divide-border">
 {properties!.map(p => (
 <Link key={p.id} href={`/properties/${p.id}`}
 className="flex items-center justify-between px-5 py-3 hover:bg-accent/40 transition">
 <div>
 <p className="text-sm font-medium text-foreground">{p.title}</p>
 {p.address && <p className="text-xs text-muted-foreground">{p.address}</p>}
 </div>
 </Link>
 ))}
 </div>
 </div>
 )}

 {/* Договоры */}
 {(contracts?.length ?? 0) > 0 && (
 <div className="hp-card overflow-hidden">
 <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-muted/20">
 <FileText className="w-4 h-4 text-[var(--hp-sub)]" />
 <span className="font-semibold text-sm text-foreground">Договоры</span>
 <span className="text-xs text-muted-foreground">({contracts!.length})</span>
 </div>
 <div className="divide-y divide-border">
 {contracts!.map(c => (
 <Link key={c.id} href={`/contracts/${c.id}`}
 className="flex items-center justify-between px-5 py-3 hover:bg-accent/40 transition">
 <p className="text-sm font-medium text-foreground">
 {c.contract_number ?? `#${c.id.slice(0, 8)}`}
 </p>
 <span className="text-xs text-muted-foreground">{CONTRACT_TYPE_LABELS[c.contract_type] ?? c.contract_type}</span>
 </Link>
 ))}
 </div>
 </div>
 )}

 {/* Задачи */}
 {(tasks?.length ?? 0) > 0 && (
 <div className="hp-card overflow-hidden">
 <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-muted/20">
 <CheckSquare className="w-4 h-4 text-[var(--hp-warn)]" />
 <span className="font-semibold text-sm text-foreground">Задачи</span>
 <span className="text-xs text-muted-foreground">({tasks!.length})</span>
 </div>
 <div className="divide-y divide-border">
 {tasks!.map(t => (
 <Link key={t.id} href={`/tasks/${t.id}`}
 className="flex items-center justify-between px-5 py-3 hover:bg-accent/40 transition">
 <p className="text-sm font-medium text-foreground">{t.title}</p>
 <span className="text-xs text-muted-foreground">{t.status}</span>
 </Link>
 ))}
 </div>
 </div>
 )}

 {/* Сделки */}
 {(deals?.length ?? 0) > 0 && (
 <div className="hp-card overflow-hidden">
 <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-muted/20">
 <TrendingUp className="w-4 h-4 text-[var(--hp-good)]" />
 <span className="font-semibold text-sm text-foreground">Сделки</span>
 <span className="text-xs text-muted-foreground">({deals!.length})</span>
 </div>
 <div className="divide-y divide-border">
 {deals!.map(d => (
 <Link key={d.id} href={`/deals/${d.id}`}
 className="flex items-center justify-between px-5 py-3 hover:bg-accent/40 transition">
 <p className="text-sm font-medium text-foreground">
 {d.deal_number ? `СД-${d.deal_number} · ` : ''}{dealTypeLabels[d.deal_type] ?? d.deal_type} · {formatDate(d.created_at)}
 </p>
 {d.amount && (
 <span className="text-sm font-semibold text-foreground">{Number(d.amount).toLocaleString('ru-RU')} ₽</span>
 )}
 </Link>
 ))}
 </div>
 </div>
 )}
 </div>
 )}
 </div>
 )
}
