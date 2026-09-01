import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PrintButton } from '@/features/accounting/components/PrintButton'
import { amountInWords } from '@/lib/invoice-words'

export const dynamic = 'force-dynamic'

// Счёт на оплату — печатная форма.
//
// Сделан обычной страницей с print-стилями, а не генерацией PDF: браузер
// печатает в PDF сам, а верстка остаётся редактируемой без шаблонов и
// дополнительных зависимостей.

interface TxRow {
 id: string
 amount: number
 due_date: string | null
 date: string
 description: string | null
 status: string
 contracts: {
 contract_number: string | null
 start_date: string | null
 contacts: {
 full_name: string | null
 company_name: string | null
 inn: string | null
 kpp: string | null
 legal_address: string | null
 } | null
 properties: { address: string | null } | null
 } | null
}

function fmtMoney(n: number): string {
 return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(value: string | null): string {
 if (!value) return '—'
 return new Date(value).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
 const { id } = await params
 const supabase = await createClient()
 const { data: { user } } = await supabase.auth.getUser()
 if (!user) redirect('/login')

 const [{ data: raw }, { data: company }] = await Promise.all([
 supabase
 .from('accounting_transactions')
 .select(`
 id, amount, due_date, date, description, status,
 contracts:contract_id (
 contract_number, start_date,
 contacts:client_contact_id ( full_name, company_name, inn, kpp, legal_address ),
 properties:property_id ( address )
 )
 `)
 .eq('id', id)
 .single(),
 supabase
 .from('company_settings')
 .select('name, inn, kpp, ogrn, address, bank_name, bank_account, corr_account, bik, phone, email, signatory_name, signatory_position')
 .order('is_default', { ascending: false })
 .limit(1)
 .maybeSingle(),
 ])

 if (!raw) notFound()
 const tx = raw as unknown as TxRow

 const client = tx.contracts?.contacts
 const clientName = client?.company_name || client?.full_name || 'Клиент'
 const number = `${tx.contracts?.contract_number ?? 'Б/Н'}-${tx.id.slice(0, 4).toUpperCase()}`
 const amount = Number(tx.amount)

 return (
 <div className="max-w-3xl mx-auto space-y-6">
 <div className="flex items-center justify-between gap-3 flex-wrap print:hidden">
 <Link href="/accounting" className="hp-back-link inline-flex items-center gap-2">
 <ArrowLeft style={{ width: 16, height: 16 }} />
 К бухгалтерии
 </Link>
 <PrintButton label="Печать счёта" />
 </div>

 <div className="bg-[var(--hp-surface)] border border-[var(--hp-border)] p-8 space-y-6 print:border-0 print:p-0">
 {/* Реквизиты получателя платежа */}
 <table className="w-full text-[13px] border border-[var(--hp-border)]">
 <tbody>
 <tr>
 <td className="border border-[var(--hp-border)] px-3 py-2 text-[var(--hp-sub)] w-1/3">Банк получателя</td>
 <td className="border border-[var(--hp-border)] px-3 py-2 text-[var(--hp-ink)]">{company?.bank_name ?? '—'}</td>
 </tr>
 <tr>
 <td className="border border-[var(--hp-border)] px-3 py-2 text-[var(--hp-sub)]">БИК / Корр. счёт</td>
 <td className="border border-[var(--hp-border)] px-3 py-2 text-[var(--hp-ink)]">
 {company?.bik ?? '—'} / {company?.corr_account ?? '—'}
 </td>
 </tr>
 <tr>
 <td className="border border-[var(--hp-border)] px-3 py-2 text-[var(--hp-sub)]">ИНН / КПП</td>
 <td className="border border-[var(--hp-border)] px-3 py-2 text-[var(--hp-ink)]">
 {company?.inn ?? '—'} / {company?.kpp ?? '—'}
 </td>
 </tr>
 <tr>
 <td className="border border-[var(--hp-border)] px-3 py-2 text-[var(--hp-sub)]">Получатель</td>
 <td className="border border-[var(--hp-border)] px-3 py-2 text-[var(--hp-ink)]">
 {company?.name ?? '—'}
 <br />
 <span className="text-[var(--hp-sub)]">Счёт № {company?.bank_account ?? '—'}</span>
 </td>
 </tr>
 </tbody>
 </table>

 <h1 className="text-[22px] font-bold text-[var(--hp-ink)]">
 Счёт на оплату № {number} от {fmtDate(tx.due_date ?? tx.date)}
 </h1>

 <div className="space-y-1 text-[13px]">
 <p className="text-[var(--hp-ink)]">
 <span className="text-[var(--hp-sub)]">Поставщик: </span>
 {company?.name ?? '—'}
 {company?.address ? `, ${company.address}` : ''}
 </p>
 <p className="text-[var(--hp-ink)]">
 <span className="text-[var(--hp-sub)]">Покупатель: </span>
 {clientName}
 {client?.inn ? `, ИНН ${client.inn}` : ''}
 {client?.legal_address ? `, ${client.legal_address}` : ''}
 </p>
 {tx.contracts?.contract_number && (
 <p className="text-[var(--hp-ink)]">
 <span className="text-[var(--hp-sub)]">Основание: </span>
 договор № {tx.contracts.contract_number} от {fmtDate(tx.contracts.start_date)}
 </p>
 )}
 </div>

 <table className="w-full text-[13px] border border-[var(--hp-border)]">
 <thead>
 <tr className="bg-[var(--hp-neutral-tint)]">
 <th className="border border-[var(--hp-border)] px-3 py-2 text-left font-semibold text-[var(--hp-ink)]">№</th>
 <th className="border border-[var(--hp-border)] px-3 py-2 text-left font-semibold text-[var(--hp-ink)]">Наименование</th>
 <th className="border border-[var(--hp-border)] px-3 py-2 text-right font-semibold text-[var(--hp-ink)]">Сумма, ₽</th>
 </tr>
 </thead>
 <tbody>
 <tr>
 <td className="border border-[var(--hp-border)] px-3 py-2 text-[var(--hp-ink)]">1</td>
 <td className="border border-[var(--hp-border)] px-3 py-2 text-[var(--hp-ink)]">
 {tx.description ?? 'Оплата по договору'}
 {tx.contracts?.properties?.address ? ` (${tx.contracts.properties.address})` : ''}
 </td>
 <td className="border border-[var(--hp-border)] px-3 py-2 text-right text-[var(--hp-ink)]">{fmtMoney(amount)}</td>
 </tr>
 <tr>
 <td className="border border-[var(--hp-border)] px-3 py-2" colSpan={2}>
 <span className="font-semibold text-[var(--hp-ink)]">Итого к оплате</span>
 </td>
 <td className="border border-[var(--hp-border)] px-3 py-2 text-right font-bold text-[var(--hp-ink)]">
 {fmtMoney(amount)}
 </td>
 </tr>
 </tbody>
 </table>

 <p className="text-[13px] text-[var(--hp-ink)]">
 Всего к оплате: <b>{amountInWords(amount)}</b>
 </p>

 <div className="pt-8 flex items-end gap-8">
 <div className="text-[13px] text-[var(--hp-sub)]">
 <div className="border-b border-[var(--hp-ink)] w-52 mb-1" />
 {company?.signatory_position ?? 'Руководитель'}
 {company?.signatory_name ? `, ${company.signatory_name}` : ''}
 </div>
 </div>

 <p className="text-[11px] text-[var(--hp-sub)] print:hidden">
 Счёт формируется из реквизитов компании в разделе «Настройки → Компания».
 Незаполненные поля отображаются прочерком.
 </p>
 </div>
 </div>
 )
}
