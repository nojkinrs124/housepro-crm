import { createClient } from '@/lib/supabase/server'
import { FileText, Download, Sparkles, CheckCircle2, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { GenerateButton } from './GenerateButton'
import { CONTRACT_TYPE_LABELS } from '@/features/contracts/config/contract-types'
import { PageHeader } from '@/components/layout/PageHeader'

const contractTypeLabels = CONTRACT_TYPE_LABELS

export default async function GenerateContractPage({
 params,
}: {
 params: Promise<{ id: string }>
}) {
 const { id } = await params
 const supabase = await createClient()

 const { data: contract, error: contractError } = await supabase
 .from('contracts')
 .select(`
 *,
 client:clients(full_name, phone, passport),
 property:properties(title, address, area, rooms, floor),
 manager:users(full_name)
 `)
 .eq('id', id)
 .single()

 if (contractError && contractError.code !== 'PGRST116') {
 throw new Error(`Не удалось загрузить договор: ${contractError.message}`)
 }
 if (!contract) notFound()

 const { data: versions } = await supabase
 .from('contract_versions')
 .select('*')
 .eq('contract_id', id)
 .order('version', { ascending: false })

 const client = contract.client as Record<string, string> | null
 const property = contract.property as Record<string, string | number> | null
 const manager = contract.manager as { full_name?: string } | null

 const fields = [
 { label: 'Тип договора', value: contractTypeLabels[contract.contract_type], ok: true },
 { label: 'Клиент', value: client?.full_name, ok: !!client?.full_name },
 { label: 'Телефон', value: client?.phone, ok: !!client?.phone },
 { label: 'Паспорт', value: client?.passport, ok: !!client?.passport, warn: true },
 { label: 'Объект', value: (property?.title as string) || (property?.address as string), ok: !!property },
 { label: 'Адрес', value: property?.address as string, ok: !!property?.address },
 { label: 'Сумма', value: contract.amount ? `${Number(contract.amount).toLocaleString('ru-RU')} ₽` : null, ok: !!contract.amount },
 { label: 'Залог', value: contract.deposit ? `${Number(contract.deposit).toLocaleString('ru-RU')} ₽` : 'Не указан', ok: true },
 { label: 'Дата начала', value: contract.start_date, ok: !!contract.start_date },
 { label: 'Дата окончания', value: contract.end_date, ok: !!contract.end_date },
 { label: 'Менеджер', value: manager?.full_name, ok: !!manager?.full_name },
 ]

 const missingCount = fields.filter(f => !f.ok && !f.warn).length

 return (
 <div className="max-w-3xl mx-auto space-y-6">
 <PageHeader
 title="Генерация договора"
 subtitle={`${contract.contract_number} · ${contractTypeLabels[contract.contract_type]}`}
 backHref={`/contracts/${id}`}
 backLabel="Назад к договору"
 iconBg="bg-violet-100"
 icon={<Sparkles className="w-5 h-5 text-violet-600" />}
 />

 {/* Checklist */}
 <div className="hp-card p-5">
 <h2 className="font-semibold text-foreground mb-4">Проверка данных</h2>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
 {fields.map((field) => (
 <div key={field.label}
 className={`flex items-start gap-2.5 p-3 text-sm ${
 field.ok
 ? 'bg-green-50 border border-green-100'
 : field.warn
 ? 'bg-yellow-50 border border-yellow-100'
 : 'bg-red-50 border border-red-100'
 }`}>
 <div className={`w-4 h-4 rounded-[var(--hp-radius)] flex items-center justify-center shrink-0 mt-0.5 ${
 field.ok ? 'bg-green-500' : field.warn ? 'bg-yellow-400' : 'bg-red-400'
 }`}>
 <CheckCircle2 className="w-3 h-3 text-white" />
 </div>
 <div className="min-w-0">
 <p className="font-medium text-foreground text-xs">{field.label}</p>
 <p className={`text-xs mt-0.5 truncate ${
 field.ok ? 'text-green-700' : field.warn ? 'text-yellow-700' : 'text-red-700'
 }`}>
 {field.value || 'Не заполнено'}
 </p>
 </div>
 </div>
 ))}
 </div>

 {missingCount > 0 && (
 <div className="mt-4 flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 text-sm text-yellow-800">
 <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
 <span>Не заполнено {missingCount} обязательных полей. Договор будет создан с прочерками.</span>
 </div>
 )}
 </div>

 {/* Generate */}
 <div className="hp-card p-5">
 <h2 className="font-semibold text-foreground mb-4">Создать документ</h2>
 <div className="flex items-center gap-3 flex-wrap">
 <GenerateButton contractId={id} />
 {contract.generated_docx_url && (
 <a
 href={contract.generated_docx_url}
 target="_blank"
 rel="noopener noreferrer"
 className="flex items-center gap-2 px-4 py-2.5 border border-border text-foreground text-sm font-medium hover:bg-accent transition-all"
 >
 <Download className="w-4 h-4" />
 Скачать последний DOCX
 </a>
 )}
 </div>
 </div>

 {/* Versions */}
 {versions && versions.length > 0 && (
 <div className="hp-card p-5">
 <h2 className="font-semibold text-foreground mb-4">История версий</h2>
 <div className="space-y-2">
 {versions.map((v) => (
 <div key={v.id}
 className="flex items-center justify-between p-3 bg-muted/30">
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 bg-violet-100 flex items-center justify-center">
 <FileText className="w-4 h-4 text-violet-600" />
 </div>
 <div>
 <p className="text-sm font-medium text-foreground">Версия {v.version}</p>
 <p className="text-xs text-muted-foreground">
 {new Date(v.created_at).toLocaleDateString('ru-RU', {
 day: '2-digit', month: 'long', year: 'numeric',
 })} {new Date(v.created_at).toLocaleTimeString('ru-RU', {
 hour: '2-digit', minute: '2-digit',
 })}
 </p>
 </div>
 </div>
 {v.docx_url && (
 <a href={v.docx_url} target="_blank" rel="noopener noreferrer"
 className="flex items-center gap-1.5 text-sm text-primary hover:underline">
 <Download className="w-3.5 h-3.5" />
 DOCX
 </a>
 )}
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 )
}
