'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useActionState } from 'react'
import { createTransactionAction, updateTransactionAction } from '../actions/accounting.actions'
import type { AccountingTransaction, AccountingCategory, Contract, Deal, User, Contact, Property } from '@/types/database'
import { ArrowDownCircle, ArrowUpCircle, Wallet, Tag, Link2, CircleAlert } from 'lucide-react'

interface Props {
 transaction?: AccountingTransaction
 categories: AccountingCategory[]
 contracts: Pick<Contract, 'id' | 'contract_number' | 'contract_type'>[]
 deals: Pick<Deal, 'id' | 'deal_type'>[]
 employees: Pick<User, 'id' | 'full_name'>[]
 contacts: Pick<Contact, 'id' | 'full_name' | 'company_name' | 'client_type'>[]
 properties: Pick<Property, 'id' | 'title' | 'address'>[]
 /** Предвыбранный объект — со страницы объекта в управлении */
 defaultPropertyId?: string
 /** Предвыбранный договор — например «начислить аренду» из карточки управления */
 defaultContractId?: string
}

type State = { error?: string; fields?: Record<string, string[]> } | null

const inputCls = 'w-full h-10 px-4 border border-input bg-background text-foreground placeholder:text-muted-foreground text-sm outline-none focus:border-[var(--hp-ink)] transition-all'
const selectCls = `${inputCls} cursor-pointer`
const cardCls = 'hp-card p-5'
const cardShadow = { }

function sectionTitle(icon: React.ReactNode, text: string) {
 return (
 <h2 className="flex items-center gap-2 font-bold text-foreground text-[15px] mb-4">
 <span className="text-[var(--hp-tertiary)]">{icon}</span>
 {text}
 </h2>
 )
}

function contactLabel(c: Pick<Contact, 'full_name' | 'company_name' | 'client_type'>) {
 return c.client_type === 'legal_entity' && c.company_name ? c.company_name : c.full_name
}

