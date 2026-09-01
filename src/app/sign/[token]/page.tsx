import { notFound } from 'next/navigation'
import { FileText, Download } from 'lucide-react'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { maskEmail } from '@/lib/signing'
import { SignDocumentFlow } from '@/features/contracts/components/SignDocumentFlow'

export const dynamic = 'force-dynamic'

// Публичная страница подписания договора.
//
// Работает через service-role клиент: у подписанта нет и не должно быть
// учётной записи в CRM, а RLS написан под authenticated. Авторизация здесь —
// сам токен из ссылки (32 случайных байта), как у публичных подборок /c/[token].

interface SignatureRow {
 id: string
 status: string
 signer_name: string | null
 signer_email: string | null
 document_url: string | null
 document_sha256: string | null
 signed_at: string | null
 expires_at: string
 contracts: {
 contract_number: string | null
 start_date: string | null
 end_date: string | null
 amount: number | null
 properties: { address: string | null } | null
 } | null
 organizations: { name: string | null } | null
}

function fmtDate(value: string | null): string {
 if (!value) return '—'
 return new Date(value).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default async function SignPage({ params }: { params: Promise<{ token: string }> }) {
 const { token } = await params
 if (!token || token.length < 32) notFound()

 // Любой сбой на этом шаге — это «страница не найдена», а не 500 со стеком:
 // адрес открывает посторонний человек по ссылке из письма, и показывать ему
 // подробности внутренней ошибки незачем.
 let data = null
 try {
 const supabase = getSupabaseAdmin()
 const result = await supabase
 .from('contract_signatures')
 .select(`
 id, status, signer_name, signer_email, document_url, document_sha256, signed_at, expires_at,
 contracts:contract_id ( contract_number, start_date, end_date, amount, properties:property_id ( address ) ),
 organizations:organization_id ( name )
 `)
 .eq('sign_token', token)
 .maybeSingle()
 data = result.data
 } catch (e) {
 console.error('[sign] не удалось загрузить запрос на подпись:', e)
 }

 if (!data) notFound()
 const signature = data as unknown as SignatureRow

 const expired = new Date(signature.expires_at) < new Date()
 const contract = signature.contracts

 return (
 <div className="min-h-screen bg-[var(--hp-bg)] py-10 px-4">
 <div className="max-w-2xl mx-auto space-y-6">
 <header className="space-y-2">
 <p className="text-[11px] uppercase tracking-[0.08em] font-bold text-[var(--hp-sub)]">
 {signature.organizations?.name ?? 'Агентство недвижимости'}
 </p>
 <h1 className="text-[27px] font-bold text-[var(--hp-ink)] tracking-tight leading-tight">
 Договор{contract?.contract_number ? ` № ${contract.contract_number}` : ''}
 </h1>
 {signature.signer_name && (
 <p className="text-[var(--hp-sub)] text-sm font-medium">Для: {signature.signer_name}</p>
 )}
 </header>

 <div className="hp-block">
 <div className="hp-block-header">Условия договора</div>
 {contract?.properties?.address && (
 <div className="hp-block-row">
 <span className="label">Объект</span>
 <span className="value">{contract.properties.address}</span>
 </div>
 )}
 {contract?.start_date && (
 <div className="hp-block-row">
 <span className="label">Период</span>
 <span className="value">{fmtDate(contract.start_date)} — {fmtDate(contract.end_date)}</span>
 </div>
 )}
 {contract?.amount && (
 <div className="hp-block-row">
 <span className="label">Сумма</span>
 <span className="value">{Number(contract.amount).toLocaleString('ru-RU')} ₽</span>
 </div>
 )}
 <div className="hp-block-row">
 <span className="label">Ссылка действует до</span>
 <span className="value">{fmtDate(signature.expires_at)}</span>
 </div>
 </div>

 {signature.document_url && (
 <a
 href={signature.document_url}
 target="_blank"
 rel="noopener noreferrer"
 className="flex items-center gap-2 px-5 py-2.5 bg-[var(--hp-surface)] border border-[var(--hp-border)] rounded-[var(--hp-radius)] text-sm font-semibold text-[var(--hp-ink)] hover:border-[var(--hp-sub)] transition-colors w-fit"
 >
 <Download className="w-4 h-4" />
 Скачать договор (DOCX)
 </a>
 )}

 {expired && signature.status !== 'signed' ? (
 <div className="hp-card p-5">
 <p className="text-sm text-[var(--hp-danger)] font-semibold">Срок действия ссылки истёк</p>
 <p className="text-sm text-[var(--hp-sub)] mt-1">
 Попросите агентство прислать новую ссылку на подписание.
 </p>
 </div>
 ) : (
 <SignDocumentFlow
 token={token}
 maskedEmail={maskEmail(signature.signer_email)}
 alreadySigned={signature.status === 'signed'}
 signedAt={signature.signed_at}
 />
 )}

 {signature.document_sha256 && (
 <div className="hp-card p-4">
 <p className="text-[11px] uppercase tracking-[0.08em] font-bold text-[var(--hp-sub)] mb-1">
 Контрольная сумма документа (SHA-256)
 </p>
 <code className="block text-[11px] text-[var(--hp-sub)] break-all">
 {signature.document_sha256}
 </code>
 </div>
 )}

 <p className="flex items-start gap-2 text-xs text-[var(--hp-sub)]">
 <FileText className="w-3.5 h-3.5 shrink-0 mt-0.5" />
 Страница открыта по персональной ссылке. Не пересылайте её посторонним — она даёт
 возможность подписать договор от вашего имени.
 </p>
 </div>
 </div>
 )
}