export function TransactionForm({ transaction, categories, contracts, deals, employees, contacts, properties, defaultPropertyId, defaultContractId }: Props) {
 const isEdit = Boolean(transaction)
 const action = transaction
 ? updateTransactionAction.bind(null, transaction.id)
 : createTransactionAction

 const [state, formAction, isPending] = useActionState<State, FormData>(action, null)

 const [type, setType] = useState<'income' | 'expense'>(transaction?.type ?? 'income')
 const [categoryId, setCategoryId] = useState(transaction?.category_id ?? '')
 const [amountRaw, setAmountRaw] = useState(transaction ? String(transaction.amount) : '')

 const visibleCategories = useMemo(
 () => categories.filter(c => c.type === type),
 [categories, type]
 )

 const amountPreview = useMemo(() => {
 const n = parseFloat(amountRaw.replace(/\s/g, '').replace(',', '.'))
 return isNaN(n) || n <= 0 ? null : n.toLocaleString('ru-RU') + ' ₽'
 }, [amountRaw])

 function handleTypeChange(next: 'income' | 'expense') {
 setType(next)
 // Категория предыдущего типа неприменима к новому — сбрасываем,
 // чтобы не отправить category_id, не соответствующий выбранному типу.
 setCategoryId(prev => {
 const stillValid = categories.some(c => c.id === prev && c.type === next)
 return stillValid ? prev : ''
 })
 }

 return (
 <form action={formAction} className="space-y-6">
 {state?.error && (
 <div className="p-3 bg-[var(--hp-danger-tint)] border border-[var(--hp-border)] text-sm text-[var(--hp-danger)] font-medium flex items-center gap-2">
 <CircleAlert className="w-4 h-4 shrink-0" />
 {state.error}
 </div>
 )}

 {/* Type selector */}
 <div className={cardCls} style={cardShadow}>
 {sectionTitle(<ArrowDownCircle className="w-4 h-4" />, 'Тип операции')}
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 {(['income', 'expense'] as const).map(t => (
 <label
 key={t}
 className="flex items-center gap-3 p-4 border-2 cursor-pointer transition-all has-[:checked]:shadow-sm"
 style={{
 borderColor: type === t ? (t === 'income' ? 'var(--hp-accent)' : '#A24B30') : '#DFE4D6',
 background: type === t ? (t === 'income' ? 'var(--hp-good-tint)' : 'var(--hp-danger-tint)') : 'var(--hp-surface)',
 }}
 >
 <input
 type="radio"
 name="type"
 value={t}
 checked={type === t}
 onChange={() => handleTypeChange(t)}
 className="sr-only"
 />
 {t === 'income'
 ? <ArrowDownCircle className="w-5 h-5 text-[var(--hp-good)] shrink-0" />
 : <ArrowUpCircle className="w-5 h-5 text-[var(--hp-danger)] shrink-0" />
 }
 <div>
 <p className={`text-sm font-bold ${t === 'income' ? 'text-[var(--hp-good)]' : 'text-[var(--hp-danger)]'}`}>
 {t === 'income' ? 'Доход' : 'Расход'}
 </p>
 <p className="text-xs text-muted-foreground">
 {t === 'income' ? 'Поступление средств' : 'Списание средств'}
 </p>
 </div>
 </label>
 ))}
 </div>
 </div>

 {/* Main fields */}
 <div className={cardCls} style={cardShadow}>
 {sectionTitle(<Wallet className="w-4 h-4" />, 'Основное')}
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
 <div className="space-y-1.5">
 <label className="block text-sm font-semibold text-foreground">Сумма (₽) *</label>
 <input
 type="text"
 name="amount"
 inputMode="decimal"
 placeholder="0.00"
 value={amountRaw}
 onChange={e => setAmountRaw(e.target.value)}
 className={inputCls}
 />
 {amountPreview && (
 <p className="text-xs text-[var(--hp-tertiary)]">{amountPreview}</p>
 )}
 </div>
 <div className="space-y-1.5">
 <label className="block text-sm font-semibold text-foreground">Дата операции *</label>
 <input
 type="date"
 name="date"
 defaultValue={transaction?.date ?? new Date().toISOString().slice(0, 10)}
 className={`${inputCls} min-w-0`}
 />
 </div>
 <div className="space-y-1.5">
 <label className="block text-sm font-semibold text-foreground">Статус</label>
 <select
 name="status"
 defaultValue={transaction?.status ?? 'completed'}
 className={selectCls}
 >
 <option value="completed">Выполнено</option>
 <option value="planned">Запланировано</option>
 <option value="cancelled">Отменено</option>
 </select>
 </div>
 <div className="space-y-1.5">
 <label className="block text-sm font-semibold text-foreground">Способ оплаты</label>
 <select
 name="payment_method"
 defaultValue={transaction?.payment_method ?? ''}
 className={selectCls}
 >
 <option value="">— не указан —</option>
 <option value="bank">Банк (безнал)</option>
 <option value="cash">Наличные</option>
 <option value="card">Карта</option>
 <option value="other">Другое</option>
 </select>
 </div>
 <div className="space-y-1.5">
 <label className="block text-sm font-semibold text-foreground">Срок оплаты</label>
 <input
 type="date"
 name="due_date"
 defaultValue={transaction?.due_date ?? ''}
 className={`${inputCls} min-w-0`}
 />
 <p className="text-xs text-[var(--hp-tertiary)]">Актуально для запланированных операций</p>
 </div>
 </div>

 <div className="mt-4 space-y-1.5">
 <label className="block text-sm font-semibold text-foreground">Описание</label>
 <textarea
 name="description"
 rows={2}
 defaultValue={transaction?.description ?? ''}
 placeholder="Краткое описание операции"
 className="w-full px-4 py-2.5 border border-input bg-background text-foreground placeholder:text-muted-foreground text-sm outline-none focus:border-[var(--hp-ink)] transition-all resize-none"
 />
 </div>
 </div>

 {/* Category */}
 <div className={cardCls} style={cardShadow}>
 {sectionTitle(<Tag className="w-4 h-4" />, 'Категория')}
 <div className="space-y-1.5">
 <label className="block text-sm font-semibold text-foreground">
 Категория {type === 'income' ? 'дохода' : 'расхода'}
 </label>
 <select
 name="category_id"
 value={categoryId}
 onChange={e => setCategoryId(e.target.value)}
 className={selectCls}
 >
 <option value="">— выберите категорию —</option>
 {visibleCategories.map(c => (
 <option key={c.id} value={c.id} style={{ color: c.color }}>{c.name}</option>
 ))}
 </select>
 {visibleCategories.length === 0 && (
 <p className="text-xs text-[var(--hp-warn)]">
 Нет категорий для «{type === 'income' ? 'Дохода' : 'Расхода'}». {' '}
 <Link href="/accounting/categories" className="font-semibold underline">Добавить категорию</Link>
 </p>
 )}
 </div>
 </div>

 {/* Links */}
 <div className={cardCls} style={cardShadow}>
 {sectionTitle(<Link2 className="w-4 h-4" />, 'Привязки')}
 <p className="text-xs text-muted-foreground -mt-2 mb-4">Необязательно — свяжите операцию с объектом, договором, сделкой, контактом или сотрудником</p>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <div className="space-y-1.5">
 <label className="block text-sm font-semibold text-foreground">Объект</label>
 <select
 name="property_id"
 defaultValue={transaction?.property_id ?? defaultPropertyId ?? ''}
 className={selectCls}
 >
 <option value="">— по договору —</option>
 {properties.map(p => (
 <option key={p.id} value={p.id}>{p.title || p.address || p.id.slice(0, 8)}</option>
 ))}
 </select>
 <p className="text-xs text-muted-foreground">
 Пусто — объект возьмётся из договора. Нужен разделу «Управление»: по нему считается доходность объекта.
 </p>
 </div>
 <div className="space-y-1.5">
 <label className="block text-sm font-semibold text-foreground">Договор</label>
 <select
 name="contract_id"
 defaultValue={transaction?.contract_id ?? defaultContractId ?? ''}
 className={selectCls}
 >
 <option value="">— не привязан —</option>
 {contracts.map(c => (
 <option key={c.id} value={c.id}>
 {c.contract_number ? `№${c.contract_number}` : c.id.slice(0, 8)} ({c.contract_type})
 </option>
 ))}
 </select>
 </div>
 <div className="space-y-1.5">
 <label className="block text-sm font-semibold text-foreground">Сделка</label>
 <select
 name="deal_id"
 defaultValue={transaction?.deal_id ?? ''}
 className={selectCls}
 >
 <option value="">— не привязана —</option>
 {deals.map(d => (
 <option key={d.id} value={d.id}>{d.deal_type} — {d.id.slice(0, 8)}</option>
 ))}
 </select>
 </div>
 <div className="space-y-1.5">
 <label className="block text-sm font-semibold text-foreground">Контакт (контрагент)</label>
 <select
 name="contact_id"
 defaultValue={transaction?.contact_id ?? ''}
 className={selectCls}
 >
 <option value="">— не привязан —</option>
 {contacts.map(c => (
 <option key={c.id} value={c.id}>{contactLabel(c)}</option>
 ))}
 </select>
 </div>
 <div className="space-y-1.5">
 <label className="block text-sm font-semibold text-foreground">Сотрудник (для зарплат)</label>
 <select
 name="employee_id"
 defaultValue={transaction?.employee_id ?? ''}
 className={selectCls}
 >
 <option value="">— не привязан —</option>
 {employees.map(e => (
 <option key={e.id} value={e.id}>{e.full_name}</option>
 ))}
 </select>
 </div>
 </div>
 </div>

 {/* Actions */}
 <div className="flex items-center justify-end gap-3 flex-wrap">
 <Link
 href="/accounting"
 className="flex items-center gap-2 px-5 py-2.5 hp-card text-sm font-semibold text-[var(--hp-ink)] hover:bg-[var(--hp-neutral-tint)] hover:border-[var(--hp-sub)] transition-all whitespace-nowrap"
 >
 Отмена
 </Link>
 <button
 type="submit"
 disabled={isPending}
 className="flex items-center gap-2 px-5 py-2.5 text-white text-sm font-bold transition-all disabled:opacity-60 disabled:hover:translate-y-0 whitespace-nowrap"
 style={{
 background: 'var(--hp-accent)',
 }}
 >
 {isPending ? 'Сохранение...' : (isEdit ? 'Сохранить' : 'Создать')}
 </button>
 </div>
 </form>
 )
}
